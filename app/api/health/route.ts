import { NextResponse } from "next/server";
import { serviceClient, currentAgentId } from "@/lib/db/service";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";
import { currentRate } from "@/lib/db/rates";
import { overdue } from "@/lib/db/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is it working, and what is not configured?
 *
 * Deliberately reports readiness rather than only liveness. A process that is
 * running but cannot reach its database, or has no agent row, is up and
 * useless, and every write in the product degrades silently and honestly in
 * that state, which is correct behaviour and also means nobody finds out.
 * This is where somebody finds out.
 *
 * It names what is missing but never what is configured: no URLs, no key
 * fragments, no version strings. A health endpoint that describes the stack is
 * a reconnaissance endpoint, and this one is public because a monitor needs it
 * to be.
 *
 * 200 when it can do its job, 503 when it cannot. Anything degraded but
 * functional stays 200 with a note: paging somebody at 3am because SMS is not
 * wired yet is how alerts get muted.
 */
/**
 * The retention answer, cached.
 *
 * This endpoint is public and deliberately unauthenticated: a monitor needs
 * it to be, and the outcome check below costs four queries. Running them on
 * every request turns a health check into a four-times amplifier for anyone
 * with a loop, which is a poor trade for a question whose answer changes at
 * most once a day.
 *
 * Per-instance and in memory, like the rate limiter, and for the same reason:
 * the alternative is a shared store to defend against an adversary nobody has.
 */
const RETENTION_TTL_MS = 5 * 60_000;
let retentionCache: { at: number; value: string } | null = null;

async function retentionCheck(): Promise<string> {
  const now = Date.now();
  if (retentionCache && now - retentionCache.at < RETENTION_TTL_MS) return retentionCache.value;

  const late = await overdue();
  const value = !late.ok || "skipped" in late
    ? "unknown"
    : late.data.overdue ? "overdue: records past their deletion date" : "clear";

  /* A failed lookup is not cached. "Unknown" because the database blipped
     should clear on the next request rather than persist for five minutes. */
  if (value !== "unknown") retentionCache = { at: now, value };
  return value;
}

/**
 * Whether Brevo will actually send, asked of Brevo.
 *
 * This reported "configured" the moment two environment variables existed.
 * Brevo refuses to send from an address it has not verified, and this account
 * has IP allowlisting on: a request from an address it does not recognise
 * gets a 401 whatever the key. Serverless functions do not have fixed
 * addresses. So "configured" could be permanently true of an integration that
 * had never delivered, and would never deliver: the scheduler bug again, in a
 * different coat.
 *
 * Cached for ten minutes. This endpoint is public, and a health check that
 * spends the sender's API quota on every monitor ping is its own outage.
 * Only a status word leaves this function: never the key, never an address.
 */
const EMAIL_TTL_MS = 10 * 60_000;
let emailCache: { at: number; value: string } | null = null;

async function emailCheck(deep: boolean): Promise<string> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;
  if (!key) return "missing";
  if (!from) return "no verified sender";

  /* Only when asked by somebody holding the cron secret.

     The first version probed Brevo on any public request. Brevo's IP review
     emails the account owner: "someone tried to use your organization account
     from an IP address you have never used": for every new address that
     calls, and serverless functions run from a pool of changing addresses. So
     a public health endpoint that asked Brevo anything turned every cold
     instance into a security alert in Kaleb's inbox. A check that makes its
     owner wonder whether he has been breached is not a health check. */
  if (!deep) return "set, not verified (deep check requires the cron secret)";

  const now = Date.now();
  if (emailCache && now - emailCache.at < EMAIL_TTL_MS) return emailCache.value;

  let value: string;
  try {
    const res = await fetch("https://api.brevo.com/v3/senders", {
      headers: { accept: "application/json", "api-key": key },
      signal: AbortSignal.timeout(4000),
    });
    const body = await res.text();
    if (res.status === 401 && /unrecognised IP/i.test(body)) {
      value = "blocked: Brevo's IP allowlist refuses this server";
    } else if (!res.ok) {
      value = `refused by Brevo (${res.status})`;
    } else {
      const senders = (JSON.parse(body).senders ?? []) as { email?: string; active?: boolean }[];
      const match = senders.find((s) => String(s.email).toLowerCase() === from.toLowerCase());
      value = !match ? "sender not registered in Brevo"
        : match.active ? "ready" : "sender awaiting verification";
    }
  } catch {
    /* A timeout is not a verdict. Uncached, so it clears on the next ping. */
    return "unknown: Brevo did not answer";
  }

  emailCache = { at: now, value };
  return value;
}

/**
 * Whether the database answers, asked of the database.
 *
 * This said "configured" whenever SUPABASE_URL was set: and `agent: "ready"`
 * comes from an id cached in memory the first time it was read. A failure
 * drill stopped the data API underneath a running server and this endpoint
 * went on returning `"ok": true`, database configured, agent ready, retention
 * clear: every line green, through a total outage, which is the one moment a
 * health check exists for.
 *
 * One tiny indexed read, on a deadline, every call. Not cached: a check that
 * answers from memory is a check of the memory.
 */
async function databaseProbe(db: NonNullable<ReturnType<typeof serviceClient>>): Promise<boolean> {
  const { value, timedOut } = await withTimeout(
    Promise.resolve(db.from("rift_agents").select("id").limit(1)),
    READ_DEADLINE_MS,
    null,
  );
  return !timedOut && Boolean(value) && !value!.error;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const deep = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  const db = serviceClient();
  const reachable = db ? await databaseProbe(db) : false;
  const agent = db && reachable ? await currentAgentId() : null;

  const checks: Record<string, string> = {
    database: !db ? "missing" : reachable ? "reachable" : "unreachable",
    agent: agent ? "ready" : !db ? "unknown" : reachable ? "not bootstrapped" : "unknown: database unreachable",
    email: await emailCheck(deep),
    calendar: process.env.CAL_API_KEY && process.env.CAL_EVENT_TYPE_ID ? "configured" : "missing",
    /* "Configured" is not "working", and conflating them cost this product
       every scheduled run it ever had. The secret was set, this said
       "configured", and both cron routes were answering the scheduler with a
       405 because they only exported POST. See lib/core/cron.ts. What is
       reported below is the OUTCOME, whether anything is still here that the
       retention promise says should already be gone, which goes red however
       the job stops, including in a way nobody predicted. */
    scheduler: process.env.CRON_SECRET ? "configured" : "missing",
    monitoring: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN ? "configured" : "missing",
  };

  if (db && agent) {
    const rate = await currentRate();
    /* The rate is the assumption the most figures depend on, and letting it
       lapse produces wrong numbers rather than errors. Worth a monitor. */
    checks.rate = rate.freshness === "fresh" ? "fresh" : `${rate.freshness} (${rate.asOf || "never recorded"})`;

    /* Yes or no, never a count. This endpoint is public, and how many people
       are in the funnel is not a figure to hand to whoever asks. */
    checks.retention = await retentionCheck();
  }

  /* Only the two that stop the product doing its job are fatal. The rest are
     features that degrade honestly and say so on screen: including an overdue
     sweep, which is a promise being broken rather than a service being down,
     and belongs in somebody's morning rather than in their night. */
  const ready = Boolean(db && agent);

  return NextResponse.json(
    { ok: ready, checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
