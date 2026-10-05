"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Tibeb } from "@/components/rift/art";
import { LocaleToggle } from "@/components/rift/LocaleToggle";
import { useLocale } from "@/components/rift/useLocale";
import { EqubForm } from "@/components/rift/equb/EqubForm";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";
import { ETHIOPIC_STACK, translator, type Locale } from "@/lib/core/i18n";
import { money } from "@/lib/core/compute";
import { EQUB_EXAMPLE, equbPayout } from "@/lib/core/equb";
import { Circle, Ladder, Ledger, StepIcon, ToClosing } from "@/components/rift/equb-art";

/**
 * Bet Equb: a savings group that ends in a home.
 *
 * The working name comes from the brief and is a placeholder. The page makes
 * one promise (a group, a schedule, a professional holding the money) and is
 * careful never to make a second one. The outcome is written as a goal, not a
 * guarantee, and nothing here says "win", "draw" or "lottery". The safety
 * section (manual review WS2.5) is written as what is being built, not as a
 * guarantee, and is for an attorney to read before this page is indexed (D5).
 *
 * Every string is in lib/core/i18n.ts under `eq.*`, in English and Amharic
 * (WS2.3), so the whole page switches with the toggle and a native speaker
 * can review it in one place.
 *
 * Three answers the brief left as blanks (how the order is decided, what
 * happens on a missed payment, exactly how funds are protected) are shown as
 * what they are: not final yet, and given in writing before anyone commits.
 */

const SAFE_ICONS: (keyof typeof Ico)[] = ["shield", "doc", "users", "search", "cal"];
const WHY_ICONS: (keyof typeof Ico)[] = ["users", "shield", "search", "home", "key", "send"];

