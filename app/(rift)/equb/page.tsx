import type { Metadata } from "next";
import { Suspense } from "react";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Bet Equb: the Equb your family trusted, built to buy a home",
  description:
    "Join a group of families saving together toward a down payment each, on a set schedule, with attorneys, CPAs, lenders and a licensed Georgia agent guiding every step.",
  alternates: { canonical: "/equb" },
  /* Not indexed, not in the sitemap. The copy describes pooled funds paid out
     on a schedule, and the brief itself says to have an attorney review
     landing-page language for financial programs before it is public. Lifting
     this is a one-line change that belongs after that review, not before. */
  robots: { index: false, follow: false },
};

export default function EqubPage() {
  return (
    <Suspense>
      <Landing phoneConsent={PHONE_CONSENT} emailNote={EMAIL_NOTE} />
    </Suspense>
  );
}
