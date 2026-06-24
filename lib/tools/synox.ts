import type { ToolResult } from "../types";

/**
 * Synox tool layer (https://api.synoxcloud.xyz).
 * Free REST provider used for image generation, image editing,
 * temporary file hosting (catbox) and social media downloads.
 * No API key required. Responses wrap a { status, statusCode, ... }
 * envelope — we parse defensively and dig for media URLs.
 */

const SYNOX_BASE = process.env.SYNOX_BASE_URL ?? "https://api.synoxcloud.xyz";
const UA = "NeiroAI/1.0";
const TIMEOUT = 120_000;

class ToolError extends Error {}

async function synoxFetch(
  path: string,
  init?: RequestInit,
): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${SYNOX_BASE}${path}`, {
      ...init,
      headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const json = await res.json();
      if (json && json.status === false) {
        throw new ToolError(json.message || "Tool request failed.");
      }
      return json;
    }
    // Some endpoints return the binary/redirect directly.
    return { _raw: true, url: res.url, contentType: ct, status: res.status };
  } catch (err) {
    if (controller.signal.aborted) throw new ToolError("Tool request timed out.");
    if (err instanceof ToolError) throw err;
    throw new ToolError("Could not reach the tool service.");
  } finally {
    clearTimeout(t);
  }
}

/** Recursively search a JSON object for the first plausible media URL. */
function findUrl(obj: any, exts: RegExp): string | undefined {
  const seen = new Set<any>();
  const stack = [obj];
  // Prefer keys that look like a result/url first.
  const preferredKeys = ["url", "result", "image", "imageUrl", "image_url", "link", "download", "data"];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    for (const k of preferredKeys) {
      const v = cur[k];
      if (typeof v === "string" && /^https?:\/\//.test(v) && exts.test(v)) {
        return v;
      }
    }
    for (const v of Object.values(cur)) {
      if (typeof v === "string" && /^https?:\/\//.test(v) && exts.test(v)) {
        return v;
      }
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return undefined;
}

const IMG_EXT = /\.(png|jpe?g|webp|gif)(\?|$)/i;
const VID_EXT = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const AUD_EXT = /\.(mp3|m4a|wav|ogg)(\?|$)/i;
const ANY_MEDIA = /\.(png|jpe?g|webp|gif|mp4|mov|webm|mp3|m4a|wav)(\?|$)/i;

/** Generate an image from a text prompt. */
export async function generateImage(
  prompt: string,
  ratio = "1:1",
): Promise<ToolResult> {
  const q = new URLSearchParams({ prompt, ratio });
  const json = await synoxFetch(`/ai-generate/text-2-image?${q.toString()}`);
  const url =
    findUrl(json, IMG_EXT) ??
    (typeof json?.url === "string" ? json.url : undefined) ??
    (json?._raw ? json.url : undefined);
  if (!url) throw new ToolError("Image generation returned no image.");
  return { kind: "image", url, prompt };
}

/** Upload a file to catbox via Synox, returning a public URL. */
export async function uploadToCatbox(
  file: Blob,
  filename: string,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, filename);
  const json = await synoxFetch(`/uploader/catbox`, {
    method: "POST",
    body: fd,
  });
  const url =
    (typeof json?.url === "string" && /^https?:/.test(json.url) && json.url) ||
    (typeof json?.result === "string" && json.result) ||
    findUrl(json, /^https?:\/\// as unknown as RegExp);
  // catbox returns a bare URL; also handle plain-text style results.
  const found =
    typeof url === "string"
      ? url
      : typeof json?.result === "string"
        ? json.result
        : undefined;
  if (!found || !/^https?:\/\//.test(found)) {
    throw new ToolError("File upload failed.");
  }
  return found.trim();
}

/** Edit an image (by public URL) using nanobanana. */
export async function editImage(
  imageUrl: string,
  prompt: string,
): Promise<ToolResult> {
  const q = new URLSearchParams({ url: imageUrl, prompt });
  const json = await synoxFetch(`/edit/nanobanana?${q.toString()}`);
  const edited =
    findUrl(json, IMG_EXT) ??
    (typeof json?.url === "string" ? json.url : undefined) ??
    (json?._raw ? json.url : undefined);
  if (!edited) throw new ToolError("Image edit returned no result.");
  return { kind: "image_edit", original: imageUrl, edited, prompt };
}

/** Download media from a social URL (all-in-one). Prefers HD/no-watermark video. */
export async function downloadMedia(url: string): Promise<ToolResult> {
  const q = new URLSearchParams({ url });
  const json = await synoxFetch(`/download/all-in-one?url=${encodeURIComponent(url)}`);

  const result = json?.result ?? json?.data ?? json;
  const out: { url: string; type: "video" | "image" | "audio"; quality?: string }[] = [];

  // Collect candidate media entries from common shapes.
  const candidates: any[] = [];
  const collect = (v: any) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(collect);
    else if (typeof v === "object") {
      if (typeof v.url === "string" || typeof v.download === "string") candidates.push(v);
      Object.values(v).forEach(collect);
    }
  };
  collect(result);

  for (const c of candidates) {
    const mediaUrl: string | undefined = c.url ?? c.download ?? c.link;
    if (typeof mediaUrl !== "string" || !/^https?:\/\//.test(mediaUrl)) continue;
    const quality: string | undefined =
      c.quality ?? c.label ?? c.resolution ?? undefined;
    let type: "video" | "image" | "audio" = "video";
    if (VID_EXT.test(mediaUrl) || /video|hd|sd|watermark/i.test(quality ?? "")) type = "video";
    else if (AUD_EXT.test(mediaUrl) || /audio|mp3/i.test(quality ?? "")) type = "audio";
    else if (IMG_EXT.test(mediaUrl)) type = "image";
    out.push({ url: mediaUrl, type, quality });
  }

  // Fallback: any single media URL anywhere in the payload.
  if (out.length === 0) {
    const any = findUrl(json, ANY_MEDIA);
    if (any) {
      const type = VID_EXT.test(any) ? "video" : IMG_EXT.test(any) ? "image" : "audio";
      out.push({ url: any, type });
    }
  }

  if (out.length === 0) throw new ToolError("No downloadable media found for that link.");

  // Sort: prefer HD / no-watermark video first.
  out.sort((a, b) => score(b) - score(a));

  const title: string | undefined =
    result?.title ?? result?.desc ?? json?.title ?? undefined;
  const platform: string | undefined =
    result?.platform ?? result?.source ?? json?.platform ?? undefined;
  const thumbnail =
    result?.thumbnail ?? result?.thumb ?? result?.cover ?? undefined;

  return {
    kind: "download",
    title: typeof title === "string" ? title : undefined,
    platform: typeof platform === "string" ? platform : undefined,
    thumbnail: typeof thumbnail === "string" ? thumbnail : undefined,
    media: out,
  };
}

function score(m: { type: string; quality?: string }): number {
  let s = 0;
  if (m.type === "video") s += 10;
  const q = (m.quality ?? "").toLowerCase();
  if (/hd|1080|720|no.?watermark|nowm/.test(q)) s += 5;
  if (/watermark|wm/.test(q) && !/no.?watermark/.test(q)) s -= 3;
  return s;
}
