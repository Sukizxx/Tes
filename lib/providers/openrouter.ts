import {
  streamOpenAICompat,
  completeOpenAICompat,
  ProviderError,
  type ChatParams,
} from "./openai-compat";
import { UPSTREAM_MODEL } from "./models";
import type { StreamChunk } from "../types";

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

function openrouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new ProviderError("GPT-OSS model is not configured.", false);
  }
  return key;
}

/** Whether the OpenRouter provider is usable (key present). */
export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function openrouterConfig() {
  return {
    baseUrl: OPENROUTER_BASE_URL,
    apiKey: openrouterKey(),
    model: UPSTREAM_MODEL.gptOss,
    headers: {
      // OpenRouter attribution (optional but recommended).
      "HTTP-Referer": "https://neiroai.app",
      "X-Title": "NeiroAI",
    },
  };
}

/** Stream from GPT-OSS 120B (support model). */
export function streamGptOss(params: ChatParams): AsyncGenerator<StreamChunk> {
  return streamOpenAICompat(openrouterConfig(), {
    ...params,
    temperature: params.temperature ?? 0.4,
  });
}

export function completeGptOss(params: ChatParams): Promise<string> {
  return completeOpenAICompat(openrouterConfig(), {
    ...params,
    temperature: params.temperature ?? 0.4,
  });
}
