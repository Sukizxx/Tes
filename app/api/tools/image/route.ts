import type { NextRequest } from "next/server";
import { generateImage } from "@/lib/tools/synox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { prompt, ratio? } → generated image. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const ratio = typeof body?.ratio === "string" ? body.ratio : "1:1";
    if (!prompt) {
      return json({ error: "A prompt is required." }, 400);
    }
    const result = await generateImage(prompt, ratio);
    return json({ result });
  } catch (err) {
    console.error("[tools/image]", err);
    return json({ error: "Image generation failed. Please try again." }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
