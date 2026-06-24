import type { NextRequest } from "next/server";
import { editImage, uploadToCatbox } from "@/lib/tools/synox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Image edit. Accepts either:
 *  - multipart/form-data with `file` + `prompt`  → uploads to catbox then edits
 *  - JSON { imageUrl, prompt }                   → edits a public URL directly
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  try {
    let imageUrl: string;
    let prompt: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      prompt = String(form.get("prompt") ?? "").trim();
      if (!(file instanceof Blob)) return json({ error: "An image file is required." }, 400);
      if (!prompt) return json({ error: "An edit instruction is required." }, 400);
      const name = (file as File).name || "image.png";
      imageUrl = await uploadToCatbox(file, name);
    } else {
      const body = await req.json();
      imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : "";
      prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!imageUrl) return json({ error: "An image URL is required." }, 400);
      if (!prompt) return json({ error: "An edit instruction is required." }, 400);
    }

    const result = await editImage(imageUrl, prompt);
    return json({ result });
  } catch (err) {
    console.error("[tools/edit]", err);
    return json({ error: "Image edit failed. Please try again." }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
