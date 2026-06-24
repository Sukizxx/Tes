import type { ChatMessage, ContentPart } from "../types";

/** Hard caps to prevent abuse / runaway requests. */
const MAX_MESSAGES = 60;
const MAX_TEXT_LEN = 60_000;
const MAX_IMAGE_PARTS = 6;

/** Strip control characters (keep tab/newline) that could break prompts. */
function cleanText(s: string): string {
  // Remove C0 controls except \t and \n, plus DEL — using hex escapes.
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").slice(0, MAX_TEXT_LEN);
}

/**
 * Validate + sanitize an incoming message list. Throws on malformed
 * input. Returns a safe, size-bounded copy.
 */
export function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) throw new Error("messages must be an array");
  const sliced = input.slice(-MAX_MESSAGES);
  const out: ChatMessage[] = [];

  for (const raw of sliced) {
    if (!raw || typeof raw !== "object") continue;
    const role = (raw as any).role;
    if (role !== "system" && role !== "user" && role !== "assistant") continue;
    const content = (raw as any).content;

    if (typeof content === "string") {
      const text = cleanText(content);
      if (text) out.push({ role, content: text });
    } else if (Array.isArray(content)) {
      const parts: ContentPart[] = [];
      let imgCount = 0;
      for (const p of content) {
        if (!p || typeof p !== "object") continue;
        if (p.type === "text" && typeof p.text === "string") {
          const t = cleanText(p.text);
          if (t) parts.push({ type: "text", text: t });
        } else if (
          p.type === "image_url" &&
          p.image_url &&
          typeof p.image_url.url === "string" &&
          imgCount < MAX_IMAGE_PARTS
        ) {
          const url = p.image_url.url;
          // Allow data URLs and http(s) only.
          if (/^data:image\//.test(url) || /^https?:\/\//.test(url)) {
            parts.push({ type: "image_url", image_url: { url } });
            imgCount++;
          }
        }
      }
      if (parts.length) out.push({ role, content: parts });
    }
  }

  if (out.length === 0) throw new Error("no valid messages");
  return out;
}

/** Does any message carry an image part? (→ route to vision model). */
export function hasImageContent(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((p) => p.type === "image_url"),
  );
}
