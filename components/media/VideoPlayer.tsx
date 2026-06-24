"use client";

export function VideoPlayer({
  src,
  poster,
  title,
}: {
  src: string;
  poster?: string;
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="max-h-[60vh] w-full bg-black"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/60 px-3 py-2">
        <span className="truncate text-xs text-text-secondary">{title || "Video"}</span>
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
        >
          Download
        </a>
      </div>
    </div>
  );
}

export function AudioPlayer({ src, title }: { src: string; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/60 p-3">
      <div className="mb-2 truncate text-xs text-text-secondary">{title || "Audio"}</div>
      <audio src={src} controls preload="metadata" className="w-full" />
      <div className="mt-2 text-right">
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          Download
        </a>
      </div>
    </div>
  );
}
