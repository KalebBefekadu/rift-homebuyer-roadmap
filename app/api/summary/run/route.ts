import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/db/guard";
import { trackedCron } from "@/lib/db/jobs";
import { currentAgentEmail } from "@/lib/db/service";
import { summaryParts } from "@/lib/db/summary";
import { sendDailySummary } from "@/lib/db/email";
import { buildDailySummary, summaryWindow } from "@/lib/core/summary";
import { runOptions } from "@/lib/core/nurture";
import { siteUrl } from "@/lib/core/site";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The agent's morning summary (W12; decision D07: business hours, one summary
 * a day instead of instant alerts). Scheduled Monday to Friday; a federal
 * holiday is skipped here, and the next business morning covers it.
 *
 * `?dry=1` builds it and answers with the subject and counts, sending nothing.
 * An empty summary is not sent: a daily email that says "nothing" teaches its
 * reader to stop opening it.
 */
async function run(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;
  const { dry } = runOptions(req.url);

  const now = new Date();
  const window = summaryWindow(now);
  if (!window.businessDay) return NextResponse.json({ ok: true, sent: false, reason: "not a business day" });

  const parts = await summaryParts(window.since, now);
  if (!parts.ok) {
    captureOpError(new Error(parts.error), { op: "summary.read" });
    return NextResponse.json({ ok: false, error: parts.error });
  }
  if ("skipped" in parts) return NextResponse.json({ ok: true, sent: false, reason: parts.reason });

  const built = buildDailySummary({ day: window.day, ...parts.data, studioUrl: `${siteUrl() ?? ""}/operations` });
  const counts = {
    activity: parts.data.activity.length, dates: parts.data.dates.length,
    jobs: parts.data.jobs.length, leads: parts.data.leads.length,
  };
  if (!built) return NextResponse.json({ ok: true, dry, sent: false, reason: "nothing to report", counts });
  if (dry) return NextResponse.json({ ok: true, dry, sent: false, subject: built.subject, counts });

  const to = await currentAgentEmail();
  if (!to) return NextResponse.json({ ok: false, error: "no agent address to send the summary to" });
  const sent = await sendDailySummary(to, built);
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error });
  if ("skipped" in sent) return NextResponse.json({ ok: true, sent: false, reason: sent.reason, counts });
  return NextResponse.json({ ok: true, sent: true, counts });
}

/* Both verbs, as every cron here: Vercel's scheduler sends GET (lib/core/cron.ts). */
const tracked = trackedCron("daily-summary", run);
export const GET = tracked;
export const POST = tracked;
