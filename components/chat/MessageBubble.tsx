"use client";

import { useState } from "react";
import type { StoredMessage } from "@/lib/store/history";
import { MarkdownMessage } from "@/lib/markdown/renderer";
import { InlineImage } from "@/components/media/ImageViewer";
import { ToolResultView } from "@/components/media/ToolResultView";
import { MODELS } from "@/lib/providers/models";

/** Action menu that appears on long-press / click of a message. */
function ActionMenu({
  isUser,
  text,
  onEdit,
  onClose,
}: {
  isUser: boolean;
  text: string;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    onClose();
  };
  const selectText = () => {
    onClose();
  };
  return (
    <div className="absolute -top-9 right-0 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-tertiary p-0.5 shadow-xl animate-slide-up">
      {isUser && onEdit && (
        <button onClick={() => { onEdit(); onClose(); }} className="rounded px-2.5 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text-primary">Edit</button>
      )}
      <button onClick={copy} className="rounded px-2.5 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text-primary">Copy</button>
      <button onClick={selectText} className="rounded px-2.5 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text-primary">Select</button>
    </div>
  );
}

export function MessageBubble({
  message,
  onEdit,
}: {
  message: StoredMessage;
  onEdit?: (id: string) => void;
}) {
  const isUser = message.role === "user";
  const [menu, setMenu] = useState(false);

  const plainText =
    message.content +
    (message.tools?.length
      ? "\n" + message.tools.map((t) => ("url" in t ? t.url : "edited" in t ? t.edited : "")).join("\n")
      : "");

  // Discussion-mode rendering: separate labelled bubbles.
  if (message.discussion && message.discussion.length > 0) {
    return (
      <div className="space-y-3">
        {message.discussion.map((turn, i) => {
          const info = MODELS[turn.model];
          return (
            <div key={i} className="flex gap-2.5">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-tertiary text-sm">
                {info?.avatar ?? "●"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">{turn.label}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">{turn.role}</span>
                </div>
                <div className="rounded-2xl rounded-tl-md border border-border bg-secondary/50 px-3.5 py-2.5 text-[15px] leading-relaxed text-text-primary">
                  <MarkdownMessage content={turn.text} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`group relative max-w-[88%] sm:max-w-[80%] ${isUser ? "" : "w-full"}`}
        onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}
      >
        {menu && (
          <ActionMenu
            isUser={isUser}
            text={message.content}
            onEdit={isUser && onEdit ? () => onEdit(message.id) : undefined}
            onClose={() => setMenu(false)}
          />
        )}

        {/* Attached images (user) */}
        {message.images && message.images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 justify-end">
            {message.images.map((src, i) => (
              <div key={i} className="max-w-[200px]">
                <InlineImage src={src} />
              </div>
            ))}
          </div>
        )}

        {/* Attached non-image files */}
        {message.files && message.files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 justify-end">
            {message.files.map((f, i) => (
              <span key={i} className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs text-text-secondary">📎 {f.name}</span>
            ))}
          </div>
        )}

        {/* Text bubble */}
        {message.content && (
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            className={`block w-full select-text text-left text-[15px] leading-relaxed ${
              isUser
                ? "rounded-2xl rounded-tr-md bg-tertiary px-4 py-2.5 text-text-primary"
                : "rounded-2xl rounded-tl-md bg-transparent text-text-primary"
            }`}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            ) : (
              <MarkdownMessage content={message.content} />
            )}
          </button>
        )}

        {/* Reasoning (collapsible) */}
        {message.reasoning && (
          <details className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-text-secondary">
            <summary className="cursor-pointer select-none text-xs font-medium text-text-muted">Reasoning</summary>
            <div className="mt-2 whitespace-pre-wrap break-words">{message.reasoning}</div>
          </details>
        )}

        {/* Tool results */}
        {message.tools && message.tools.length > 0 && (
          <div className="mt-2 space-y-3">
            {message.tools.map((t, i) => (
              <ToolResultView key={i} result={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
