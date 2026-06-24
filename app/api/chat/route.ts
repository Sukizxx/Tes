import type { NextRequest } from "next/server";
import type { ChatMessage, ModelId, SSEEvent } from "@/lib/types";
import { sanitizeMessages, hasImageContent } from "@/lib/server/sanitize";
import { createSSEResponse } from "@/lib/server/sse";
import { runNeiroPlus } from "@/lib/orchestrator/neiroplus";
import { runDiscussion } from "@/lib/orchestrator/discussion";
import {
  streamUltra,
  streamNanoOmni,
  nvidiaConfigured,
} from "@/lib/providers/nvidia";
import { streamGptOss, openrouterConfigured } from "@/lib/providers/openrouter";
import { withRetry } from "@/lib/providers/retry";
import { SYSTEM_PROMPTS, forceSystem, withSystem } from "@/lib/orchestrator/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Mode = "normal" | "thinking" | "discussion";

export async function POST(req: NextRequest) {
  let messages: ChatMessage[];
  let model: ModelId;
  let mode: Mode;

  try {
    const body = await req.json();
    messages = sanitizeMessages(body?.messages);
    model = normalizeModel(body?.model);
    mode = body?.mode === "thinking" || body?.mode === "discussion" ? body.mode : "normal";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const multimodal = hasImageContent(messages);

  return createSSEResponse(async (emit, signal) => {
    // Discussion mode is independent of the selected model.
    if (mode === "discussion") {
      await runDiscussion(messages, { signal, multimodal, emit });
      return;
    }

    // NeiroPlus orchestration.
    if (model === "neiroplus") {
      await runNeiroPlus(messages, { signal, multimodal, emit });
      return;
    }

    // Auto-route multimodal turns to the vision model regardless of pick.
    const effective: ModelId = multimodal && model !== "nano-omni" ? "nano-omni" : model;

    await streamSingleModel(effective, messages, {
      signal,
      thinking: mode === "thinking",
      emit,
    });
  }, req.signal);
}

function normalizeModel(m: unknown): ModelId {
  if (m === "neiroplus" || m === "nemotron-ultra" || m === "gpt-oss-120b" || m === "nano-omni") {
    return m;
  }
  return "neiroplus";
}

/**
 * Stream a single model with failover + auto-skip. If the chosen model
 * fails entirely, fall back to any other configured model so the user
 * still gets an answer (spec: FAILSAFE — at least one model must answer).
 */
async function streamSingleModel(
  model: ModelId,
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; thinking?: boolean; emit: (e: SSEEvent) => void },
): Promise<void> {
  const { signal, thinking, emit } = opts;

  if (thinking) {
    emit({ type: "status", stage: "thinking", label: "Thinking…" });
  }

  // Build an ordered list of candidates: chosen first, then fallbacks.
  const candidates = buildCandidates(model);
  let streamed = false;
  let lastErr: unknown;

  for (const cand of candidates) {
    if (signal?.aborted) return;
    try {
      const sys = systemFor(cand, thinking);
      const msgs = forceSystem(messages, sys);
      await withRetry(
        async () => {
          // Re-create the generator each retry attempt.
          const gen = makeStream(cand, msgs, { signal, thinking });
          let reasoningOpen = false;
          for await (const chunk of gen) {
            if (signal?.aborted) return;
            if (chunk.reasoning && thinking) {
              reasoningOpen = true;
              emit({ type: "reasoning", text: chunk.reasoning });
            }
            if (chunk.delta) {
              if (reasoningOpen) reasoningOpen = false;
              streamed = true;
              emit({ type: "delta", text: chunk.delta });
            }
          }
        },
        { signal, attempts: streamed ? 1 : 3 }, // don't retry mid-stream
      );
      if (streamed) {
        emit({ type: "done" });
        return;
      }
    } catch (err) {
      lastErr = err;
      if (signal?.aborted) return;
      // If we already streamed some text, don't switch models.
      if (streamed) {
        emit({ type: "done" });
        return;
      }
      // else: try next candidate (auto-skip / failover)
    }
  }

  if (!streamed) {
    console.warn("[chat] all candidates failed:", lastErr);
    emit({ type: "error", message: "Request failed. Please try again." });
  } else {
    emit({ type: "done" });
  }
}

/** Ordered fallback candidates for a chosen model. */
function buildCandidates(model: ModelId): ModelId[] {
  const order: ModelId[] = [model];
  const all: ModelId[] = ["nemotron-ultra", "gpt-oss-120b", "nano-omni"];
  for (const m of all) if (!order.includes(m)) order.push(m);
  // Filter to configured providers only.
  return order.filter(isConfigured);
}

function isConfigured(model: ModelId): boolean {
  if (model === "gpt-oss-120b") return openrouterConfigured();
  return nvidiaConfigured(); // ultra + nano-omni
}

function systemFor(model: ModelId, thinking?: boolean): string {
  if (model === "nano-omni") return SYSTEM_PROMPTS.vision;
  if (model === "nemotron-ultra") return thinking ? SYSTEM_PROMPTS.reasoner : SYSTEM_PROMPTS.coder;
  if (model === "gpt-oss-120b") return SYSTEM_PROMPTS.support;
  return SYSTEM_PROMPTS.base;
}

function makeStream(
  model: ModelId,
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; thinking?: boolean },
) {
  switch (model) {
    case "nemotron-ultra":
      return streamUltra({ messages, signal: opts.signal, thinking: opts.thinking });
    case "nano-omni":
      return streamNanoOmni({ messages, signal: opts.signal });
    case "gpt-oss-120b":
      return streamGptOss({ messages, signal: opts.signal });
    default:
      return streamUltra({ messages, signal: opts.signal, thinking: opts.thinking });
  }
}
