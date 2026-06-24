"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Auto-scroll a container to the bottom as content streams in, but
 * STOP following if the user scrolls up to read earlier messages.
 * Resumes only when the user scrolls back near the bottom.
 */
export function useAutoScroll<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T | null>(null);
  const follow = useRef(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Within 80px of the bottom → keep following.
    follow.current = distance < 80;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !follow.current) return;
    // Use rAF so we scroll after layout settles (no jump).
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [dep]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;
    follow.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  return { ref, onScroll, scrollToBottom, isFollowing: () => follow.current };
}