const h2: React.CSSProperties = { fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em" };

/** A call to action that opens the form page. Each one is tracked on its own (WS2.9). */
function Cta({ id, label, locale, primary = true, style }: { id: string; label: string; locale: Locale; primary?: boolean; style?: React.CSSProperties }) {
  return (
    <Link href={`/equb/reserve${locale === "am" ? "?lang=am" : ""}`} className={`btn ${primary ? "btn-p" : "btn-s"}`} style={style}
      onClick={() => track({ name: "hero_answer", side: "buy", meta: { qid: id, page: "equb" } })}>
      {label} <Ico.arrowR size={15} />
    </Link>
  );
}

/** The header, shared with /equb/reserve. */
export function EqubHeader({ locale, onLocale }: { locale: Locale; onLocale: (l: Locale) => void }) {
  const t = translator(locale);
  const script: React.CSSProperties = locale === "am" ? { fontFamily: ETHIOPIC_STACK } : {};
  return (
    <header className="site-head">
      <div className="shell-w between site-head-in">
        <Link href={`/equb${locale === "am" ? "?lang=am" : ""}`} className="row gap-2" aria-label="Bet Equb">
          <Mark size={20} />
          <span className="mark-name" style={{ fontSize: 19 }}>Bet Equb</span>
          <span className="chip chip-brand hide-xs" style={script}>{t("eq.chip")}</span>
        </Link>
        <nav className="row gap-3 site-nav" aria-label="Main">
          <a href="/equb#how" className="hide-sm" style={script}>{t("eq.nav.how")}</a>
          <a href="/equb#faq" className="hide-sm" style={script}>{t("eq.nav.faq")}</a>
          <LocaleToggle locale={locale} onChange={onLocale} />
          <span className="hide-sm"><Cta id="equb_cta_header" label={t("eq.cta.seat")} locale={locale} style={{ ...script, height: 34, padding: "0 12px", fontSize: 13 }} /></span>
        </nav>
      </div>
      <Tibeb className="c-brand" height={8} style={{ opacity: 0.5 }} />
    </header>
  );
}

export function Landing({ phoneConsent, emailNote, initialLocale, localePinned }: {
  phoneConsent: string;
  emailNote: string;
  initialLocale: Locale;
  localePinned: boolean;
}) {
  useCaptureTouch();
  /* The page, and nothing the visitor says on it (rule 6). */
  useTrack({ name: "landing_view", side: "buy", meta: { page: "equb" } });
  const [locale, setLocale] = useLocale(initialLocale, localePinned);
  const t = translator(locale);
  const am = locale === "am";
  const script: React.CSSProperties = am ? { fontFamily: ETHIOPIC_STACK } : {};

  /* The ring in the hero turns on its own. Reduced-motion readers get it
     still: it is decoration. */
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTurn((x) => x + 1), 1800);
    return () => window.clearInterval(id);
  }, []);

  const payout = equbPayout(EQUB_EXAMPLE);
  const steps = [1, 2, 3, 4, 5] as const;

  return (
    <div className="buy" lang={locale}>
      <EqubHeader locale={locale} onLocale={setLocale} />

      <main style={script}>
        <section className="shell-w" style={{ paddingTop: "clamp(34px,5vw,64px)" }}>
          {/* The drawing larger and against the right edge on desktop
              (WS2.1); below the text and centred on a phone. */}
          <div className="split-w" style={{ alignItems: "center" }}>
            <div style={{ maxWidth: 680 }}>
              <h1 className="serif" style={{ fontSize: "clamp(34px,5vw,62px)", lineHeight: 1.06, letterSpacing: "-0.028em" }}>
                {t("eq.hero.h1")}
              </h1>
              <p className="lede" style={{ marginTop: 18, maxWidth: 600 }}>{t("eq.hero.lede")}</p>
              {am ? null : (
                <p lang="am" className="t-md c-3" style={{ marginTop: 14, lineHeight: 1.85, fontFamily: ETHIOPIC_STACK }}>
                  እቁብ ለቤት። በአንድነት እንቆጥባለን፣ በአንድነት ቤት እንገዛለን።
                </p>
              )}
              <Cta id="equb_cta_hero" label={t("eq.cta.seat")} locale={locale} style={{ marginTop: 22, ...script }} />
            </div>
            <div className="equb-hero-art">
              <Circle className="c-brand" members={8} turn={turn} style={{ width: "100%", maxWidth: 440 }} />
            </div>
          </div>
        </section>

        <section className="shell-w sec">
          <div className="card p-5" style={{ maxWidth: 760, background: "var(--sunk)" }}>
            <div className="kicker c-brand">{t("eq.problem.k")}</div>
            <p className="t-lg serif" style={{ marginTop: 10, lineHeight: 1.4 }}>{t("eq.problem.b")}</p>
          </div>
        </section>

        {/* One column: the text sits directly under its heading, so there is
            no empty column beside long paragraphs (WS2.4). */}
        <section className="shell-w sec">
          <div style={{ maxWidth: 720 }}>
            <div className="kicker c-brand">{t("eq.vision.k")}</div>
            <h2 className="serif" style={{ ...h2, lineHeight: 1.14, marginTop: 12 }}>{t("eq.vision.h")}</h2>
            <p className="t-md c-2" style={{ marginTop: 16, lineHeight: 1.7 }}>{t("eq.vision.p1")}</p>
            <p className="t-md c-2" style={{ marginTop: 12, lineHeight: 1.7 }}>{t("eq.vision.p2")}</p>
            <p className="t-md w6" style={{ marginTop: 12, lineHeight: 1.6 }}>{t("eq.vision.p3")}</p>
          </div>
        </section>

        <section id="safety" className="shell-w sec" aria-labelledby="safe-h">
          <div className="kicker c-brand">{t("eq.safe.k")}</div>
          <h2 id="safe-h" className="serif" style={{ ...h2, marginTop: 12 }}>{t("eq.safe.h")}</h2>
          <p className="t-md c-3" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 680 }}>{t("eq.safe.lede")}</p>
          <div className="trio" style={{ marginTop: 22 }}>
            {SAFE_ICONS.map((ic, i) => {
              const Icon = Ico[ic] ?? Ico.check;
              return (
                <div key={ic} className="card p-4">
                  <Icon size={16} className="c-brand" />
                  <div className="t-md w6" style={{ marginTop: 8 }}>{t(`eq.safe.${i + 1}.t`)}</div>
                  <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.6 }}>{t(`eq.safe.${i + 1}.b`)}</p>
                </div>
              );
            })}
          </div>
          <Cta id="equb_cta_safety" label={t("eq.cta.fits")} locale={locale} primary={false} style={{ marginTop: 22, ...script }} />
        </section>

        <section id="how" className="shell-w sec">
          <h2 className="serif" style={h2}>{t("eq.how.h")}</h2>
          <ol className="card" style={{ overflow: "hidden", marginTop: 22, listStyle: "none", padding: 0 }}>
            {steps.map((n, i) => (
              <li key={n} className="row gap-3" style={{
                padding: "16px 20px", alignItems: "flex-start",
                borderBottom: i === steps.length - 1 ? undefined : "1px solid var(--line-3)",
              }}>
                <StepIcon n={n} className="c-brand" />
                <div>
                  <div className="t-md w6"><span className="c-4">{n}. </span>{t(`eq.step.${n}.t`)}</div>
                  <p className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.6 }}>{t(`eq.step.${n}.b`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="shell-w sec">
          <div className="split-w" style={{ alignItems: "center" }}>
            <div className="card p-5" style={{ maxWidth: 560 }}>
              {/* "An example group" keeps saying it is an example now the
                  disclaimer line under the table is gone (D7). */}
              <div className="kicker c-brand">{t("eq.ex.k")}</div>
              <table className="t-md" style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    [t("eq.ex.members"), t("eq.ex.families", { n: EQUB_EXAMPLE.members })],
                    [t("eq.ex.monthly"), money(EQUB_EXAMPLE.monthly)],
                    [t("eq.ex.cycle"), t("eq.ex.months", { n: EQUB_EXAMPLE.months })],
                    [t("eq.ex.receives"), payout === null ? t("eq.ex.varies") : t("eq.ex.toward", { amount: money(payout) })],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid var(--line-3)" }}>
                      <th scope="row" className="c-3 w5" style={{ textAlign: "left", padding: "9px 0", fontWeight: 500 }}>{k}</th>
                      <td className="w6" style={{ textAlign: "right", padding: "9px 0" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <Ladder months={EQUB_EXAMPLE.months} focus={(turn % EQUB_EXAMPLE.months) + 1} className="c-brand"
                label={t("eq.ex.ladderLabel", { n: EQUB_EXAMPLE.months })} />
              <p className="t-xs c-3" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 420 }}>{t("eq.ex.ladder")}</p>
            </div>
          </div>
          <div className="ctr" style={{ marginTop: 26 }}>
            <Cta id="equb_cta_example" label={t("eq.cta.join")} locale={locale} style={script} />
          </div>
        </section>

        <section className="shell-w sec">
          <h2 className="serif" style={h2}>{t("eq.why.h")}</h2>
          <div className="g3 gap-3" style={{ marginTop: 22 }}>
            {WHY_ICONS.map((ic, i) => {
              const Icon = Ico[ic] ?? Ico.check;
              return (
                <div key={ic} className="card p-4">
                  <Icon size={16} className="c-brand" />
                  <div className="t-md w6" style={{ marginTop: 8 }}>{t(`eq.why.${i + 1}.t`)}</div>
                  <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.6 }}>{t(`eq.why.${i + 1}.b`)}</p>
                </div>
              );
            })}
          </div>
          {/* More room between the two groups (WS2.7), and both drawings
              centred in cards of equal height (WS2.8). */}
          <div className="pair" style={{ marginTop: 28 }}>
            {([[Ledger, "eq.why.ledger"], [ToClosing, "eq.why.closing"]] as const).map(([Art, key]) => (
              <div key={key} className="card p-4" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <Art className="c-brand" style={{ width: "100%", maxWidth: 300 }} />
                <p className="t-xs c-3" style={{ marginTop: 10 }}>{t(key)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="shell-w sec">
          <div className="split-w">
            <div>
              <div className="kicker c-brand">{t("eq.who.k")}</div>
              <p className="t-lg serif" style={{ marginTop: 10, lineHeight: 1.4, maxWidth: 460 }}>{t("eq.who.b")}</p>
            </div>
            <div>
              <div className="kicker c-brand">{t("eq.team.k")}</div>
              <p className="t-md c-2" style={{ marginTop: 10, lineHeight: 1.7 }}>{t("eq.team.b")}</p>
              <p className="t-sm c-3" style={{ marginTop: 10 }}>{t("eq.team.own")}</p>
            </div>
          </div>
        </section>

        <section id="faq" className="shell-w sec">
          <h2 className="serif" style={h2}>{t("eq.faq.h")}</h2>
          <div className="g2 gap-3" style={{ marginTop: 22 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="card p-4">
                <div className="t-md w6">{t(`eq.faq.${n}.q`)}</div>
                <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.65 }}>{t(`eq.faq.${n}.a`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="reserve" className="shell-w sec" style={{ scrollMarginTop: 70 }}>
          <div className="card" style={{ padding: "clamp(24px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h2 className="serif" style={{ fontSize: "clamp(24px,2.9vw,36px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {t("eq.reserve.h")}
            </h2>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.66)", fontSize: 15, lineHeight: 1.6, maxWidth: 560 }}>{t("eq.reserve.b")}</p>
          </div>
          <EqubForm locale={locale} phoneConsent={phoneConsent} emailNote={emailNote} />
        </section>

        <EqubFooter locale={locale} />
      </main>
    </div>
  );
}

export function EqubFooter({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 48 }}>
      <div className="shell-w" style={{ paddingTop: 26, paddingBottom: 60 }}>
        <p className="t-xs c-4" style={{ maxWidth: 620, lineHeight: 1.6 }}>{t("eq.foot.b")}</p>
        <div className="row gap-4" style={{ marginTop: 14 }}>
          <Link href="/privacy" className="t-sm c-3">{t("eq.foot.privacy")}</Link>
          <Link href="/buy" className="t-sm c-3">{t("eq.foot.buy")}</Link>
        </div>
      </div>
    </footer>
  );
}
