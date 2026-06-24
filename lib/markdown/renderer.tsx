"use client";

import React from "react";
import DOMPurify from "dompurify";
import { CodeEmbed } from "@/components/embed/CodeEmbed";
import { HtmlEmbed } from "@/components/embed/HtmlEmbed";

/** A parsed segment of an assistant message. */
type Segment =
  | { kind: "md"; text: string }
  | { kind: "code"; lang: string; filename?: string; code: string };

const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;

/**
 * Split markdown text into prose segments and fenced code blocks.
 * A filename written on the line directly above a fence (e.g. `index.html`)
 * is attached to that block so multi-file answers label each embed.
 */
export function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;

  while ((m = FENCE_RE.exec(input)) !== null) {
    const before = input.slice(last, m.index);
    const info = (m[1] || "").trim();
    const code = m[2].replace(/\n$/, "");
    last = m.index + m[0].length;

    // Detect a filename on the preceding non-empty line.
    let prose = before;
    let filename: string | undefined;
    const lines = before.replace(/\s+$/, "").split("\n");
    const lastLine = lines[lines.length - 1]?.trim() ?? "";
    if (/^[\w./-]+\.[A-Za-z0-9]+$/.test(lastLine) && lastLine.length < 60) {
      filename = lastLine;
      prose = lines.slice(0, -1).join("\n");
    }

    if (prose.trim()) segments.push({ kind: "md", text: prose });

    const lang = (info.split(/\s+/)[0] || guessLang(filename) || "text").toLowerCase();
    segments.push({ kind: "code", lang: normalizeLang(lang), filename, code });
  }

  const tail = input.slice(last);
  if (tail.trim()) segments.push({ kind: "md", text: tail });
  if (segments.length === 0) segments.push({ kind: "md", text: input });
  return segments;
}

function guessLang(filename?: string): string | undefined {
  if (!filename) return undefined;
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "html", htm: "html", css: "css", js: "javascript", mjs: "javascript",
    jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python",
    php: "php", go: "go", rs: "rust", java: "java", c: "c", h: "c",
    cpp: "cpp", cc: "cpp", cs: "csharp", rb: "ruby", sh: "bash", bash: "bash",
    sql: "sql", json: "json", yml: "yaml", yaml: "yaml", md: "markdown",
  };
  return ext ? map[ext] : undefined;
}

function normalizeLang(lang: string): string {
  const aliases: Record<string, string> = {
    js: "javascript", ts: "typescript", py: "python", sh: "bash",
    "c++": "cpp", "c#": "csharp", yml: "yaml", htm: "html",
  };
  return aliases[lang] ?? lang;
}

/** Render a small, safe subset of inline+block markdown to HTML. */
function renderInlineMarkdown(text: string): string {
  // Escape first, then re-introduce a controlled set of markup.
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = text.split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
  };

  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      );

  for (const raw of lines) {
    const line = raw;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeLists();
      const level = h[1].length + 2; // h3..h6
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) { closeLists(); html.push("<ul>"); inUl = true; }
      html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) { closeLists(); html.push("<ol>"); inOl = true; }
      html.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      closeLists();
      html.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
      continue;
    }
    if (line.trim() === "") {
      closeLists();
      html.push("");
      continue;
    }
    closeLists();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  return html.join("\n");
}

/** Sanitized prose block. */
function Prose({ text }: { text: string }) {
  const dirty = renderInlineMarkdown(text);
  const clean =
    typeof window !== "undefined"
      ? DOMPurify.sanitize(dirty, { ADD_ATTR: ["target", "rel"] })
      : dirty;
  return (
    <div
      className="prose-neiro"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/** Render a full assistant message: prose + code embeds (HTML gets preview). */
export function MarkdownMessage({ content }: { content: string }) {
  const segments = React.useMemo(() => parseSegments(content), [content]);
  return (
    <div className="space-y-3">
      {segments.map((seg, i) =>
        seg.kind === "md" ? (
          <Prose key={i} text={seg.text} />
        ) : seg.lang === "html" ? (
          <HtmlEmbed key={i} code={seg.code} filename={seg.filename} />
        ) : (
          <CodeEmbed key={i} code={seg.code} lang={seg.lang} filename={seg.filename} />
        ),
      )}
    </div>
  );
}
