import "server-only";
import { withTimeout, READ_DEADLINE_MS, WRITE_DEADLINE_MS } from "@/lib/core/timeout";
import { failed, type DbResult } from "./result";

/**
 * Runs a Supabase query against a deadline.
 *
 * Written after wrapping three call sites by hand and realising there were ten
 * more. Hand-rolled deadlines drift: one gets the wrong constant, one forgets
 * `Promise.resolve` on a thenable builder, one reports success on timeout. The
 * last of those is the failure this whole idea exists to prevent, so the
 * wrapping should happen in one place.
 *
 * `Promise.resolve` is not decoration — supabase-js returns a thenable builder
 * rather than a real Promise, and `Promise.race` will not accept one.
 */
type Query<T> = PromiseLike<{ data: T; error: { message: string } | null }>;

async function run<T>(query: Query<T>, ms: number, what: string): Promise<DbResult<T>> {
  const { value, timedOut } = await withTimeout(
    Promise.resolve(query),
    ms,
    null as { data: T; error: { message: string } | null } | null,
  );

  /* A miss is a FAILURE, never a skip and never a success. "Skipped" means the
     product chose not to do this; a timeout means it tried and cannot say
     whether it worked, and those must not read the same. */
  if (timedOut || !value) return failed(`${what} did not complete in time`);
  if (value.error) return failed(value.error.message);
  return { ok: true, data: value.data };
}

/** For a write a visitor or the agent is waiting on. */
export const boundedWrite = <T>(query: Query<T>, what: string) =>
  run(query, WRITE_DEADLINE_MS, what);

/** For a read that has no fallback and must not hold a request open. */
export const boundedRead = <T>(query: Query<T>, what: string) =>
  run(query, READ_DEADLINE_MS, what);
