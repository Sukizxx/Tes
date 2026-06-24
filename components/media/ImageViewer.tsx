"use client";

import { useEffect, useState } from "react";

/** Fullscreen image viewer with zoom + download. */
export function ImageViewer({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="rounded-lg bg-secondary px-3 py-2 text-text-secondary hover:bg-hover hover:text-text-primary"
            aria-label="Zoom out"
          >−</button>
          <span className="min-w-[3rem] text-center text-sm text-text-secondary">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="rounded-lg bg-secondary px-3 py-2 text-text-secondary hover:bg-hover hover:text-text-primary"
            aria-label="Zoom in"
          >+</button>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={src}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-secondary px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Download
          </a>
          <button
            onClick={onClose}
            className="rounded-lg bg-secondary px-3 py-2 text-text-secondary hover:bg-hover hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? "image"}
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `scale(${zoom})` }}
          className="max-h-full max-w-full select-none rounded-lg object-contain transition-transform"
        />
      </div>
    </div>
  );
}

/** Inline image thumbnail that opens the viewer on click. */
export function InlineImage({ src, alt }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative block overflow-hidden rounded-xl border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? "image"}
          loading="lazy"
          className="max-h-80 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {open && <ImageViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
