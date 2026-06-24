"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/common";

const LANG_LABEL: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", python: "Python",
  html: "HTML", css: "CSS", json: "JSON", bash: "Bash", shell: "Shell",
  go: "Go", rust: "Rust", java: "Java", c: "C", cpp: "C++", csharp: "C#",
  php: "PHP", ruby: "Ruby", sql: "SQL", yaml: "YAML", markdown: "Markdown",
  text: "Text",
};

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span className="animate-fade-in">Copied</span>
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export function CodeEmbed({
  code,
  lang,
  filename,
}: {
  code: string;
  lang: string;
  filename?: string;
}) {
  const codeRef = useRef<HTMLElement | null>(null);

  const highlighted = useMemo(() => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return null;
    }
  }, [code, lang]);

  const label = filename || LANG_LABEL[lang] || lang.toUpperCase();
  const lineCount = code.split("\n").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#3a3a3a]" />
          <span className="truncate font-mono text-xs text-text-secondary">{label}</span>
        </div>
        <CopyButton text={code} />
      </div>
      {/* Body — only place horizontal scroll is allowed */}
      <div className="embed-scroll max-h-[60vh] overflow-y-auto">
        <pre className="m-0 p-3 text-[13px] leading-relaxed">
          <code
            ref={codeRef}
            className={`hljs language-${lang} font-mono`}
            {...(highlighted
              ? { dangerouslySetInnerHTML: { __html: highlighted } }
              : { children: code })}
          />
        </pre>
      </div>
      {/* Footer metadata */}
      <div className="border-t border-border bg-secondary/40 px-3 py-1.5">
        <span className="font-mono text-[10px] text-text-muted">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
      </div>
    </div>
  );
}
