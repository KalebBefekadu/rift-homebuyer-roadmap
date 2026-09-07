import { NextResponse } from "next/server";
import { serviceClient, currentAgentId } from "@/lib/db/service";
import { currentRate } from "@/lib/db/rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is it working, and what is not configured?
 *
 * Deliberately reports readiness rather than only liveness. A process that is
 * running but cannot reach its database, or has no agent row, is up and
 * useless — and every write in the product degrades silently and honestly in
 * that state, which is correct behaviour and also means nobody finds out.
 * This is where somebody finds out.
 *
 * It names what is missing but never what is configured: no URLs, no key
 * fragments, no version strings. A health endpoint that describes the stack is
 * a reconnaissance endpoint, and this one is public because a monitor needs it
 * to be.
 *
 * 200 when it can do its job, 503 when it cannot. Anything degraded but
 * functional stays 200 with a note — paging somebody at 3am because SMS is not
 * wired yet is how alerts get muted.
 */
export async function GET() {
  const db = serviceClient();
  const agent = db ? await currentAgentId() : null;

  const checks: Record<string, string> = {
    database: db ? "configured" : "missing",
    agent: agent ? "ready" : db ? "not bootstrapped" : "unknown",
    email: process.env.BREVO_API_KEY
      ? (process.env.BREVO_FROM_EMAIL ? "configured" : "no verified sender")
      : "missing",
    calendar: process.env.CAL_API_KEY && process.env.CAL_EVENT_TYPE_ID ? "configured" : "missing",
    scheduler: process.env.CRON_SECRET ? "configured" : "missing",
    monitoring: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN ? "configured" : "missing",
  };

  if (db && agent) {
    const rate = await currentRate();
    /* The rate is the assumption the most figures depend on, and letting it
       lapse produces wrong numbers rather than errors. Worth a monitor. */
    checks.rate = rate.freshness === "fresh" ? "fresh" : `${rate.freshness} (${rate.asOf || "never recorded"})`;
  }

  /* Only the two that stop the product doing its job are fatal. The rest are
     features that degrade honestly and say so on screen. */
  const ready = Boolean(db && agent);

  return NextResponse.json(
    { ok: ready, checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
