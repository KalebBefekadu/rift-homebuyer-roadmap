"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Tibeb, Distance, FourWays } from "@/components/rift/art";
import { LocaleToggle } from "@/components/rift/LocaleToggle";
import { ValueArt } from "@/components/rift/value/ValueArt";
import { Announce } from "@/components/rift/Live";
import { translator, servedIn, ETHIOPIC_STACK, isLocale, type Locale } from "@/lib/core/i18n";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";
import { money } from "@/lib/core/compute";
import { PhoneMenu } from "@/components/rift/site/SiteHeader";
import {
  abroadReturns, statusById, STATUSES, ASSUMPTIONS,
  type AbroadInputs, type StatusId,
} from "@/lib/core/abroad";

/**
 * Buying Georgia property from abroad.
 *
 * The buyer page sells a number nobody gave you. This page sells a permission
 * nobody gave you: that you are allowed to do this at all. Ask anyone in Addis
 * or Dubai whether a foreign national can own a house in Georgia outright and
 * most will guess no, or guess there is a visa involved. There isn't. The
 * single most valuable thing this page does is say so in the first line.
 *
 * The second is to refuse the industry's slogan. "As little as 10% down" is
 * true for some readers and false for most, and a reader who sends documents
 * on the strength of it and is then asked for 30% has been wasted, which is
 * the specific injury this whole product exists to prevent. So the hero asks
 * which of four situations they are in and shows that situation's real number,
 * including the one that is bad news. Being the only page that tells them the
 * unflattering version is the reason they come back.
 */



