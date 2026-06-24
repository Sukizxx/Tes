// Shared types across providers, orchestrator, API and UI.

export type ModelId =
  | "neiroplus"
  | "nemotron-ultra"
  | "gpt-oss-120b"
  | "nano-omni";

export type ChatRole = "system" | "user" | "assistant";

/** A part of a multimodal message (text or image). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: ChatRole;
  /** Either a plain string or multimodal parts (for vision). */
  content: string | ContentPart[];
}

/** Options passed from the API route into a provider call. */
export interface ProviderCallOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  /** Enable reasoning/thinking mode where supported. */
  thinking?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/** A streaming chunk yielded by a provider. */
export interface StreamChunk {
  /** Visible answer text. */
  delta?: string;
  /** Reasoning/thinking text (kept separate from the answer). */
  reasoning?: string;
}

/** Server-Sent-Event payload shapes streamed to the client. */
export type SSEEvent =
  | { type: "status"; stage: string; label?: string; model?: ModelId }
  | { type: "reasoning"; text: string }
  | { type: "delta"; text: string }
  | { type: "tool"; tool: ToolResult }
  | {
      type: "discussion";
      turn: DiscussionTurn;
    }
  | { type: "error"; message: string }
  | { type: "done" };

/** Result of a tool invocation (image gen/edit, download). */
export type ToolResult =
  | { kind: "image"; url: string; prompt?: string }
  | {
      kind: "image_edit";
      original: string;
      edited: string;
      prompt?: string;
    }
  | {
      kind: "download";
      title?: string;
      platform?: string;
      thumbnail?: string;
      media: { url: string; type: "video" | "image" | "audio"; quality?: string }[];
    };

export interface DiscussionTurn {
  model: ModelId;
  label: string;
  role: "answer" | "critique" | "perspective" | "conclusion";
  text: string;
}

/** Chat-request body sent from the client to /api/chat. */
export interface ChatRequestBody {
  model: ModelId;
  messages: ChatMessage[];
  mode?: "normal" | "thinking" | "discussion";
  /** Pre-extracted file context (PDF/DOCX/ZIP text) appended server-side. */
  attachments?: AttachmentMeta[];
}

export interface AttachmentMeta {
  name: string;
  type: string;
  /** For images: a data URL or remote URL for vision models. */
  imageUrl?: string;
  /** For documents: extracted text content. */
  text?: string;
}

export type IntentKind =
  | "image_generate"
  | "image_edit"
  | "download"
  | "analyze"
  | "coding"
  | "general";

export interface DetectedIntent {
  kind: IntentKind;
  /** Cleaned prompt/argument extracted from the message. */
  argument?: string;
  /** For download/edit intents, the URL found in the message. */
  url?: string;
}
