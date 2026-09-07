import type { Metadata } from "next";
import { Suspense } from "react";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { availability } from "@/lib/db/calendar";
import { Booking } from "./Booking";

export const metadata: Metadata = {
  title: "Talk it through",
  description: "Twenty minutes about the one thing in the way. No obligation, and nothing to cancel.",
};

export const dynamic = "force-dynamic";

/**
 * Booking.
 *
 * The consent wording is passed from the server so the text somebody reads is
 * the same string that gets stored as evidence they read it. A client-side
 * constant would drift from the server's copy the first time one of them was
 * edited, and the whole point of the record is that it says what they saw.
 */
export default async function BookPage() {
  const avail = await availability(7);

  /* Three states, three screens. "No real availability configured" and "the
     agent has no free time" are different facts, and inventing four plausible
     times to paper over either of them is a promise the product cannot keep —
     discovered by the person only after they have chosen one. */
  const slots = avail.ok ? avail.slots : [];
  const source = avail.ok ? ("source" in avail ? avail.source : "calendar") : "error";

  return (
    <Suspense fallback={<main className="shell-w sec buy"><p className="t-sm c-4">Loading…</p></main>}>
      <Booking
        phoneConsent={PHONE_CONSENT}
        emailNote={EMAIL_NOTE}
        slots={slots}
        source={source as "calendar" | "unconfigured" | "error"}
      />
    </Suspense>
  );
}
