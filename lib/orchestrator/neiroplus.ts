import type { ChatMessage, SSEEvent } from "../types";
import {
  completeUltra,
  completeNanoOmni,
  streamUltra,
  nvidiaConfigured,
} from "../providers/nvidia";
import { completeGptOss, openrouterConfigured } from "../providers/openrouter";
import { withRetry, errMsg } from "../providers/retry";
import {
  SYSTEM_PROMPTS,
  forceSystem,
  critiquePrompt,
  judgePrompt,
} from "./prompts";
import { lastUserText } from "../tools/intent";

type Emit = (e: SSEEvent) => void;

interface Draft {
  label: string;
  text: string;
}

/**
 * Run the NeiroPlus consensus pipeline and STREAM the final judged
 * answer via `emit`. Internal stages are summarized as status events
 * (hidden detail), and only the final synthesis is streamed as deltas.
 *
 * Stage 1 Draft → Stage 2 Cross-Eval + Revise → Stage 3 Judge (Ultra).
 *
 * Failsafe: each model is independently retried/skipped; as long as
 * at least one draft survives, the pipeline produces an answer. If
 * only one draft survives, we stream it directly (no point judging one).
 */
export async function runNeiroPlus(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; multimodal?: boolean; emit: Emit },
): Promise<void> {
  const { signal, multimodal, emit } = opts;
  const userRequest = lastUserText(messages);

  const haveNvidia = nvidiaConfigured();
  const haveOpenRouter = openrouterConfigured();

  // ── STAGE 1: DRAFT (concurrent, independent) ──────────────────
  emit({ type: "status", stage: "draft", label: "Drafting perspectives…" });

  const draftTasks: Promise<Draft | null>[] = [];

  if (haveNvidia) {
    draftTasks.push(
      safeDraft("Nemotron-3 Ultra", () =>
        withRetry(
          () =>
            completeUltra({
              messages: forceSystem(messages, SYSTEM_PROMPTS.coder),
              signal,
              maxTokens: 3000,
            }),
          { signal },
        ),
      ),
    );
  }

  if (haveOpenRouter) {
    draftTasks.push(
      safeDraft("GPT-OSS 120B", () =>
        withRetry(
          () =>
            completeGptOss({
              messages: forceSystem(messages, SYSTEM_PROMPTS.support),
              signal,
              maxTokens: 3000,
            }),
          { signal },
        ),
      ),
    );
  }

  if (multimodal && haveNvidia) {
    draftTasks.push(
      safeDraft("Nemotron-3 Nano Omni", () =>
        withRetry(
          () =>
            completeNanoOmni({
              messages: forceSystem(messages, SYSTEM_PROMPTS.vision),
              signal,
              maxTokens: 2000,
            }),
          { signal },
        ),
      ),
    );
  }

  const drafts = (await Promise.all(draftTasks)).filter(
    (d): d is Draft => d !== null && d.text.trim().length > 0,
  );

  if (signal?.aborted) return;

  if (drafts.length === 0) {
    emit({
      type: "error",
      message: "Request failed. Please try again.",
    });
    return;
  }

  // Only one draft survived → stream it directly (refined by Ultra if available).
  if (drafts.length === 1) {
    emit({ type: "status", stage: "finalize", label: "Finalizing…" });
    await streamFinalFromSingle(drafts[0], messages, { signal, haveNvidia, emit });
    emit({ type: "done" });
    return;
  }

  // ── STAGE 2: CROSS-EVALUATION ─────────────────────────────────
  emit({ type: "status", stage: "evaluate", label: "Cross-evaluating…" });

  const critiqueTasks = drafts.map((d) => {
    const others = drafts
      .filter((o) => o.label !== d.label)
      .map((o) => `[${o.label}]\n${o.text}`)
      .join("\n\n---\n\n");
    const sys = critiquePrompt(d.label, others);
    const produce = d.label.includes("GPT-OSS")
      ? () => completeGptOss({ messages: [{ role: "system", content: sys }, { role: "user", content: userRequest }], signal, maxTokens: 900 })
      : () => completeUltra({ messages: [{ role: "system", content: sys }, { role: "user", content: userRequest }], signal, maxTokens: 900 });
    return safeDraft(`${d.label} critique`, () => withRetry(produce, { signal }));
  });

  const critiques = (await Promise.all(critiqueTasks)).filter(
    (c): c is Draft => c !== null,
  );

  if (signal?.aborted) return;

  // ── STAGE 3: JUDGE (Ultra synthesizes; failover to GPT-OSS) ───
  emit({ type: "status", stage: "judge", label: "Judging & synthesizing…" });

  const draftsBlock = drafts
    .map((d) => `[${d.label}]\n${d.text}`)
    .join("\n\n===\n\n");
  const critiquesBlock = critiques.length
    ? critiques.map((c) => `[${c.label}]\n${c.text}`).join("\n\n===\n\n")
    : "(no critiques available)";

  const judgeSystem = judgePrompt(userRequest, draftsBlock, critiquesBlock);
  const judgeMessages: ChatMessage[] = [
    { role: "system", content: judgeSystem },
    { role: "user", content: "Produce the final answer now." },
  ];

  emit({ type: "status", stage: "final", label: "" });

  // Prefer Ultra as judge; if NVIDIA is down, fall back to GPT-OSS.
  try {
    if (haveNvidia) {
      await streamWith(() => streamUltra({ messages: judgeMessages, signal, maxTokens: 4096 }), emit, signal);
    } else {
      await streamWith(() => completeStream(completeGptOss, judgeMessages, signal), emit, signal);
    }
  } catch (err) {
    if (signal?.aborted) return;
    console.warn("[neiroplus] judge failed, streaming best draft:", errMsg(err));
    // Last-resort failsafe: stream the strongest draft verbatim.
    const best = drafts[0];
    for (const ch of chunkText(best.text)) emit({ type: "delta", text: ch });
  }

  emit({ type: "done" });
}

// ── helpers ───────────────────────────────────────────────────

async function safeDraft(
  label: string,
  fn: () => Promise<string>,
): Promise<Draft | null> {
  try {
    const text = await fn();
    return { label, text };
  } catch (err) {
    console.warn(`[neiroplus] ${label} skipped:`, errMsg(err));
    return null;
  }
}

async function streamFinalFromSingle(
  draft: Draft,
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; haveNvidia: boolean; emit: Emit },
): Promise<void> {
  // With a single draft we just stream it back (already complete).
  for (const ch of chunkText(draft.text)) {
    if (opts.signal?.aborted) return;
    opts.emit({ type: "delta", text: ch });
    // tiny delay for smooth streaming feel
    await new Promise((r) => setTimeout(r, 8));
  }
}

async function streamWith(
  make: () => AsyncGenerator<{ delta?: string; reasoning?: string }>,
  emit: Emit,
  signal?: AbortSignal,
): Promise<void> {
  for await (const chunk of make()) {
    if (signal?.aborted) return;
    if (chunk.delta) emit({ type: "delta", text: chunk.delta });
  }
}

/** Adapt a complete() function into a single-shot async generator. */
async function* completeStream(
  fn: (p: { messages: ChatMessage[]; signal?: AbortSignal; maxTokens?: number }) => Promise<string>,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<{ delta?: string }> {
  const text = await fn({ messages, signal, maxTokens: 4096 });
  for (const ch of chunkText(text)) yield { delta: ch };
}

/** Split text into small chunks for smooth client rendering. */
function chunkText(text: string, size = 24): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
