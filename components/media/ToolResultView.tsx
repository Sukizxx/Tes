"use client";

import type { ToolResult } from "@/lib/types";
import { InlineImage } from "./ImageViewer";
import { VideoPlayer, AudioPlayer } from "./VideoPlayer";

export function ToolResultView({ result }: { result: ToolResult }) {
  if (result.kind === "image") {
    return (
      <div className="space-y-1">
        <InlineImage src={result.url} alt={result.prompt} />
      </div>
    );
  }

  if (result.kind === "image_edit") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <figure className="space-y-1">
          <figcaption className="text-xs text-text-muted">Original</figcaption>
          <InlineImage src={result.original} alt="original" />
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-xs text-text-muted">Edited</figcaption>
          <InlineImage src={result.edited} alt={result.prompt ?? "edited"} />
        </figure>
      </div>
    );
  }

  // download
  const primary = result.media[0];
  return (
    <div className="space-y-2">
      {result.title && (
        <div className="text-sm font-medium text-text-primary">{result.title}</div>
      )}
      {result.platform && (
        <div className="text-xs text-text-muted">{result.platform}</div>
      )}
      {primary?.type === "video" && (
        <VideoPlayer src={primary.url} poster={result.thumbnail} title={result.title} />
      )}
      {primary?.type === "audio" && <AudioPlayer src={primary.url} title={result.title} />}
      {primary?.type === "image" && <InlineImage src={primary.url} alt={result.title} />}
      {result.media.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {result.media.slice(1).map((m, i) => (
            <a
              key={i}
              href={m.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
            >
              {m.quality || m.type} ↓
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
