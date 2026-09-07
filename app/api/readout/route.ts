import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
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
  const refused = limited(req, "readout");
  if (refused) return refused;

  const read = await readJson(req);
  if (!read.ok) return read.res;
  const b = read.body as Record<string, unknown>;

  const assessmentId = typeof b.assessmentId === "string" ? b.assessmentId : "";
  const side = b.side === "sell" ? "sell" : "buy";
  if (!assessmentId) {
    return NextResponse.json({ ok: false, error: "assessmentId required" }, { status: 400 });
  }

  /* Validated here rather than trusted, because these rows carry the product's
     central claim — every figure states what it assumes and where it could be
     wrong. A row that cannot say both is rejected by the database; sending one
     that will be rejected is a bug worth catching before the round trip. */
  const tracked = (Array.isArray(b.trackedFigures) ? b.trackedFigures : [])
    .map((f) => f as Record<string, unknown>)
    .filter((f) =>
      typeof f.label === "string" &&
      typeof f.valueCents === "number" &&
      Number.isFinite(f.valueCents) &&
      Array.isArray(f.assumptions) &&
      f.assumptions.length > 0 &&
      typeof f.couldBeWrong === "string" &&
      f.couldBeWrong.length > 20)
    .slice(0, 12)
    .map((f) => ({
      label: f.label as string,
      valueCents: f.valueCents as number,
      assumptions: f.assumptions as { label: string; value: string }[],
      couldBeWrong: f.couldBeWrong as string,
      ceiling: (f.ceiling === "reviewed" ? "reviewed" : "verified") as "reviewed" | "verified",
    }));

  const r = await saveReadout({
    assessmentId,
    side,
    inputs: (b.inputs ?? {}) as Record<string, unknown>,
    figures: (b.figures ?? {}) as Record<string, unknown>,
    matched: Array.isArray(b.matched) ? b.matched : [],
    trackedFigures: tracked,
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "readout.save" });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, shareToken: r.data.shareToken });
}
