import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { saveAnswer } from "@/lib/db/assessments";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stores one answer.
 *
 * This is the only endpoint that accepts an answer VALUE, and it writes to
 * `rift_answers` — never to `rift_events`. The separation is the privacy rule:
 * telemetry knows which question somebody stopped on; only this table knows
 * what they said, and the two have different retention and different deletion.
 */
export async function POST(req: Request) {
  const refused = limited(req, "assessment");
  if (refused) return refused;

  try {
    const read = await readJson(req);
    if (!read.ok) return read.res;
    const b = read.body as { assessmentId?: unknown; questionKey?: unknown; value?: unknown };
    const assessmentId = typeof b.assessmentId === "string" ? b.assessmentId : "";
    const questionKey = typeof b.questionKey === "string" ? b.questionKey.slice(0, 64) : "";
    if (!assessmentId || !questionKey) {
      return NextResponse.json({ ok: false, error: "assessmentId and questionKey required" }, { status: 400 });
    }
    /* Values are stored as given but bounded. An unbounded string on a public
       endpoint is a way to fill somebody else's database. */
    const value = typeof b.value === "string" ? b.value.slice(0, 500) : b.value;

    const r = await saveAnswer(assessmentId, questionKey, value);
    if (!r.ok) {
      captureOpError(new Error(r.error), { op: "assessment.answer", extra: { questionKey } });
      return NextResponse.json({ ok: false, error: r.error });
    }
    if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}
