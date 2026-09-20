import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/db/guard";
import { readPmms, PMMS_HISTORY_URL, PMMS_SOURCE } from "@/lib/core/pmms";
import { recordRate, currentRate } from "@/lib/db/rates";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Fetches the week's mortgage rate and records it.
 *
 * The rate is the assumption the most figures in this product depend on, and
 * the only one that moves weekly. Recorded by hand it went ten weeks without
 * being recorded at all, during which every monthly payment shown to every
 * visitor used a 6.5% starting assumption — correctly labelled as one, and
 * still not the market.
 *
 * Freddie Mac publishes the primary mortgage market survey as a CSV, so this
 * is a read of an authoritative file rather than a scrape of a page. It runs
 * Fridays, the morning after Thursday's publication.
 *
 * Nothing here guesses. A file it cannot parse leaves the existing rate in
 * place to go on ageing visibly, which is the correct outcome: an ageing rate
 * says so on every figure it touches, and a wrong rate does not.
 *
 * `?dry=1` fetches and parses without writing.
 */
async function run(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;

  const dry = new URL(req.url).searchParams.get("dry");
  const isDry = dry !== null && dry !== "0" && dry.toLowerCase() !== "false";

  let csv: string;
  try {
    /* No cache. A rate endpoint served a week-old copy of the file would
       produce a run that reports success and records nothing new, which is the
       exact failure this job exists to end. */
    const res = await fetch(PMMS_HISTORY_URL, {
      cache: "no-store",
      headers: { accept: "text/csv,text/plain" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      captureOpError(new Error(`PMMS returned ${res.status}`), { op: "rate.fetch" });
      return NextResponse.json({ ok: false, error: `the rate file returned ${res.status}` }, { status: 200 });
    }
    csv = await res.text();
  } catch (e) {
    captureOpError(e, { op: "rate.fetch" });
    return NextResponse.json({ ok: false, error: "the rate file could not be fetched" }, { status: 200 });
  }

  const reading = readPmms(csv);
  if (!reading.ok) {
    /* A refusal is reported to Sentry, not swallowed. This is the branch that
       fires when Freddie Mac changes the file's shape, and it is the only
       warning anyone will get before the rate silently stops updating. */
    captureOpError(new Error(reading.reason), { op: "rate.parse" });
    return NextResponse.json({ ok: false, error: reading.reason }, { status: 200 });
  }

  /* Reported whether or not it wrote. Publication stalling produces a run of
     successful-looking runs recording the same number, and that is exactly
     what nobody notices. */
  if (reading.lagging) {
    captureOpError(new Error(`the published rate is ${reading.lagDays} days old`), { op: "rate.lag" });
  }

  if (isDry) {
    const now = await currentRate();
    return NextResponse.json({
      ok: true, dry: true,
      published: { pct: reading.pct, asOf: reading.asOf, lagDays: reading.lagDays, lagging: reading.lagging },
      recorded: { pct: now.pct, asOf: now.asOf, freshness: now.freshness },
      wouldChange: now.pct !== reading.pct || now.asOf !== reading.asOf,
    });
  }

  const wrote = await recordRate({
    pct: reading.pct,
    asOf: reading.asOf,
    source: PMMS_SOURCE,
    sourceUrl: PMMS_HISTORY_URL,
  });

  if (!wrote.ok) {
    captureOpError(new Error(wrote.error), { op: "rate.record" });
    return NextResponse.json({ ok: false, error: wrote.error }, { status: 200 });
  }
  if ("skipped" in wrote) return NextResponse.json({ ok: true, skipped: true, reason: wrote.reason });

  return NextResponse.json({
    ok: true,
    pct: wrote.data.pct,
    asOf: wrote.data.asOf,
    lagDays: reading.lagDays,
    lagging: reading.lagging,
    source: PMMS_SOURCE,
  });
}

/* Both verbs — Vercel's scheduler sends GET. See lib/core/cron.ts for what
   exporting only POST cost this product last time. */
export const GET = run;
export const POST = run;
