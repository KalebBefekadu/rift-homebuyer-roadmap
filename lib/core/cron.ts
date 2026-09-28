/**
 * Who is allowed to run a scheduled job, and how they are allowed to ask.
 *
 * This is here rather than beside the routes because of the defect it was
 * written to close. Both cron routes were correct in every respect except one:
 * they exported `POST` only, and **Vercel's scheduler invokes a cron path with
 * GET**. Every scheduled run since the crons were added returned 405 and did
 * nothing. Nothing errored, nothing was logged, and `/api/health` went on
 * reporting `scheduler: configured`: because the secret was configured. The
 * job that sends the nurture sequence had never sent one, and the job that
 * enforces the retention promise printed at the bottom of every readout had
 * never deleted a row.
 *
 * So the method is policy now, stated once, tested, and shared by both routes.
 * A third job added later cannot get it wrong in a new way.
 */

/** The methods a scheduler may use. GET is what Vercel sends; POST is for a
 *  human running the job by hand with curl, which is how it gets tested. */
export const CRON_METHODS = ["GET", "POST"] as const;

export type CronVerdict =
  | { ok: true }
  /* 503 rather than 401 when the secret is absent: the caller did nothing
     wrong, the deployment is incomplete, and a monitor should read those
     differently. */
  | { ok: false; status: 503; error: string }
  | { ok: false; status: 401; error: string };

/**
 * Pure, so the rule can be tested without a request.
 *
 * Refuses to run at all when no secret is set. An unauthenticated endpoint
 * that sends email on demand is a way to have a sending reputation destroyed
 * by a stranger with curl, and an unauthenticated endpoint that deletes rows
 * needs no explanation.
 */
export function authoriseCron(authorization: string | null, secret: string | undefined): CronVerdict {
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET is not set, refusing to run" };
  }
  /* Constant time. This used to argue that a timing oracle over a whole
     header across the internet is not the way in, which is probably true; but
     the comparison is one loop, it now also guards /api/health's deep check,
     and a secret compared with `!==` is the first thing any review flags. One
     comparison, done the careful way, rather than a paragraph defending it. */
  if (!sameSecret(authorization ?? "", `Bearer ${secret}`)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

/** Whether two strings are equal, in time that depends only on the expected one. */
function sameSecret(given: string, expected: string): boolean {
  let diff = given.length ^ expected.length;
  /* charCodeAt past the end is NaN, which `^` reads as 0; the length term
     above has already made a shorter string unequal. */
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
