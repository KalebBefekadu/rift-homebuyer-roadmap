import { NextResponse } from "next/server";
import { completeAssessment } from "@/lib/db/assessments";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { assessmentId?: unknown };
    const assessmentId = typeof b.assessmentId === "string" ? b.assessmentId : "";
    if (!assessmentId) return NextResponse.json({ ok: false, error: "assessmentId required" }, { status: 400 });

    const r = await completeAssessment(assessmentId);
    if (!r.ok) {
      captureOpError(new Error(r.error), { op: "assessment.complete" });
      return NextResponse.json({ ok: false, error: r.error });
    }
    if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}
