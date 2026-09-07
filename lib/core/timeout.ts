/**
 * A deadline for work that has a fallback.
 *
 * The readout is the revenue path and it renders from a registry read. If that
 * read FAILS the page falls back to the built-in registry — real, verified data
 * — and the visitor gets their numbers. If it HANGS there is no fallback,
 * because nothing has failed yet: the page waits until the platform kills the
 * function and the visitor sees nothing at all.
 *
 * A slow database is a more likely outage than a broken one, and it was the
 * only kind this product had no answer for.
 *
 * Deliberately not applied everywhere. A deadline only helps where there is
 * something sensible to do when it expires; on a write, giving up early and
 * reporting success would be worse than waiting. So this is used on reads that
 * have a documented fallback, and nowhere else.
 */

export interface Deadline<T> {
  value: T;
  /** True when the work did not finish in time and the fallback was used. */
  timedOut: boolean;
}

export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<Deadline<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });

  try {
    const result = await Promise.race([work, expiry]);
    if (result === "timeout") return { value: fallback, timedOut: true };
    return { value: result as T, timedOut: false };
  } finally {
    /* The losing promise keeps running — there is no cancelling a query that
       is already in flight. Clearing the timer stops it holding the event loop
       open, which on a serverless runtime is the difference between a function
       that returns and one that is billed until it is killed. */
    if (timer) clearTimeout(timer);
  }
}

/**
 * How long the customer-facing path waits before falling back.
 *
 * Chosen against the visitor rather than the database: past about two seconds
 * on a phone people leave, so waiting longer for a better answer trades a
 * certainty for a possibility.
 */
export const READ_DEADLINE_MS = 2_000;

/**
 * Longer than a read, because there is no fallback worth rushing to and the
 * work may genuinely be slow — but bounded, because an unbounded write is a
 * held-open function rather than a patient one.
 *
 * A miss is reported as a failure, so the caller can surface it and Sentry can
 * carry it. What it must never do is return success.
 */
export const WRITE_DEADLINE_MS = 6_000;
