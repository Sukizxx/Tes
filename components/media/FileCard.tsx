"use client";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(type: string, name: string): string {
  if (type.startsWith("image/")) return "🖼";
  if (type.includes("pdf") || /\.pdf$/i.test(name)) return "📄";
  if (type.includes("zip") || /\.zip$/i.test(name)) return "🗂";
  if (/\.(docx?|odt)$/i.test(name) || type.includes("word")) return "📝";
  return "📎";
}

export interface FileCardData {
  name: string;
  type: string;
  size: number;
  thumbnail?: string;
}

/** File preview card shown before/after processing. */
export function FileCard({
  file,
  onRemove,
}: {
  file: FileCardData;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2">
      {file.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.thumbnail}
          alt={file.name}
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-tertiary text-lg">
          {iconFor(file.type, file.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-text-primary">{file.name}</div>
        <div className="text-xs text-text-muted">
          {humanSize(file.size)}
          {file.type ? ` · ${file.type.split("/").pop()}` : ""}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove file"
          className="shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
        >
          ✕
        </button>
      )}
    </div>
  );
}
