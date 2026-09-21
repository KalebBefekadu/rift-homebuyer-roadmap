import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { captureLead } from "@/lib/db/leads";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { captureOpError } from "@/lib/monitoring/capture";
import { sendReadout, sendNewLead } from "@/lib/db/email";
import { currentAgentEmail } from "@/lib/db/service";
import { siteUrl } from "@/lib/core/site";
import { book } from "@/lib/db/calendar";
import type { LeadInput } from "@/lib/core/lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Capture, and the consent gate.
 *
 * The wording stored with a consent record is the SERVER's copy, never the
 * client's. A browser that can post the text somebody agreed to can post
 * anything, and the entire value of a consent record is that it is evidence.
 * The client tells us whether the box was ticked; the server decides what the
 * box said.
 *
 * A phone number arriving without consent is dropped rather than stored — see
 * lib/db/leads.ts. That is deliberate and it is not merely conservative: a
 * number you may not lawfully call cannot be used, and still has to be
 * disclosed, secured and deleted. It is cost with no upside.
 */
export async function POST(req: Request) {
  const refused = limited(req, "capture");
  if (refused) return refused;

  const read = await readJson(req);
  if (!read.ok) return read.res;
  const b = read.body as Record<string, unknown>;

  /* Empty means "no assessment behind this lead", which is a real case rather
     than a mistake — a share-link visitor, or somebody booking from the
     landing page. It must not reach the database as an empty uuid. */
  const assessmentId = typeof b.assessmentId === "string" && b.assessmentId.trim()
    ? b.assessmentId.trim()
    : null;
  const email = typeof b.email === "string" ? b.email.trim().slice(0, 200) : "";
  const phone = typeof b.phone === "string" ? b.phone.trim().slice(0, 40) : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const phoneTicked = b.phoneConsent === true;

  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: "an email or a phone number is required" }, { status: 400 });
  }
  /* Shape only. Deliverability is a delivery-time question, and rejecting an
     unusual but valid address here loses a real person to a regex. */
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "that email address does not look right" }, { status: 400 });
  }
  if (phone && !phoneTicked) {
    return NextResponse.json({
      ok: false,
      error: "a phone number cannot be stored without the consent box ticked",
    }, { status: 400 });
  }

  const lead = (b.lead ?? {}) as Partial<LeadInput> & { county?: unknown };
  const wantsDeliver = (b.deliver ?? {}) as { county?: unknown };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "");
  const county = str(wantsDeliver.county) || str(lead.county) || str(b.county);
  const scored: LeadInput = {
    side: lead.side === "sell" ? "sell" : "buy",
    timing: typeof lead.timing === "string" ? lead.timing : "",
    completion: typeof lead.completion === "number" ? Math.min(1, Math.max(0, lead.completion)) : 0,
    hoursSince: 0,
    value: typeof lead.value === "number" ? lead.value : 0,
    monthsToReady: typeof lead.monthsToReady === "number" ? lead.monthsToReady : null,
    coBuyer: lead.coBuyer === true,
    contactable: Boolean(email || phone),
    source: typeof lead.source === "string" ? lead.source : "direct",
  };

  /* The session, so the person can later be erased.
     
     Without it a lead captured from the abroad readout or from /book has no
     link to anything a delete request can key on, and "delete all of it"
     silently spares exactly the row that holds their email address. */
  const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim().slice(0, 64) : "";

  const r = await captureLead({
    assessmentId,
    sessionId: sessionId || undefined,
    side: scored.side,
    name: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    phoneConsent: phone ? { granted: phoneTicked, wording: PHONE_CONSENT } : undefined,
    emailConsentWording: email ? EMAIL_NOTE : undefined,
    lead: scored,
    /* Recorded as evidence of the consent, and for nothing else. It is never
       used to identify or to enrich, and it is deleted with the record. */
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "lead.capture", extra: { hasEmail: Boolean(email), hasPhone: Boolean(phone) } });
    return NextResponse.json({ ok: false, error: "we could not save that just now" }, { status: 200 });
  }
  /* Delivery is attempted after the lead is safely stored, and its outcome is
     reported separately. Failing the whole capture because an email bounced
     would lose the relationship over the least important part of it — the
     readout is already on their screen and already has a URL. */
  /* Holding the slot happens after the lead is stored and is reported
     separately. A calendar outage must not lose the relationship — the readout
     and the contact details are the durable part; a time can be rearranged. */
  /* The agent finds out.
     
     Nothing did this. Studio ranked leads, timed an SLA against them and
     computed the cadence they were owed — all of which needed Kaleb to be
     looking at the screen already. A `now` band lead carries a fifteen-minute
     reply target, and the only thing that could start that clock ticking in
     his awareness was him happening to open a browser.
     
     After the lead is stored, never before, and its failure is reported
     rather than raised: the relationship is the durable thing here and an
     unsent alert must not cost it. Awaited rather than fired and forgotten,
     because on a serverless runtime the response ends the invocation and a
     floating promise is simply dropped — which would have made this exactly
     the kind of thing that looks wired up and never runs. */
  let alerted: string | undefined;
  if (!("skipped" in r)) {
    const to = await currentAgentEmail();
    if (!to) {
      alerted = "no agent address";
    } else {
      const base = siteUrl();
      const sent = await sendNewLead({
        to,
        name: name || undefined,
        email: email || undefined,
        phone: phone && phoneTicked ? phone : undefined,
        side: scored.side,
        band: r.data.score.band,
        score: r.data.score.score,
        headline: r.data.score.headline,
        action: r.data.score.action,
        signals: r.data.score.signals,
        timing: scored.timing,
        /* From wherever the caller put it. The buyer readout sends it inside
           `deliver`, the seller readout inside `lead`, and /book not at all —
           reading only a top-level `b.county` would have produced an alert
           subject with the county silently missing from every one of them. */
        county: county || undefined,
        value: scored.value,
        source: scored.source,
        studioUrl: `${base ?? ""}/studio/lead/${r.data.id}`,
      });
      alerted = sent.ok ? ("skipped" in sent ? "not configured" : "sent") : "failed";
      if (!sent.ok) {
        captureOpError(new Error(sent.error), { op: "email.newLead", extra: { band: r.data.score.band } });
      }
    }
  }

  let booking: string | undefined;
  const slotStart = typeof b.slotStart === "string" ? b.slotStart : "";
  if (slotStart && email) {
    const held = await book({
      start: slotStart,
      name: name || "Rift visitor",
      email,
      phone: phone && phoneTicked ? phone : undefined,
      topic: typeof b.topic === "string" ? b.topic : "your numbers",
    });
    booking = held.ok ? ("skipped" in held ? "not configured" : "held") : "failed";
    if (!held.ok) {
      captureOpError(new Error(held.error), { op: "calendar.book", extra: { hasEmail: true } });
    }
  }

  let delivery: string | undefined;
  const wants = (b.deliver ?? null) as Record<string, unknown> | null;
  if (email && wants && typeof wants.shareUrl === "string") {
    /* The seller half of this was missing. The seller readout posts
       `netProceeds`, this read `cashToClose`, and `Number(undefined) || 0` is
       0 — so every seller who asked for their readout by email was queued a
       message reading "Buying in DeKalb County takes $0 at the table". Email
       has never been switched on in production, so it was armed rather than
       fired. The builder refuses to send without the figure now, so the
       equivalent mistake fails loudly instead. */
    const side = (lead.side === "sell" ? "sell" : "buy") as "buy" | "sell";
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

    const sent = await sendReadout({
      to: email,
      name: name || undefined,
      shareUrl: wants.shareUrl,
      county: typeof wants.county === "string" ? wants.county : "your",
      side,
      ...(side === "sell"
        ? { net: num(wants.netProceeds), price: num(wants.price) }
        : {
            cashToClose: num(wants.cashToClose),
            gap: num(wants.gap) ?? 0,
            monthsToClose: typeof wants.monthsToClose === "number" ? wants.monthsToClose : null,
          }),
    });
    delivery = sent.ok ? ("skipped" in sent ? "not configured" : "sent") : "failed";
  }

  /* `stored` says, in one word, whether the person's details now exist on our
     side. `skipped` alone did not: the forms read `ok: true` and rendered
     "Noted, but email is not switched on yet" over a capture that had stored
     nothing — which happened on every cold start, while the agent lookup was
     timing out and being remembered as absent. A form may say "noted" only
     when this is true. */
  if ("skipped" in r) {
    return NextResponse.json({ ok: true, skipped: true, stored: false, reason: r.reason, delivery, booking });
  }

  return NextResponse.json({ ok: true, stored: true, band: r.data.score.band, delivery, booking, alerted });
}
