import type { NextRequest } from "next/server";
import { extractPdfText } from "@/lib/files/pdf";
import { extractDocxText } from "@/lib/files/docx";
import { analyzeZip } from "@/lib/files/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Ingest an uploaded file and return structured context the client can
 * attach to the next chat turn:
 *  - images  → { kind:"image", imageUrl: dataURL }  (for the vision model)
 *  - pdf/docx/txt → { kind:"text", text }
 *  - zip     → { kind:"text", text: tree + source }
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return json({ error: "No file provided." }, 400);

    const f = file as File;
    if (f.size > MAX_BYTES) return json({ error: "File is too large (max 20 MB)." }, 413);

    const name = f.name || "file";
    const type = f.type || "";
    const buf = Buffer.from(await f.arrayBuffer());

    // Images → data URL for vision model.
    if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
      const dataUrl = `data:${type || "image/png"};base64,${buf.toString("base64")}`;
      return json({
        kind: "image",
        name,
        type: type || "image/png",
        size: f.size,
        imageUrl: dataUrl,
      });
    }

    // PDF
    if (type === "application/pdf" || /\.pdf$/i.test(name)) {
      const text = await extractPdfText(new Uint8Array(buf));
      return json({ kind: "text", name, type: "application/pdf", size: f.size, text: capText(text, name) });
    }

    // DOCX
    if (
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.docx$/i.test(name)
    ) {
      const text = await extractDocxText(buf);
      return json({ kind: "text", name, type: "docx", size: f.size, text: capText(text, name) });
    }

    // ZIP
    if (type === "application/zip" || /\.zip$/i.test(name)) {
      const { tree, content, fileCount } = await analyzeZip(new Uint8Array(buf));
      const text = `Project structure (${fileCount} files):\n\n${tree}\n\n--- File contents ---\n${content}`;
      return json({ kind: "text", name, type: "zip", size: f.size, text: capText(text, name) });
    }

    // Plain text / source code
    if (type.startsWith("text/") || /\.(txt|md|json|csv|log|js|ts|tsx|jsx|py|html|css|java|c|cpp|cs|go|rs|php|rb|sh|sql|yml|yaml|xml)$/i.test(name)) {
      const text = buf.toString("utf-8");
      return json({ kind: "text", name, type: type || "text/plain", size: f.size, text: capText(text, name) });
    }

    return json({ error: "Unsupported file type." }, 415);
  } catch (err) {
    console.error("[upload]", err);
    return json({ error: "Could not read that file." }, 500);
  }
}

function capText(text: string, name: string): string {
  const MAX = 80_000;
  const t = text.trim();
  if (t.length <= MAX) return `Content of ${name}:\n\n${t}`;
  return `Content of ${name} (truncated):\n\n${t.slice(0, MAX)}\n\n[... truncated ...]`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
