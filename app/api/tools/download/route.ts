import type { NextRequest } from "next/server";
import { downloadMedia } from "@/lib/tools/synox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { url } → downloaded media metadata + direct links. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!/^https?:\/\//.test(url)) {
      return json({ error: "A valid media URL is required." }, 400);
    }
    const result = await downloadMedia(url);
    return json({ result });
  } catch (err) {
    console.error("[tools/download]", err);
    return json({ error: "Download failed. The link may be unsupported." }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
