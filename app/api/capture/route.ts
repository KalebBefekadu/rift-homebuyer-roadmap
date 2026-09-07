import { NextResponse } from "next/server";
import { captureLead } from "@/lib/db/leads";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { captureOpError } from "@/lib/monitoring/capture";
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
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const assessmentId = typeof b.assessmentId === "string" ? b.assessmentId : "";
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
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });

  return NextResponse.json({ ok: true, band: r.data.score.band });
}
