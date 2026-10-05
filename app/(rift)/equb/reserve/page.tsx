import type { Metadata } from "next";
import { Suspense } from "react";
import { PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
import { isLocale, type Locale } from "@/lib/core/i18n";
import { Reserve } from "./Reserve";

export const metadata: Metadata = {
  title: "Bet Equb: save your seat",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** The seat request on its own page (manual review WS2.10): every call to action on /equb opens this. */
export default async function ReservePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = (await searchParams).lang;
  const pinned = isLocale(lang);
  const locale: Locale = pinned ? lang : "en";
  return (
    <Suspense>
      <Reserve phoneConsent={PHONE_CONSENT} emailNote={EMAIL_NOTE} initialLocale={locale} localePinned={pinned} />
    </Suspense>
  );
}
