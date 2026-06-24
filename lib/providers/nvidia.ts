import {
  streamOpenAICompat,
  completeOpenAICompat,
  ProviderError,
  type ChatParams,
} from "./openai-compat";
import { UPSTREAM_MODEL } from "./models";
import type { StreamChunk } from "../types";

const NVIDIA_BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

function nvidiaKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new ProviderError(
      "NVIDIA model is not configured.",
      false,
    );
  }
  return key;
}

/** Whether the NVIDIA provider is usable (key present). */
export function nvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

interface NvidiaParams extends ChatParams {
  thinking?: boolean;
}

/** Build the NVIDIA config for a given upstream model + thinking toggle. */
function nvidiaConfig(model: string, thinking: boolean) {
  return {
    baseUrl: NVIDIA_BASE_URL,
    apiKey: nvidiaKey(),
    model,
    extraBody: {
      chat_template_kwargs: { enable_thinking: thinking },
    },
  };
}

/** Stream from Nemotron-3 Ultra (coding + judge + reasoning). */
export function streamUltra(
  params: NvidiaParams,
): AsyncGenerator<StreamChunk> {
  return streamOpenAICompat(nvidiaConfig(UPSTREAM_MODEL.ultra, params.thinking ?? false), {
    ...params,
    temperature: params.temperature ?? 0.3,
  });
}

export function completeUltra(params: NvidiaParams): Promise<string> {
  return completeOpenAICompat(
    nvidiaConfig(UPSTREAM_MODEL.ultra, params.thinking ?? false),
    { ...params, temperature: params.temperature ?? 0.3 },
  );
}

/** Stream from Nemotron-3 Nano Omni (vision/OCR/multimodal). */
export function streamNanoOmni(
  params: NvidiaParams,
): AsyncGenerator<StreamChunk> {
  return streamOpenAICompat(nvidiaConfig(UPSTREAM_MODEL.nanoOmni, false), {
    ...params,
    temperature: params.temperature ?? 0.4,
  });
}

export function completeNanoOmni(params: NvidiaParams): Promise<string> {
  return completeOpenAICompat(nvidiaConfig(UPSTREAM_MODEL.nanoOmni, false), {
    ...params,
    temperature: params.temperature ?? 0.4,
  });
}
