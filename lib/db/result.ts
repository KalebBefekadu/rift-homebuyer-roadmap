import "server-only";

/**
 * How every database call reports itself.
 *
 * `skipped` is the one that matters and the one a plain `try/catch` loses. An
 * unconfigured database and a failed write are completely different events: the
 * first is expected in development, the second is an incident. Collapsing them
 * into "didn't work" is how a product ends up silently not recording anything
 * in production while every local run looks fine.
 *
 * The shape mirrors `lib/brevo/sync.ts`, which is the reference for this in
 * docs/integrations.md.
 */
export type DbResult<T> =
  | { ok: true; data: T }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export const skipped = (reason: string) => ({ ok: true as const, skipped: true as const, reason });
export const done = <T>(data: T) => ({ ok: true as const, data });
export const failed = (error: unknown) => ({
  ok: false as const,
  error: error instanceof Error ? error.message : String(error),
});

/*
 * There is deliberately no `hasData` helper.
 *
 * One existed and nothing used it: every caller narrows inline with
 * `r.ok && "data" in r`, which reads clearly at the call site and needs no
 * import. A helper nobody reaches for is a second way to do the same thing,
 * and the second way is the one that drifts.
 */
