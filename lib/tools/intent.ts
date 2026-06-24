import type { DetectedIntent, ChatMessage } from "../types";

/** Extract the last user text message (string form). */
export function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    const textPart = m.content.find((p) => p.type === "text");
    if (textPart && "text" in textPart) return textPart.text;
  }
  return "";
}

const URL_RE = /https?:\/\/[^\s]+/i;

const SOCIAL_RE =
  /(tiktok|douyin|instagram|instagr\.am|facebook|fb\.watch|reddit|redd\.it|youtu\.?be|twitter|x\.com|pinterest|pin\.it|telegram|t\.me|linkedin|vimeo|spotify|soundcloud|snapchat|threads|dailymotion|bilibili|capcut)\.?/i;

const IMG_GEN_RE =
  /\b(buat|bikin|generate|create|gambar(?:kan)?|ilustrasi|logo|wallpaper|desain|design|render|lukis|draw|image of|picture of|foto)\b/i;
const IMG_GEN_STRONG_RE =
  /\b(buat|bikin|generate|create|buatkan|bikinin)\b.*\b(gambar|image|ilustrasi|logo|wallpaper|desain|design|poster|art|foto|picture)\b/i;

const EDIT_RE =
  /\b(edit|ubah|ganti|hapus background|remove background|tambah(?:kan)?|jadikan|change|make it|turn this|enhance|retouch)\b/i;

const CODING_RE =
  /\b(code|coding|program|fungsi|function|script|bug|error|debug|refactor|kompilasi|compile|algoritma|algorithm|class|api|endpoint|css|html|javascript|typescript|python|react|next\.?js|sql|regex|buatkan (?:website|web|aplikasi|app|landing))\b/i;

/** Pull a slash command argument: "/img a cat" → {cmd:"img", arg:"a cat"}. */
export function parseSlashCommand(
  text: string,
): { cmd: string; arg: string } | null {
  const m = text.match(/^\/(\w+)\s*([\s\S]*)$/);
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), arg: m[2].trim() };
}

/**
 * Detect what the user wants so the gateway can route to a tool
 * instead of forcing a model to answer manually (spec: TOOL PRIORITY).
 *
 * @param text     the latest user message
 * @param hasImage whether an image attachment is present
 */
export function detectIntent(
  text: string,
  hasImage = false,
): DetectedIntent {
  const trimmed = text.trim();

  // 1) Explicit slash commands win.
  const slash = parseSlashCommand(trimmed);
  if (slash) {
    switch (slash.cmd) {
      case "img":
        return { kind: "image_generate", argument: slash.arg };
      case "editimg":
        return {
          kind: "image_edit",
          argument: slash.arg,
          url: slash.arg.match(URL_RE)?.[0],
        };
      case "download": {
        const url = slash.arg.match(URL_RE)?.[0];
        return { kind: "download", url, argument: slash.arg };
      }
      case "analyze":
        return { kind: "analyze", argument: slash.arg };
      case "upload":
        return { kind: "analyze", argument: slash.arg };
    }
  }

  // 2) Social media URL → downloader.
  const url = trimmed.match(URL_RE)?.[0];
  if (url && SOCIAL_RE.test(url)) {
    return { kind: "download", url, argument: trimmed };
  }

  // 3) Image present + edit-ish language → image edit.
  if (hasImage && EDIT_RE.test(trimmed)) {
    return { kind: "image_edit", argument: trimmed };
  }

  // 4) Image generation language → image generation.
  if (IMG_GEN_STRONG_RE.test(trimmed) || (IMG_GEN_RE.test(trimmed) && /gambar|image|logo|wallpaper|ilustrasi|desain|poster/i.test(trimmed))) {
    // Strip the leading verb to keep just the subject as the prompt.
    const arg = trimmed
      .replace(/^\s*(tolong|please|coba)?\s*(buat(?:kan|in)?|bikin(?:in)?|generate|create|draw)\s*/i, "")
      .trim();
    return { kind: "image_generate", argument: arg || trimmed };
  }

  // 5) Image present but no edit verb → analyze/vision.
  if (hasImage) {
    return { kind: "analyze", argument: trimmed };
  }

  // 6) Coding language → coding (routed to Ultra).
  if (CODING_RE.test(trimmed)) {
    return { kind: "coding", argument: trimmed };
  }

  return { kind: "general", argument: trimmed };
}
