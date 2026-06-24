import type { SSEEvent } from "../types";

/**
 * Create a streaming Response backed by an async producer that emits
 * SSE events. The producer receives an `emit` function and the request's
 * AbortSignal. Cancellation (client disconnect / Stop button) propagates
 * via the signal so upstream provider fetches are aborted.
 */
export function createSSEResponse(
  producer: (emit: (e: SSEEvent) => void, signal: AbortSignal) => Promise<void>,
  upstreamSignal?: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const controller = new AbortController();

  // Link the request's signal so client disconnects abort our work.
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let closed = false;
      const emit = (e: SSEEvent) => {
        if (closed) return;
        try {
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        if (closed) return;
        closed = true;
        try {
          ctrl.close();
        } catch {
          /* already closed */
        }
      };
      controller.signal.addEventListener("abort", onAbort, { once: true });

      try {
        await producer(emit, controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          emit({ type: "error", message: "Request failed. Please try again." });
          console.error("[sse] producer error:", err);
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            ctrl.close();
          } catch {
            /* ignore */
          }
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
