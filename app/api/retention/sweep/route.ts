import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/db/guard";
import { sweep } from "@/lib/db/retention";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Enforces the retention schedule.
 *
 * Scheduled, secret-protected, and reports exactly what it removed. A deletion
 * job that runs silently is one nobody notices has stopped running — and the
 * failure mode of a stopped retention job is a growing pile of strangers'
 * finances that the product's own readout promises has already been deleted.
 */
async function run(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;

  const r = await sweep(new Date());
  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "retention.sweep" });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, ...r.data });
}

/* See the note in app/api/nurture/run/route.ts. The scheduler sends GET. */
export const GET = run;
export const POST = run;
