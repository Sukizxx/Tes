import type { ChatMessage, StreamChunk } from "../types";

/** Configuration for an OpenAI-compatible chat-completions endpoint. */
export interface OpenAICompatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Extra headers (e.g. OpenRouter attribution). */
  headers?: Record<string, string>;
  /** Extra body fields (e.g. NVIDIA chat_template_kwargs). */
  extraBody?: Record<string, unknown>;
}

export interface ChatParams {
  messages: ChatMessage[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/** A clean, user-facing error that never leaks internals. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const DEFAULT_TIMEOUT_MS = 90_000;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Stream a chat completion from any OpenAI-compatible endpoint.
 * Yields {delta, reasoning} chunks. Parses SSE lines defensively.
 */
export async function* streamOpenAICompat(
  cfg: OpenAICompatConfig,
  params: ChatParams,
): AsyncGenerator<StreamChunk> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  // Chain the caller's abort signal into our controller.
  const onAbort = () => controller.abort();
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener("abort", onAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        ...cfg.headers,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: params.messages,
        stream: true,
        temperature: params.temperature ?? 0.4,
        max_tokens: params.maxTokens ?? 4096,
        ...cfg.extraBody,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted && !params.signal?.aborted) {
      throw new ProviderError("The request timed out.", true);
    }
    if (params.signal?.aborted) {
      throw new ProviderError("Request cancelled.", false);
    }
    throw new ProviderError("Network error contacting the model.", true);
  }

  if (!res.ok || !res.body) {
    clearTimeout(timeout);
    const retryable = isRetryableStatus(res.status);
    // Drain a short body for server logs but never surface it.
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("Model authentication failed.", false, res.status);
    }
    if (res.status === 429) {
      throw new ProviderError("Model rate limit reached.", true, res.status);
    }
    console.error(`[provider ${cfg.model}] HTTP ${res.status}: ${detail}`);
    throw new ProviderError(
      "The model returned an error.",
      retryable,
      res.status,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by double newlines.
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          clearTimeout(timeout);
          return;
        }
        try {
          const json = JSON.parse(data);
          const choice = json.choices?.[0];
          const delta = choice?.delta;
          if (!delta) continue;
          const chunk: StreamChunk = {};
          if (typeof delta.content === "string" && delta.content.length) {
            chunk.delta = delta.content;
          }
          // NVIDIA/OpenRouter expose reasoning under different keys.
          const reasoning = delta.reasoning_content ?? delta.reasoning;
          if (typeof reasoning === "string" && reasoning.length) {
            chunk.reasoning = reasoning;
          }
          if (chunk.delta || chunk.reasoning) yield chunk;
        } catch {
          // Partial/garbled frame — skip it.
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    if (params.signal) params.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

/**
 * Collect a full (non-streamed) completion as a single string.
 * Used inside the NeiroPlus orchestrator for internal stages.
 */
export async function completeOpenAICompat(
  cfg: OpenAICompatConfig,
  params: ChatParams,
): Promise<string> {
  let out = "";
  for await (const chunk of streamOpenAICompat(cfg, params)) {
    if (chunk.delta) out += chunk.delta;
  }
  return out.trim();
}
