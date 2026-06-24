import type { ModelId } from "../types";

/** Static metadata for each selectable model. Used by the UI picker
 *  and the router. Roles reflect the user's binding correction:
 *  Nemotron-3 Ultra = primary coding specialist AND chief judge;
 *  GPT-OSS 120B = support only. */
export interface ModelInfo {
  id: ModelId;
  name: string;
  short: string;
  provider: "NVIDIA" | "OpenRouter" | "NeiroAI";
  role: string;
  /** Avatar glyph used in discussion mode and the picker. */
  avatar: string;
  description: string;
  supportsVision: boolean;
  supportsThinking: boolean;
  /** Recommended/default model. */
  recommended?: boolean;
}

export const MODELS: Record<ModelId, ModelInfo> = {
  neiroplus: {
    id: "neiroplus",
    name: "NeiroPlus",
    short: "NeiroPlus",
    provider: "NeiroAI",
    role: "Consensus Orchestration",
    avatar: "✦",
    description:
      "Combines all models through a 3-stage draft → cross-evaluation → judge pipeline for the most accurate, consistent answers. Recommended.",
    supportsVision: true,
    supportsThinking: true,
    recommended: true,
  },
  "nemotron-ultra": {
    id: "nemotron-ultra",
    name: "Nemotron-3 Ultra",
    short: "Ultra",
    provider: "NVIDIA",
    role: "Coding Specialist + Chief Judge",
    avatar: "▲",
    description:
      "The most important model in the system. Primary coding specialist and chief reasoning judge: architecture, debugging, refactoring, validation, logic.",
    supportsVision: false,
    supportsThinking: true,
  },
  "gpt-oss-120b": {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B",
    short: "GPT-OSS",
    provider: "OpenRouter",
    role: "Support",
    avatar: "◆",
    description:
      "Support model providing alternative perspectives and second opinions during cross-evaluation.",
    supportsVision: false,
    supportsThinking: true,
  },
  "nano-omni": {
    id: "nano-omni",
    name: "Nemotron-3 Nano Omni",
    short: "Nano Omni",
    provider: "NVIDIA",
    role: "Vision & Multimodal",
    avatar: "●",
    description:
      "Vision and multimodal specialist: OCR, image understanding, screenshot analysis and file interpretation. Auto-selected when you send images.",
    supportsVision: true,
    supportsThinking: false,
  },
};

/** Models shown in the picker, in display order. */
export const PICKER_ORDER: ModelId[] = [
  "neiroplus",
  "nemotron-ultra",
  "nano-omni",
  "gpt-oss-120b",
];

export const DEFAULT_MODEL: ModelId = "neiroplus";

/** Upstream model identifiers (verified June 2026). */
export const UPSTREAM_MODEL = {
  ultra: "nvidia/nemotron-3-ultra-550b-a55b",
  nanoOmni: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  gptOss: "openai/gpt-oss-120b",
} as const;
