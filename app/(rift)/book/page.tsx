import type { Metadata } from "next";
import { Suspense } from "react";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
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
export default function BookPage() {
  return (
    <Suspense fallback={<main className="shell-w sec buy"><p className="t-sm c-4">Loading…</p></main>}>
      <Booking phoneConsent={PHONE_CONSENT} emailNote={EMAIL_NOTE} />
    </Suspense>
  );
}
