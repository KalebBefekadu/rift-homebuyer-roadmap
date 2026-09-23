import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/db/guard";
import { due, claimStep, markTouch } from "@/lib/db/nurture";
import { sendTouch, sendResume } from "@/lib/db/email";
import { runOptions } from "@/lib/core/nurture";
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
 * Two dials, both off the URL: see lib/core/nurture.ts:
 *
 *   ?dry=1   walk the whole queue and report it, claiming nothing and sending
 *            nothing. The one way to find out what the first real run will do
 *            BEFORE it does it.
 *   ?max=N   a ceiling on sends. Defaults to a cap rather than to unlimited,
 *            because the due cohort accumulates whether or not sending is
 *            switched on, and the first run after an address is configured
 *            would otherwise reach everybody at once through code that has
 *            never sent a real message.
 *
 * Order matters and is deliberate: claim, then send, then record the outcome.
 * A crash between sending and recording would otherwise send the same message
 * again on the next run, and the person on the other end has no way to know it
 * was a bug rather than a company that does not pay attention.
 */
async function run(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;

  const { dry, max } = runOptions(req.url);

  const queue = await due(new Date());
  if (!queue.ok) {
    captureOpError(new Error(queue.error), { op: "nurture.run" });
    return NextResponse.json({ ok: false, error: queue.error }, { status: 200 });
  }
  if ("skipped" in queue) return NextResponse.json({ ok: true, skipped: true, reason: queue.reason });

  /* Four counts, not two. "Held for the agent" and "we could not send it" are
     different facts and lumping them together sends somebody looking for a task
     that does not exist, which is exactly what the first live run did. */
  let sent = 0, held = 0, notConfigured = 0, failedCount = 0;
  /* Fifth: still due, not attempted, because this run had used up its budget.
     Nothing is lost (it is due again tomorrow) but a run that silently drops
     the tail is indistinguishable from a run with nothing left to do. */
  let deferred = 0;
  /* A dry run's only output. Who, which step, and what would have gone: the
     three things you need to decide whether to let it loose. */
  const plan: { to: string; stepId: string; band: string; kind: "readout" | "resume" }[] = [];

  for (const t of queue.data) {
    if (!t.auto) { held++; continue; }
    if (t.channel !== "email" || !t.email) { held++; continue; }

    /* The cap counts everything this run would put in front of a person,
       including a dry run's plan. A preview that silently shows the first
       twenty-five of two hundred is the same lie as a send that stops there
       without saying so: both are reported, neither is hidden. */
    if (plan.length + sent + failedCount + notConfigured >= max) { deferred++; continue; }

    if (dry) {
      plan.push({ to: t.email, stepId: t.stepId, band: t.band, kind: t.figures ? "readout" : "resume" });
      continue;
    }

    const claim = await claimStep(t.enrolmentId, t.stepId, t.channel, t.downgraded);
    if (!claim.ok || "skipped" in claim || !claim.data.claimed) { notConfigured++; continue; }

    const origin = new URL(req.url).origin;

    /* Two kinds of touch, because two kinds of person.
       
       Somebody who finished has a readout, and the email leads with their
       figures. Somebody who stopped has none: that is why they are in the
       dormant sequence at all, so leading with figures would refuse to send
       and the largest population in the funnel would never hear from us. They
       get a resume link and how far they got, and nothing about what they
       might be missing. Recovery, not pursuit. */
    const res = t.figures
      ? await sendTouch({
          to: t.email,
          name: t.name,
          says: t.says,
          body: t.body,
          shareUrl: t.shareToken ? `${origin}/r/${t.shareToken}` : `${origin}/buy`,
          county: t.county,
          figures: t.figures,
        })
      : await sendResume({
          to: t.email,
          name: t.name,
          says: t.says,
          body: t.body,
          resumeUrl: `${origin}/${t.side}/start`,
          answered: t.answered,
          of: t.of,
          /* The dormant sequence's closing touch says outright that it is the
             last one. A list you cannot stop sending to is a liability. */
          last: t.stepId === "d2",
        });

    if (res.ok && !("skipped" in res)) { sent++; continue; }
    if (res.ok) {
      /* Recorded as skipped WITH its reason, so "email is switched off" and
         "this person has no readout to talk about" stay distinguishable in the
         touches table. They need different fixes. */
      await markTouch(t.enrolmentId, t.stepId, "skipped", "reason" in res ? res.reason : undefined);
      notConfigured++;
      continue;
    }

    /* A failed send becomes a task rather than a log line. A bounced touch
       looks exactly like disinterest from the outside, and an agent who writes
       somebody off for a dead mailbox has lost a client to a typo. */
    await markTouch(t.enrolmentId, t.stepId, "failed", res.error);
    captureOpError(new Error(res.error), { op: "nurture.send", extra: { stepId: t.stepId, band: t.band } });
    failedCount++;
  }

  return NextResponse.json({
    ok: true,
    /* Said outright, at the top. A dry run's body is otherwise shaped exactly
       like a real one's, and a reader who assumes the wrong one has either
       panicked over nothing or relaxed about something that already went. */
    dry,
    max,
    due: queue.data.length,
    sent,
    /* Steps waiting on the agent are reported, never hidden. A queue that only
       counts what it did makes the human half invisible. */
    heldForAgent: held,
    /* Wanted to send and could not, because email is not switched on. Not the
       agent's task and not an error: a configuration gap, and it should read
       as one. */
    notConfigured,
    failed: failedCount,
    deferred,
    ...(dry ? { wouldSend: plan } : {}),
  });
}

/* Both verbs, same job. Vercel's scheduler sends GET; a human running this by
   hand sends POST. Exporting only POST is how this endpoint spent its whole
   life returning 405 to the scheduler while every check said it was fine:
   see lib/core/cron.ts. */
export const GET = run;
export const POST = run;
