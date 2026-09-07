import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { recordEvents, isEventName, type EventInput } from "@/lib/db/events";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
/* Never cached. An analytics endpoint served from a cache silently stops
   recording, and the symptom is a funnel report that looks quiet. */
export const dynamic = "force-dynamic";

/**
 * Telemetry intake.
 *
 * Batched by the client, because one request per question turns a
 * seven-question assessment into seven blocking network calls on a phone with
 * two bars — and the assessment is the product's revenue path.
 *
 * Always returns 200 on a well-formed request, even when the database is
 * unconfigured or the write fails. Instrumentation must never break a funnel:
 * a visitor losing their assessment because an analytics table was full would
 * be an absurd way to lose a client. Failures go to Sentry, where somebody can
 * act on them, and the response says plainly what happened.
 */

const MAX_BATCH = 40;

export async function POST(req: Request) {
  const refused = limited(req, "events");
  if (refused) return refused;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const raw = Array.isArray((body as { events?: unknown })?.events)
    ? ((body as { events: unknown[] }).events)
    : null;
  if (!raw) return NextResponse.json({ ok: false, error: "expected { events: [] }" }, { status: 400 });
  if (raw.length > MAX_BATCH) {
    return NextResponse.json({ ok: false, error: `at most ${MAX_BATCH} events per request` }, { status: 400 });
  }

  const events: EventInput[] = [];
  for (const e of raw) {
    const o = e as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    const sessionId = typeof o.sessionId === "string" ? o.sessionId.slice(0, 64) : "";
    /* An unknown event name is dropped rather than stored. A taxonomy that
       accepts anything is not a taxonomy, and the first typo becomes a
       permanent column in somebody's report. */
    if (!sessionId || !isEventName(name)) continue;
    events.push({
      sessionId,
      name,
      side: o.side === "buy" || o.side === "sell" ? o.side : undefined,
      questionKey: typeof o.questionKey === "string" ? o.questionKey.slice(0, 64) : undefined,
      dwellMs: typeof o.dwellMs === "number" && Number.isFinite(o.dwellMs) ? o.dwellMs : undefined,
      meta: (o.meta ?? undefined) as Record<string, string | number | boolean> | undefined,
    });
  }

  const result = await recordEvents(events);

  if (!result.ok) {
    captureOpError(new Error(result.error), {
      op: "events.record",
      extra: { count: events.length, dropped: raw.length - events.length },
    });
    return NextResponse.json({ ok: false, recorded: 0, error: result.error }, { status: 200 });
  }

  if ("skipped" in result) {
    return NextResponse.json({ ok: true, recorded: 0, skipped: true, reason: result.reason });
  }

  return NextResponse.json({
    ok: true,
    recorded: result.data.written,
    dropped: raw.length - events.length,
  });
}
