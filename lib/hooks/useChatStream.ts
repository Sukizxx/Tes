"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ChatMessage,
  ModelId,
  SSEEvent,
  ToolResult,
  DiscussionTurn,
} from "@/lib/types";

export interface StreamState {
  /** Visible answer text accumulated so far. */
  text: string;
  /** Reasoning/thinking text (thinking mode). */
  reasoning: string;
  /** Current pipeline status label (e.g. "Judging…"). */
  status: string;
  /** Discussion-mode turns collected. */
  discussion: DiscussionTurn[];
  /** Whether a stream is in progress. */
  streaming: boolean;
  error: string | null;
}

const EMPTY: StreamState = {
  text: "",
  reasoning: "",
  status: "",
  discussion: [],
  streaming: false,
  error: null,
};

/**
 * Drives a streaming chat request to /api/chat.
 *
 * Smoothness: incoming deltas are buffered and flushed on a single
 * rAF tick, so React re-renders at most once per frame regardless of
 * chunk rate. This prevents flicker / layout-jump / "screen shake".
 */
export function useChatStream() {
  const [state, setState] = useState<StreamState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);

  // Mutable buffers updated synchronously between frames.
  const buf = useRef({ text: "", reasoning: "" });
  const rafRef = useRef<number | null>(null);
  const turnsRef = useRef<DiscussionTurn[]>([]);

  const flush = useCallback(() => {
    rafRef.current = null;
    setState((s) => ({
      ...s,
      text: buf.current.text,
      reasoning: buf.current.reasoning,
      discussion: turnsRef.current.slice(),
    }));
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame(flush)
        : (setTimeout(flush, 16) as unknown as number);
  }, [flush]);

  const start = useCallback(
    async (params: {
      messages: ChatMessage[];
      model: ModelId;
      mode?: "normal" | "thinking" | "discussion";
      onTool?: (t: ToolResult) => void;
    }): Promise<{ text: string; reasoning: string; discussion: DiscussionTurn[] } | null> => {
      // Reset.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      buf.current = { text: "", reasoning: "" };
      turnsRef.current = [];
      setState({ ...EMPTY, streaming: true, status: params.mode === "thinking" ? "Thinking…" : "" });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: params.messages,
            model: params.model,
            mode: params.mode ?? "normal",
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = sseBuf.indexOf("\n\n")) !== -1) {
            const frame = sseBuf.slice(0, nl);
            sseBuf = sseBuf.slice(nl + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let evt: SSEEvent;
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }
            handleEvent(evt, params.onTool);
          }
        }
      } catch (err) {
        if (ac.signal.aborted) {
          // User stopped — keep whatever we have.
        } else {
          setState((s) => ({ ...s, error: "Request failed. Please try again." }));
        }
      } finally {
        if (rafRef.current != null) {
          cancelAnimationFrame?.(rafRef.current);
          rafRef.current = null;
        }
        flush();
        setState((s) => ({ ...s, streaming: false, status: "" }));
        abortRef.current = null;
      }

      return {
        text: buf.current.text,
        reasoning: buf.current.reasoning,
        discussion: turnsRef.current.slice(),
      };

      function handleEvent(evt: SSEEvent, onTool?: (t: ToolResult) => void) {
        switch (evt.type) {
          case "status":
            setState((s) => ({ ...s, status: evt.label ?? "" }));
            break;
          case "reasoning":
            buf.current.reasoning += evt.text;
            schedule();
            break;
          case "delta":
            buf.current.text += evt.text;
            schedule();
            break;
          case "discussion":
            turnsRef.current = [...turnsRef.current, evt.turn];
            schedule();
            break;
          case "tool":
            onTool?.(evt.tool);
            break;
          case "error":
            setState((s) => ({ ...s, error: evt.message }));
            break;
          case "done":
            break;
        }
      }
    },
    [flush, schedule],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, streaming: false, status: "" }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    buf.current = { text: "", reasoning: "" };
    turnsRef.current = [];
    setState(EMPTY);
  }, []);

  return { state, start, stop, reset };
}
