import type { ChatMessage, SSEEvent, ModelId } from "../types";
import { completeUltra, completeNanoOmni, nvidiaConfigured } from "../providers/nvidia";
import { completeGptOss, openrouterConfigured } from "../providers/openrouter";
import { withRetry, errMsg } from "../providers/retry";
import { lastUserText } from "../tools/intent";

type Emit = (e: SSEEvent) => void;

/**
 * AI Discussion mode: models debate visibly, each with its own bubble.
 * Flow (spec): an answer → Ultra critiques → Nano Omni perspective →
 * Ultra conclusion. Each turn is emitted as a `discussion` event so the
 * UI can render separate avatar-labelled bubbles.
 *
 * Per the role correction, Nemotron-3 Ultra leads (answer + critique +
 * conclusion); GPT-OSS contributes a supporting view.
 */
export async function runDiscussion(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; multimodal?: boolean; emit: Emit },
): Promise<void> {
  const { signal, multimodal, emit } = opts;
  const userRequest = lastUserText(messages);
  const haveNvidia = nvidiaConfigured();
  const haveOpenRouter = openrouterConfigured();

  const turn = async (
    model: ModelId,
    label: string,
    role: "answer" | "critique" | "perspective" | "conclusion",
    system: string,
    user: string,
    run: (m: ChatMessage[]) => Promise<string>,
  ) => {
    if (signal?.aborted) return null;
    emit({ type: "status", stage: "discussion", label: `${label} is thinking…`, model });
    try {
      const text = await withRetry(
        () =>
          run([
            { role: "system", content: system },
            { role: "user", content: user },
          ]),
        { signal },
      );
      const t = { model, label, role, text };
      emit({ type: "discussion", turn: t });
      return t;
    } catch (err) {
      console.warn(`[discussion] ${label} skipped:`, errMsg(err));
      return null;
    }
  };

  const ultra = (m: ChatMessage[]) => completeUltra({ messages: m, signal, maxTokens: 1400 });
  const oss = (m: ChatMessage[]) => completeGptOss({ messages: m, signal, maxTokens: 1400 });
  const omni = (m: ChatMessage[]) => completeNanoOmni({ messages: m, signal, maxTokens: 1200 });

  // 1) Initial answer — Ultra (or GPT-OSS if NVIDIA down).
  const answerer = haveNvidia ? ultra : oss;
  const answererLabel: ModelId = haveNvidia ? "nemotron-ultra" : "gpt-oss-120b";
  const answer = await turn(
    answererLabel,
    haveNvidia ? "Nemotron-3 Ultra" : "GPT-OSS 120B",
    "answer",
    "You are participating in an AI discussion. Give your best direct answer to the user's question. Be clear and substantive.",
    userRequest,
    answerer,
  );
  if (signal?.aborted || !answer) {
    if (!answer) emit({ type: "error", message: "Request failed. Please try again." });
    return;
  }

  // 2) Critique — a second model challenges the answer.
  let critique = null;
  if (haveOpenRouter && haveNvidia) {
    critique = await turn(
      "gpt-oss-120b",
      "GPT-OSS 120B",
      "critique",
      "You are in an AI discussion. Critically evaluate the previous answer: point out weaknesses, missing points, or errors, and add anything valuable. Be constructive and specific.",
      `User question:\n${userRequest}\n\nPrevious answer:\n${answer.text}`,
      oss,
    );
  } else if (haveNvidia) {
    critique = await turn(
      "nemotron-ultra",
      "Nemotron-3 Ultra",
      "critique",
      "You are in an AI discussion. Critically evaluate the previous answer and add missing perspective.",
      `User question:\n${userRequest}\n\nPrevious answer:\n${answer.text}`,
      ultra,
    );
  }

  // 3) Perspective — Nano Omni (only if multimodal or as an extra angle).
  let perspective = null;
  if (haveNvidia && multimodal) {
    perspective = await turn(
      "nano-omni",
      "Nemotron-3 Nano Omni",
      "perspective",
      "You are in an AI discussion. Provide a multimodal/visual perspective on the topic if relevant, or a fresh angle otherwise.",
      `User question:\n${userRequest}\n\nDiscussion so far:\n${answer.text}\n\n${critique?.text ?? ""}`,
      omni,
    );
  }

  // 4) Conclusion — Ultra synthesizes the debate.
  if (haveNvidia) {
    const transcript = [answer, critique, perspective]
      .filter(Boolean)
      .map((t) => `[${(t as { label: string }).label}]\n${(t as { text: string }).text}`)
      .join("\n\n");
    await turn(
      "nemotron-ultra",
      "Nemotron-3 Ultra",
      "conclusion",
      "You are the moderator of an AI discussion. Read the debate and write a clear, balanced final conclusion that resolves disagreements and gives the user the best answer. Follow NeiroAI formatting: explain briefly, code in fenced blocks.",
      `User question:\n${userRequest}\n\nDiscussion transcript:\n${transcript}`,
      ultra,
    );
  }

  emit({ type: "done" });
}
