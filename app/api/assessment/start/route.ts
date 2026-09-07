import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { startAssessment } from "@/lib/db/assessments";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const refused = limited(req, "assessment");
  if (refused) return refused;

  try {
    const read = await readJson(req);
    if (!read.ok) return read.res;
    const b = read.body as { sessionId?: unknown; side?: unknown; county?: unknown };
    const sessionId = typeof b.sessionId === "string" ? b.sessionId.slice(0, 64) : "";
    const side = b.side === "buy" || b.side === "sell" ? b.side : null;
    if (!sessionId || !side) {
      return NextResponse.json({ ok: false, error: "sessionId and side required" }, { status: 400 });
    }

    const r = await startAssessment({
      sessionId, side,
      county: typeof b.county === "string" ? b.county : undefined,
    });

    if (!r.ok) {
      captureOpError(new Error(r.error), { op: "assessment.start", extra: { side } });
      /* 200 with no id. The assessment must run whether or not it is being
         recorded — losing a visitor because a database was unreachable would
         be the most expensive possible way to handle an outage. */
      return NextResponse.json({ ok: false, error: r.error });
    }
    if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
    return NextResponse.json({ ok: true, id: r.data.id });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}
