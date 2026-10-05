"use client";

import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { useLocale } from "@/components/rift/useLocale";
import { EqubForm } from "@/components/rift/equb/EqubForm";
import { useTrack } from "@/lib/rift/track";
import { ETHIOPIC_STACK, translator, type Locale } from "@/lib/core/i18n";
import { EqubFooter, EqubHeader } from "../Landing";

export function Reserve({ phoneConsent, emailNote, initialLocale, localePinned }: {
  phoneConsent: string; emailNote: string; initialLocale: Locale; localePinned: boolean;
}) {
  useTrack({ name: "landing_view", side: "buy", meta: { page: "equb_reserve" } });
  const [locale, setLocale] = useLocale(initialLocale, localePinned);
  const t = translator(locale);
  const script: React.CSSProperties = locale === "am" ? { fontFamily: ETHIOPIC_STACK } : {};
  return (
    <div className="buy" lang={locale}>
      <EqubHeader locale={locale} onLocale={setLocale} />
      <main className="shell-w sec" style={{ maxWidth: 640, ...script }}>
        <Link href={`/equb${locale === "am" ? "?lang=am" : ""}`} className="row gap-1 t-sm c-3" style={{ marginBottom: 16 }}>
          <Ico.chevL size={13} />{t("eq.back")}
        </Link>
        <h1 className="serif" style={{ fontSize: "clamp(28px,3.6vw,40px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{t("eq.reserve.title")}</h1>
        <p className="lede" style={{ marginTop: 12 }}>{t("eq.reserve.lede")}</p>
        <EqubForm locale={locale} phoneConsent={phoneConsent} emailNote={emailNote} />
      </main>
      <EqubFooter locale={locale} />
    </div>
  );
}
