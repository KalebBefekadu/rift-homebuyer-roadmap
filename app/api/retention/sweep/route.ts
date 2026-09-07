import { NextResponse } from "next/server";
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
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set — refusing to run" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const r = await sweep(new Date());
  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "retention.sweep" });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, ...r.data });
}
