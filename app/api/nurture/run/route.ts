import { NextResponse } from "next/server";
import { due, claimStep, markTouch } from "@/lib/db/nurture";
import { sendReadout } from "@/lib/db/email";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends what the cadence owes today.
 *
 * Called by a scheduler, not by a browser. It is protected by a shared secret
 * rather than a session because there is no user: an unauthenticated endpoint
 * that sends email on demand is a way to have your sending reputation destroyed
 * by a stranger with curl.
 *
 * Only AUTOMATIC steps are sent. Calls and steps marked "needs him" are left in
 * the queue for the agent, because a product that auto-dials on somebody's
 * behalf has decided something that was not its to decide.
 *
 * Order matters and is deliberate: claim, then send, then record the outcome.
 * A crash between sending and recording would otherwise send the same message
 * again on the next run, and the person on the other end has no way to know it
 * was a bug rather than a company that does not pay attention.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set — refusing to run" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const queue = await due(new Date());
  if (!queue.ok) {
    captureOpError(new Error(queue.error), { op: "nurture.run" });
    return NextResponse.json({ ok: false, error: queue.error }, { status: 200 });
  }
  if ("skipped" in queue) return NextResponse.json({ ok: true, skipped: true, reason: queue.reason });

  let sent = 0, held = 0, failedCount = 0;

  for (const t of queue.data) {
    if (!t.auto) { held++; continue; }
    if (t.channel !== "email" || !t.email) { held++; continue; }

    const claim = await claimStep(t.enrolmentId, t.stepId, t.channel, t.downgraded);
    if (!claim.ok || "skipped" in claim || !claim.data.claimed) { held++; continue; }

    const res = await sendReadout({
      to: t.email,
      name: t.name,
      shareUrl: `${new URL(req.url).origin}/buy`,
      cashToClose: 0,
      gap: 0,
      monthsToClose: null,
      county: "your",
    });

    if (res.ok && !("skipped" in res)) { sent++; continue; }
    if (res.ok) { await markTouch(t.enrolmentId, t.stepId, "skipped", "reason" in res ? res.reason : undefined); held++; continue; }

    /* A failed send becomes a task rather than a log line. A bounced touch
       looks exactly like disinterest from the outside, and an agent who writes
       somebody off for a dead mailbox has lost a client to a typo. */
    await markTouch(t.enrolmentId, t.stepId, "failed", res.error);
    captureOpError(new Error(res.error), { op: "nurture.send", extra: { stepId: t.stepId, band: t.band } });
    failedCount++;
  }

  return NextResponse.json({
    ok: true,
    due: queue.data.length,
    sent,
    /* Steps waiting on the agent are reported, never hidden. A queue that only
       counts what it did makes the human half invisible. */
    heldForAgent: held,
    failed: failedCount,
  });
}
