import type { Metadata } from "next";
import { Suspense } from "react";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { isLocale, type Locale } from "@/lib/core/i18n";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Bet Equb: save together, buy a home",
  description:
    "Join a group of families saving together toward a down payment each, on a set schedule, with attorneys, CPAs, lenders and a licensed Georgia agent guiding every step.",
  alternates: { canonical: "/equb", languages: { en: "/equb", am: "/equb?lang=am" } },
  /* Not indexed, not in the sitemap. The copy describes pooled funds paid out
     on a schedule, and the brief itself says to have an attorney review
     landing-page language for financial programs before it is public. Lifting
     this is a one-line change that belongs after that review, not before. */
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* The language is resolved here from ?lang, so an Amharic link renders
   Amharic in the HTML rather than switching after it loads. */
export default async function EqubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = (await searchParams).lang;
  const pinned = isLocale(lang);
  const locale: Locale = pinned ? lang : "en";
  return (
    <Suspense>
      <Landing phoneConsent={PHONE_CONSENT} emailNote={EMAIL_NOTE} initialLocale={locale} localePinned={pinned} />
    </Suspense>
  );
}
