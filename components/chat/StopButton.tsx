"use client";

export function StopButton({ onStop }: { onStop: () => void }) {
  return (
    <button
      onClick={onStop}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-text-primary text-primary transition-transform hover:scale-105 active:scale-95"
      aria-label="Stop generating"
      title="Stop"
    >
      <span className="h-3 w-3 rounded-[2px] bg-primary" />
    </button>
  );
}

export function SendButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-text-primary text-primary transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-tertiary disabled:text-text-muted disabled:hover:scale-100"
      aria-label="Send message"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  );
}
