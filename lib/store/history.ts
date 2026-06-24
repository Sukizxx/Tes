import type { ModelId, ToolResult, DiscussionTurn } from "../types";

/** A rendered chat message stored in history. */
export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  /** Markdown text content. */
  content: string;
  /** Reasoning/thinking text (assistant only, optional). */
  reasoning?: string;
  /** Attached images (data/remote URLs) shown with the message. */
  images?: string[];
  /** Attached non-image files (name only, for display). */
  files?: { name: string; type: string }[];
  /** Tool outputs (image/edit/download) rendered as rich cards. */
  tools?: ToolResult[];
  /** Discussion-mode turns (rendered as separate bubbles). */
  discussion?: DiscussionTurn[];
  /** Model that produced an assistant message. */
  model?: ModelId;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMessage[];
  model: ModelId;
  createdAt: number;
  updatedAt: number;
}

const KEY = "neiroai.history.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function genId(): string {
  // RFC4122-ish; crypto where available.
  if (isBrowser() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadSessions(): ChatSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  if (!isBrowser()) return;
  try {
    // Keep history bounded to avoid quota issues / slowdowns.
    const bounded = sessions.slice(0, 200);
    localStorage.setItem(KEY, JSON.stringify(bounded));
  } catch (err) {
    console.warn("Failed to persist history:", err);
  }
}

export function newSession(model: ModelId): ChatSession {
  const now = Date.now();
  return {
    id: genId(),
    title: "New chat",
    messages: [],
    model,
    createdAt: now,
    updatedAt: now,
  };
}

/** Generate a short title from the first user message. */
export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean;
}

export function clearAllHistory(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
