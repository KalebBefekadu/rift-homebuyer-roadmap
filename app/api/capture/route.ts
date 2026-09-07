import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { captureLead } from "@/lib/db/leads";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { captureOpError } from "@/lib/monitoring/capture";
import { sendReadout } from "@/lib/db/email";
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

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

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

  const lead = (b.lead ?? {}) as Partial<LeadInput>;
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

  const r = await captureLead({
    assessmentId,
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
    const sent = await sendReadout({
      to: email,
      name: name || undefined,
      shareUrl: wants.shareUrl,
      cashToClose: Number(wants.cashToClose) || 0,
      gap: Number(wants.gap) || 0,
      monthsToClose: typeof wants.monthsToClose === "number" ? wants.monthsToClose : null,
      county: typeof wants.county === "string" ? wants.county : "your",
    });
    delivery = sent.ok ? ("skipped" in sent ? "not configured" : "sent") : "failed";
  }

  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason, delivery, booking });

  return NextResponse.json({ ok: true, band: r.data.score.band, delivery, booking });
}
