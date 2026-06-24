"use client";

import { useMemo, useState } from "react";
import hljs from "highlight.js/lib/common";
import { CopyButton } from "./CodeEmbed";

/**
 * HTML embed — gets a Preview tab in addition to the code view.
 * Preview renders inside a sandboxed iframe (no same-origin, so it
 * cannot reach our backend, tokens, or storage) per the spec's
 * HTML PREVIEW SANDBOX requirement.
 */
export function HtmlEmbed({ code, filename }: { code: string; filename?: string }) {
  const [tab, setTab] = useState<"code" | "preview">("code");

  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(code, { language: "html" }).value;
    } catch {
      return null;
    }
  }, [code]);

  // Build a full document if the snippet is a fragment.
  const srcDoc = useMemo(() => {
    const hasHtmlTag = /<html[\s>]/i.test(code) || /<!doctype/i.test(code);
    if (hasHtmlTag) return code;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif;color:#111;background:#fff;}</style></head><body>${code}</body></html>`;
  }, [code]);

  const label = filename || "HTML";
  const lineCount = code.split("\n").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0d0d0d]">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#3a3a3a]" />
          <span className="truncate font-mono text-xs text-text-secondary">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-1 flex rounded-md bg-primary p-0.5">
            <button
              onClick={() => setTab("code")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === "code" ? "bg-tertiary text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === "preview" ? "bg-tertiary text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Preview
            </button>
          </div>
          <CopyButton text={code} />
        </div>
      </div>

      {/* Body */}
      {tab === "code" ? (
        <div className="embed-scroll max-h-[60vh] overflow-y-auto">
          <pre className="m-0 p-3 text-[13px] leading-relaxed">
            <code
              className="hljs language-html font-mono"
              {...(highlighted
                ? { dangerouslySetInnerHTML: { __html: highlighted } }
                : { children: code })}
            />
          </pre>
        </div>
      ) : (
        <div className="bg-white">
          <iframe
            title={`${label} preview`}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-modals allow-popups allow-forms"
            className="h-[420px] w-full border-0"
            loading="lazy"
          />
        </div>
      )}

      <div className="border-t border-border bg-secondary/40 px-3 py-1.5">
        <span className="font-mono text-[10px] text-text-muted">
          {tab === "preview" ? "Sandboxed preview" : `${lineCount} lines`}
        </span>
      </div>
    </div>
  );
}
