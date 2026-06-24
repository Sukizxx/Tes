import { ProviderError } from "./openai-compat";

/**
 * Run an async producer with auto-retry on light/transient errors.
 * Max 3 attempts (spec: AUTO RETRY ≤ 3). Non-retryable errors and
 * user aborts propagate immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; signal?: AbortSignal; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 600;
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) {
      throw new ProviderError("Request cancelled.", false);
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ProviderError ? err.retryable : true;
      const isLast = i === attempts - 1;
      if (!retryable || isLast || opts.signal?.aborted) break;
      // Exponential-ish backoff with a small ceiling.
      const delay = Math.min(baseDelay * Math.pow(2, i), 4000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Run several model producers and return the first that succeeds.
 * Implements FAILOVER + AUTO SKIP: a failing model is skipped and the
 * next is tried. Throws only if ALL fail.
 */
export async function withFailover<T>(
  producers: { label: string; fn: () => Promise<T> }[],
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown;
  for (const p of producers) {
    if (signal?.aborted) throw new ProviderError("Request cancelled.", false);
    try {
      return await p.fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[failover] ${p.label} failed, skipping:`, errMsg(err));
    }
  }
  throw lastErr ?? new ProviderError("All models failed.", false);
}

export function errMsg(err: unknown): string {
  if (err instanceof ProviderError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

/** Map any error to a clean, user-facing message (no stack traces). */
export function friendlyError(err: unknown): string {
  if (err instanceof ProviderError) {
    if (err.message === "Request cancelled.") return err.message;
    return err.message;
  }
  return "Request failed. Please try again.";
}