export function Landing({ initial, initialLocale, localePinned }: {
  initial: AbroadInputs & { downPct: number };
  /* Resolved on the server from ?lang, so Amharic is in the HTML a crawler
     sees and an Amharic reader never watches the page start in English. */
  initialLocale: Locale;
  /* Whether that came from the URL. A shared Amharic link must stay Amharic
     for whoever opens it, including someone whose browser says otherwise. */
  localePinned: boolean;
}) {
  /* Blueprint v5 §5.4 (Kaleb R2: "too complicated... split it into
     values"): this page answers the first value, whether you can buy, from
     one question. What it would cost and what it would earn are their own
     pages. The illustration further down still runs on the answers the
     address carried, or the defaults. */
  const { price, county, use } = initial;
  const [status, setStatus] = useState<StatusId>(initial.status);
  const extraDown: number | null = initial.downPct > statusById(initial.status).down[initial.use] ? initial.downPct : null;

  /* Remembered per visitor, and reflected onto <html lang> so a screen reader
     switches voice with the page and the browser stops offering to translate
     something already in the reader's language. */
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    /* Only what the server could not have known. The URL has already decided
       when it carried ?lang; reading localStorage over the top of that would
       open a link somebody shared in Amharic in whatever language the last
       visitor to this browser happened to pick. */
    if (localePinned) return;
    try {
      const saved = window.localStorage.getItem("rift.locale");
      if (isLocale(saved)) { setLocale(saved); return; }
      if (navigator.language?.toLowerCase().startsWith("am")) setLocale("am");
    } catch { /* storage unavailable: the server's choice stands */ }
  }, [localePinned]);
  useEffect(() => {
    document.documentElement.lang = locale;
    try { window.localStorage.setItem("rift.locale", locale); } catch { /* ignore */ }
    /* Put back on the way out. A link from here to an English page is a
       client-side navigation, so <html lang="am"> used to stay behind and a
       screen reader went on reading English in an Amharic voice. */
    return () => { document.documentElement.lang = "en"; };
  }, [locale]);

  const t = translator(locale);
  const am = locale === "am";
  /* Ethiopic on the Amharic pass only. Switching language must not switch the
     design, so Latin keeps the product's own face. */
  const script: React.CSSProperties = am ? { fontFamily: ETHIOPIC_STACK } : {};

  useCaptureTouch();
  /* The page, and nothing about the reader.
     
     This used to carry `status` and `use`: the visitor's residency situation
     and what they intend to do with the house: straight into the analytics
     table on every view. Two things wrong with that, and the second is the
     serious one. It breaks the product's own rule that telemetry stores
     question ids and timings and never answer values. And residency status is
     about as close a proxy for national origin as this product could collect:
     a protected class under the Fair Housing Act, sitting in a table keyed on
     a session that joins to a lead. This page was designed around targeting a
     SITUATION rather than an ethnicity, and then logged the situation.
     
     The drop-off signal that was wanted is already available without it:
     `hero_answer` records which control was touched, by question id. */
  useTrack({ name: "landing_view", side: "buy", meta: { page: "abroad" } });

  const s = statusById(status);
  const minDown = s.down[use];
  const downPct = Math.max(extraDown ?? minDown, minDown);
  /* Memoised on the object rather than on a hand-written list of its fields.
     The list was correct and the linter was right to complain anyway: it
     described `input` as a dependency it did not have, so adding a sixth field
     to AbroadInputs would have left both memos returning a stale figure with
     nothing failing. The object is rebuilt every render and is cheap; the
     memo exists to keep the arithmetic off the slider's drag path. */
  const input = useMemo(
    () => ({ price, county, status, use, downPct }),
    [price, county, status, use, downPct],
  );
  const r = useMemo(() => abroadReturns(input), [input]);

  const answered = (qid: string) => track({ name: "hero_answer", side: "buy", meta: { qid, page: "abroad" } });

  /* Straight to the readout, not into the buyer funnel. That funnel asks what
     you have saved and what you put away each month: a first-time buyer
     closing a cash gap, and its readout names Georgia Dream throughout, which
     requires the buyer to live in the house. Every answer this page needs has
     already been given above, so there is nothing left to ask. */
  const go = `/abroad/results?s=${status}&u=${use}&p=${price}&c=${encodeURIComponent(county)}&d=${downPct}&lang=${locale}`;

  return (
    <div className="buy" lang={locale}>
      {/* The same header classes as every other public page (WS6.3): this one
          had its own height, background and blur, which is why it sat
          differently from the rest of the site. */}
      <header className="site-head">
        <div className="shell-w between site-head-in">
          <Link href="/abroad" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name hide-xs" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm" style={script}>{t("nav.abroad")}</span>
          </Link>
          <div className="row gap-2">
            <LocaleToggle locale={locale} onChange={setLocale} />
            <Link href="/buy" className="t-sm c-2 hide-sm" style={script}>{t("nav.domestic")}</Link>
            {/* Below 400px the language toggle leaves no room for this beside
                the menu, so there it moves into the menu, first. */}
            <Link href={`/book?v=abroad&lang=${locale}`} className="btn btn-p btn-sm hide-xs" style={script}>{t("nav.talk")}</Link>
            {/* The domestic link is hidden on a phone; this is how a phone
                reaches it. "How it works" is in English, as it is lower down
                this page: there is no reviewed Amharic for it yet. */}
            <PhoneMenu style={script} links={[
              { href: `/book?v=abroad&lang=${locale}`, label: t("nav.talk") },
              { href: "/buy", label: t("nav.domestic") },
              { href: "/abroad/how", label: "How it works" },
            ]} />
          </div>
        </div>
        <Tibeb className="c-brand" height={8} style={{ opacity: 0.5 }} />
      </header>

      <main>
        {/* The permission, then the number. In that order, because most readers
            do not yet believe the first one. */}
        <section className="shell-w">
          <div className="split-w" style={{ paddingTop: "clamp(34px,5vw,64px)", alignItems: "center" }}>
            <div style={{ maxWidth: 640 }}>
              <h1 className={am ? "" : "serif"} style={{
                fontSize: am ? "clamp(27px,3.8vw,44px)" : "clamp(32px,4.6vw,56px)",
                lineHeight: am ? 1.35 : 1.06,
                letterSpacing: am ? "0" : "-0.028em", ...script,
              }}>
                {t("hero.h1")}
              </h1>
              <p className="lede" style={{ marginTop: 16, maxWidth: 560, ...script, lineHeight: am ? 1.85 : undefined }}>
                {t("hero.lede")}
              </p>
            </div>
            <Distance className="c-brand" style={{ maxWidth: 340, opacity: 0.9 }} />
          </div>

          <div className="card p-5" style={{ marginTop: 28, maxWidth: 940 }}>
            <div className="field">
              <span className="label" style={script}>{t("ask.status")}</span>
              {/* Named as a group. Four radios with no group name are read
                  out as four unrelated options with nothing to attach them
                  to, and this is the question the whole page turns on. */}
              <div className="g2 gap-2" style={{ marginTop: 8 }}
                role="radiogroup" aria-label={t("ask.status")}>
                {STATUSES.map((x) => (
                  <label key={x.id} className="opt" data-on={status === x.id}>
                    <input type="radio" name="status" checked={status === x.id}
                      onChange={() => { setStatus(x.id); answered("status"); }} />
                    <span style={script}>
                      <span className="t-sm w55">{t(`status.${x.id}`)}</span>
                      <span className="t-xs c-4" style={{ display: "block", marginTop: 2, lineHeight: am ? 1.8 : 1.5 }}>{t(`status.${x.id}.note`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {/* The answer to the first value, for this situation: yes, and
                what a lender will want. Composed from strings that already
                exist in both languages. */}
            <div className="card p-4 mt-4" style={{ background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <Ico.check size={16} className="c-brand" style={{ flex: "none", marginTop: 3 }} />
                <div>
                  <div className="t-md w6" style={script}>{t("hero.h1")}</div>
                  <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: am ? 1.85 : 1.6, ...script }}>
                    <strong>{t("lender.title")}:</strong> {t(`status.${s.id}.asks`)}
                  </p>
                  <p className="t-sm c-3" style={{ marginTop: 6, ...script }}>
                    {s.down[use]}% {t("down.floor")}
                  </p>
                </div>
              </div>
              <Announce>{`${t("lender.title")}: ${t(`status.${s.id}.asks`)} ${s.down[use]}% ${t("down.floor")}`}</Announce>
            </div>
          </div>

          {/* The other two values, each its own page (§5.4, D20 order). */}
          <div className="pair mt-4" style={{ maxWidth: 940 }} lang="en">
            {[
              { art: "abroad-cost", href: `/abroad/cost?st=${status}&lang=${locale}`, kicker: "Cost to buy and own", q: "What would buying and owning cost me?", b: "The cash you would send, and what owning costs each year." },
              { art: "abroad-return", href: `/abroad/results?s=${status}&u=${use}&p=${price}&c=${encodeURIComponent(county)}&lang=${locale}`, kicker: "The return", q: "What would it earn if I rented it out?", b: "Rent, costs and what is left, marked as an estimate." },
            ].map((v) => (
              <Link key={v.href} href={v.href} className="card p-5 lift value-card">
                <ValueArt id={v.art} style={{ maxWidth: 170 }} />
                <div className="kicker c-brand">{v.kicker}</div>
                <div className="t-lg w6 serif">{v.q}</div>
                <p className="t-sm c-3 grow" style={{ lineHeight: 1.55 }}>{v.b}</p>
                <span className="row gap-1 t-sm w6 c-brand">{am ? "In English for now" : "See it"}<Ico.arrowR size={14} /></span>
              </Link>
            ))}
          </div>
          <p lang={servedIn(locale, "disc.hero")} className="t-xs c-4" style={{ marginTop: 14, maxWidth: 700, lineHeight: am ? 1.85 : 1.6, ...script }}>
            {t("disc.hero")}
          </p>
        </section>

        {/* Why here. Four reasons, and the first one is the real one. */}
        <section className="shell-w sec">
          <div className="split-w">
            <div>
              <div className="kicker c-brand" style={script}>{t("why.kicker")}</div>
              <h2 className={am ? "" : "serif"} style={{
                fontSize: am ? "clamp(21px,2.4vw,29px)" : "clamp(24px,2.8vw,36px)",
                letterSpacing: am ? "0" : "-0.02em", maxWidth: 440,
                lineHeight: am ? 1.45 : 1.14, marginTop: 12, ...script,
              }}>
                {t("why.h2")}
              </h2>
              <p className="t-md c-3" style={{ marginTop: 14, lineHeight: am ? 1.9 : 1.65, maxWidth: 420, ...script }}>
                {t("why.lede")}
              </p>
              <div className="card p-4 c-brand" style={{ marginTop: 20, background: "var(--sunk)", ...script }}>
                <FourWays lang={locale} label={t("four.label")}
                  labels={[t("four.rent"), t("four.growth"), t("four.dollar"), t("four.stay")]} />
              </div>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {([
                [Ico.wallet, t("why.1"), t("why.1.body", { principal: money(r.year1.principal) })],
                [Ico.chart, t("why.2"), t("why.2.body", {
                  rate: `${ASSUMPTIONS.appreciationPct}%`, gain: money(r.year1.appreciation),
                  cash: money(r.cashIn), price: money(price),
                })],
                [Ico.spark, t("why.3"), t("why.3.body")],
              ] as const).map(([Icon, t, b], i, arr) => (
                <div key={t} className="row gap-3" style={{
                  padding: "14px 18px", alignItems: "flex-start",
                  borderBottom: i === arr.length - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <Icon size={16} className="c-brand" style={{ marginTop: 2, flex: "none" }} />
                  <div>
                    <div className="t-md w55" style={script}>{t}</div>
                    <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: am ? 1.8 : 1.55, ...script }}>{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* One call to action (WS6.1). The other two doors are in the header
            (Talk to Kaleb) and on /abroad/how, with the questions that used
            to be here. */}
        <section className="shell-w sec">
          <div className="card" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h2 className={am ? "" : "serif"} style={{
              fontSize: am ? "clamp(20px,2.4vw,28px)" : "clamp(23px,2.8vw,34px)", color: "#fff",
              letterSpacing: am ? "0" : "-0.02em", lineHeight: am ? 1.45 : 1.15, maxWidth: 620, ...script,
            }}>
              {t("abroad.cta.h")}
            </h2>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: am ? 1.9 : 1.6, maxWidth: 560, ...script }}>
              {t("abroad.cta.b")}
            </p>
            <Link href={go} className="btn" style={{ marginTop: 22, background: "#fff", color: "var(--ink)" }}>
              <span style={script}>{t("doors.1.cta")}</span> <Ico.arrowR size={15} />
            </Link>
          </div>
        </section>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 48 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <div className="between wrap gap-4" style={{ alignItems: "flex-start" }}>
              <div style={{ maxWidth: 400 }}>
                <Link href="/abroad" className="row gap-2">
                  <Mark size={18} />
                  <span className="mark-name" style={{ fontSize: 17 }}>Rift</span>
                </Link>
                <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: am ? 1.85 : 1.6, ...script }}>
                  {t("foot.note")}
                </p>
                <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: am ? 1.85 : 1.6, ...script }}>
                  {t("foot.fair")}
                </p>
              </div>
              <div className="row gap-4" style={{ alignItems: "flex-start" }}>
                <div className="col gap-2">
                  <div className="kicker c-4">This product</div>
                  <Link href={go} className="t-sm c-3">My readout</Link>
                  <Link href="/abroad/how" className="t-sm c-3">How it works and questions</Link>
                  <Link href="/buy" className="t-sm c-3">Buying to live here</Link>
                </div>
                <div className="col gap-2">
                  <div className="kicker c-4">Rift</div>
                  <Link href={`/book?v=abroad&lang=${locale}`} className="t-sm c-3">Book fifteen minutes</Link>
                  <Link href="/sell" className="t-sm c-3">Selling instead?</Link>
                  {/* English, like the two links above it. The page is
                      bilingual; this one is not translated yet and a label
                      invented here would be exactly the guess the whole
                      dictionary exists to avoid. */}
                  <Link href="/privacy" className="t-sm c-3">What we keep</Link>
                  {/* The client sign-in, as in every other footer. This one
                      sent a buyer to the agent's Operations sign-in. */}
                  <Link href="/app/sign-in" className="t-sm c-3">Client sign in</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
