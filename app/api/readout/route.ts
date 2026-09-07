import { NextResponse } from "next/server";
import { saveReadout } from "@/lib/db/assessments";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saves the snapshot and returns a share link.
 *
 * The figures are sent by the client because the client has just been shown
 * them, and the snapshot's whole job is to record *what was shown* — not what
 * the server would compute again a moment later. That is the one case in this
 * codebase where trusting the client is correct rather than lazy: a snapshot
 * the server recomputed would not be a snapshot.
 *
 * It is safe because nothing downstream treats these figures as authoritative.
 * The plan recomputes from `inputs` and discloses any difference; the snapshot
 * is evidence of a promise, not an input to one.
 */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const assessmentId = typeof b.assessmentId === "string" ? b.assessmentId : "";
  const side = b.side === "sell" ? "sell" : "buy";
  if (!assessmentId) {
    return NextResponse.json({ ok: false, error: "assessmentId required" }, { status: 400 });
  }

  const r = await saveReadout({
    assessmentId,
    side,
    inputs: (b.inputs ?? {}) as Record<string, unknown>,
    figures: (b.figures ?? {}) as Record<string, unknown>,
    matched: Array.isArray(b.matched) ? b.matched : [],
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "readout.save" });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, shareToken: r.data.shareToken });
}
