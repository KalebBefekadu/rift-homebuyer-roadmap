import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { captureLead } from "@/lib/db/leads";
import { attachPlan } from "@/lib/db/saved-plan";
import { sendNewLead, sendSavedPlan } from "@/lib/db/email";
import { currentAgentEmail } from "@/lib/db/service";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { cleanPlan, planSummary } from "@/lib/core/saved-plan";
import { siteUrl } from "@/lib/core/site";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Save my plan" and "Ask Kaleb to review my numbers" (Blueprint v5 §5.5).
 *
 * The same capture every other form uses, so a saved plan is a lead with the
 * same scoring, consent record, instant alert (D07a) and deletion path. Then
 * the plan is attached to it with a private link, and the link is emailed.
 *
 * Order matters: the lead first, because that is the relationship and cannot
 * be retried once the tab is closed. The plan, the alert and the email each
 * fail on their own without losing it.
 */
export async function POST(req: Request) {
  const refused = limited(req, "capture");
  if (refused) return refused;
  const read = await readJson(req);
  if (!read.ok) return read.res;
  const b = read.body as Record<string, unknown>;

  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const name = str(b.name, 120);
  const email = str(b.email, 200);
  const phone = str(b.phone, 40);
  const phoneOk = b.phoneConsent === true;

  if (!name) return NextResponse.json({ ok: false, error: "Add your name." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "That email address does not look right." }, { status: 400 });
  }
  if (phone && !phoneOk) {
    return NextResponse.json({ ok: false, error: "A phone number can only be kept with the box ticked." }, { status: 400 });
  }

  const plan = cleanPlan(b);
  const side = plan.side === "sell" ? "sell" : "buy";
  const sessionId = str(b.sessionId, 64);
  const price = typeof plan.answers.price === "number" ? plan.answers.price : 0;

  const r = await captureLead({
    assessmentId: null,
    sessionId: sessionId || undefined,
    side,
    name,
    email,
    phone: phone || undefined,
    phoneConsent: phone ? { granted: phoneOk, wording: PHONE_CONSENT } : undefined,
    emailConsentWording: EMAIL_NOTE,
    lead: {
      side,
      /* A review request is somebody asking for a person: that is the
         strongest signal the public site produces, and it is scored as one. */
      timing: plan.mode === "review" ? "In the next 3 months" : "",
      completion: Math.min(1, plan.values.length / 4),
      hoursSince: 0,
      value: price,
      monthsToReady: null,
      coBuyer: false,
      contactable: true,
      source: plan.mode === "review" ? "review" : "plan",
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "plan.capture" });
    return NextResponse.json({ ok: false, error: "We could not save that just now. Nothing on the page has changed; try again." }, { status: 200 });
  }
  if ("skipped" in r) {
    return NextResponse.json({ ok: true, emailed: false, url: null, skipped: r.reason });
  }

  const base = siteUrl() ?? "";
  let url: string | null = null;
  const attached = await attachPlan(r.data.id, plan);
  if (attached.ok && "data" in attached) url = `${base}/saved/${attached.data.token}`;
  else if (!attached.ok) captureOpError(new Error(attached.error), { op: "plan.attach" });

  /* The instant new-lead alert, as every public capture sends (D07a). */
  const to = await currentAgentEmail();
  if (to) {
    const sent = await sendNewLead({
      to, name, email, phone: phone && phoneOk ? phone : undefined, side,
      band: r.data.score.band, score: r.data.score.score,
      headline: `${planSummary(plan)}. ${r.data.score.headline}`,
      action: plan.mode === "review" ? "They asked you to review their numbers. Reply by email." : r.data.score.action,
      signals: r.data.score.signals, timing: "",
      county: typeof plan.answers.county === "string" ? plan.answers.county : undefined,
      value: price, source: plan.mode === "review" ? "review" : "plan",
      studioUrl: `${base}/operations/lead/${r.data.id}`,
    });
    if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.newLead", extra: { via: "plan" } });
  }

  let emailed = false;
  if (url) {
    const sent = await sendSavedPlan({
      to: email, name, planUrl: url, review: plan.mode === "review",
      values: plan.values.map((v) => ({ label: v.label, figure: v.figure })),
    });
    emailed = sent.ok && !("skipped" in sent);
    if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.plan" });
  }

  return NextResponse.json({ ok: true, emailed, url });
}
