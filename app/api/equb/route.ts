import { NextResponse } from "next/server";
import { clientIp, limited, readJson, visitorSession } from "@/lib/db/guard";
import { captureLead, completeLead } from "@/lib/db/leads";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { equbNote, EQUB_TIMELINES, parsePrice } from "@/lib/core/equb";
import { money } from "@/lib/core/compute";
import { readRecord, signRecord } from "@/lib/core/signed";
import { captureOpError } from "@/lib/monitoring/capture";
import { currentAgentEmail } from "@/lib/db/service";
import { sendNewLead } from "@/lib/db/email";
import { siteUrl } from "@/lib/core/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Equb seat request, in two steps (manual review WS2.10).
 *
 *   start   name and a way to reach them. The lead is saved right away, so
 *           somebody who stops here is not lost, and the answer carries a
 *           token that lets step 2 update THIS lead and no other.
 *   finish  household, language, target price and timeline, merged into the
 *           same lead. A second call with the same token updates again
 *           rather than adding a duplicate.
 *
 * The answers go to the lead, never to telemetry (rule 6). The phone consent
 * gate is the same as /api/capture: no tick, no number stored.
 */
const PURPOSE = "equb-lead";
const TTL_MS = 6 * 60 * 60 * 1000;
/* Its own secret when set; otherwise derived from the service key, which is
   already a secret only the server holds. */
const secret = () => process.env.RIFT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const refused = limited(req, "capture");
  if (refused) return refused;
  const read = await readJson(req);
  if (!read.ok) return read.res;
  const b = (read.body ?? {}) as Record<string, unknown>;

  if (b.step === "finish") {
    const id = readRecord(secret(), PURPOSE, text(b.token, 300));
    if (!id) return json({ ok: false, error: "This form has been open too long. Your name and contact details already reached us; send the rest again from the start if you like." }, 400);
    const language = b.language === "am" ? "አማርኛ" : "English";
    const household = text(b.household, 2).replace(/\D/g, "");
    const value = parsePrice(text(b.price, 12));
    const timing = EQUB_TIMELINES.includes(b.timeline as never) ? String(b.timeline) : "";
    const r = await completeLead(id, {
      timing, value: value ?? undefined,
      note: equbNote({ household, language, price: value ? money(value) : "" }),
    });
    if (!r.ok) {
      captureOpError(new Error(r.error), { op: "equb.finish" });
      return json({ ok: false, error: "We could not save those answers just now. Your contact details already reached us." }, 502);
    }
    if ("skipped" in r) return json({ ok: false, error: r.reason }, 503);
    return json({ ok: true });
  }

  const name = text(b.name, 120);
  const email = text(b.email, 200);
  const phone = text(b.phone, 40);
  const phoneTicked = b.phoneConsent === true;
  if (!name) return json({ ok: false, error: "Add your name." }, 400);
  if (!email && !phone) return json({ ok: false, error: "Add a phone number or an email address." }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "That email address does not look right." }, 400);
  if (phone && phone.replace(/\D/g, "").length < 10) return json({ ok: false, error: "Add the phone number with its area code." }, 400);
  if (phone && !phoneTicked) return json({ ok: false, error: "Tick the box so we can call you, or leave the phone number out." }, 400);

  const r = await captureLead({
    assessmentId: "",
    sessionId: visitorSession(b.sessionId),
    side: "buy",
    name, email: email || undefined, phone: phone || undefined,
    phoneConsent: phone ? { granted: phoneTicked, wording: PHONE_CONSENT } : undefined,
    emailConsentWording: email ? EMAIL_NOTE : undefined,
    lead: {
      side: "buy", timing: "", completion: 0.5, hoursSince: 0, value: 0, monthsToReady: null,
      coBuyer: false, contactable: true, source: "equb", note: "Equb seat request (contact details only so far)",
    },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "equb.start" });
    return json({ ok: false, error: "We could not save your request just now, so it has not reached us. Please try again in a minute." }, 502);
  }
  if ("skipped" in r) return json({ ok: false, error: "We could not save your request just now, so it has not reached us. Please try again in a minute." }, 503);
  /* Kaleb hears about it at step 1, like every other lead: the person may
     never send step 2. Awaited, because a serverless response ends the run. */
  const to = await currentAgentEmail();
  if (to) {
    const sent = await sendNewLead({
      to, name, email: email || undefined, phone: phone && phoneTicked ? phone : undefined,
      side: "buy", band: r.data.score.band, score: r.data.score.score, headline: r.data.score.headline,
      action: r.data.score.action, signals: r.data.score.signals, timing: "", value: 0, source: "equb",
      studioUrl: `${siteUrl() ?? ""}/operations/lead/${r.data.id}`,
    });
    if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.newLead", extra: { source: "equb" } });
  }
  const key = secret();
  return json({ ok: true, token: key ? signRecord(key, PURPOSE, r.data.id, TTL_MS) : null });
}
