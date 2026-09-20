"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Tibeb, Distance, ReturnBars } from "@/components/rift/art";
import { LocaleToggle } from "@/components/rift/LocaleToggle";
import { translator, ETHIOPIC_STACK, isLocale, type Locale } from "@/lib/core/i18n";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";
import { money } from "@/lib/core/compute";
import {
  abroadReturns, breakEvenDownPct, statusById, STATUSES, ASSUMPTIONS,
  type AbroadInputs, type StatusId, type Use,
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
 * on the strength of it and is then asked for 30% has been wasted — which is
 * the specific injury this whole product exists to prevent. So the hero asks
 * which of four situations they are in and shows that situation's real number,
 * including the one that is bad news. Being the only page that tells them the
 * unflattering version is the reason they come back.
 */

const USES: { id: Use; label: string; note: string }[] = [
  { id: "rent", label: "Rent it out", note: "Income now, someone else paying the loan down" },
  { id: "live", label: "Live in it later", note: "A place to return to, or for family here now" },
];

export function Landing({ counties, initial, initialLocale, localePinned }: {
  counties: string[];
  initial: AbroadInputs & { downPct: number };
  /* Resolved on the server from ?lang, so Amharic is in the HTML a crawler
     sees and an Amharic reader never watches the page start in English. */
  initialLocale: Locale;
  /* Whether that came from the URL. A shared Amharic link must stay Amharic
     for whoever opens it, including someone whose browser says otherwise. */
  localePinned: boolean;
}) {
  const [price, setPrice] = useState(initial.price);
  const [county, setCounty] = useState(initial.county);
  const [status, setStatus] = useState<StatusId>(initial.status);
  const [use, setUse] = useState<Use>(initial.use);
  /* Null means "the minimum for my situation", so changing status moves the
     slider with it instead of stranding a number that no longer applies. */
  const [extraDown, setExtraDown] = useState<number | null>(
    initial.downPct > statusById(initial.status).down[initial.use] ? initial.downPct : null,
  );

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
    } catch { /* storage unavailable — the server's choice stands */ }
  }, [localePinned]);
  useEffect(() => {
    document.documentElement.lang = locale;
    try { window.localStorage.setItem("rift.locale", locale); } catch { /* ignore */ }
  }, [locale]);

  const t = translator(locale);
  const am = locale === "am";
  /* Ethiopic on the Amharic pass only. Switching language must not switch the
     design, so Latin keeps the product's own face. */
  const script: React.CSSProperties = am ? { fontFamily: ETHIOPIC_STACK } : {};

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "buy", meta: { page: "abroad", status, use } });

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
  /* The break-even sweeps every down payment, so it deliberately ignores the
     one currently selected — dragging that slider must not recompute it. */
  const breakEven = useMemo(
    () => breakEvenDownPct(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [price, county, status, use],
  );
  const answered = (qid: string) => track({ name: "hero_answer", side: "buy", meta: { qid, page: "abroad" } });

  /* Straight to the readout, not into the buyer funnel. That funnel asks what
     you have saved and what you put away each month — a first-time buyer
     closing a cash gap — and its readout names Georgia Dream throughout, which
     requires the buyer to live in the house. Every answer this page needs has
     already been given above, so there is nothing left to ask. */
  const go = `/abroad/results?s=${status}&u=${use}&p=${price}&c=${encodeURIComponent(county)}&d=${downPct}&lang=${locale}`;

  return (
    <div className="buy" lang={locale}>
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/abroad" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm" style={script}>{t("nav.abroad")}</span>
          </Link>
          <div className="row gap-2">
            <LocaleToggle locale={locale} onChange={setLocale} />
            <Link href="/buy" className="t-sm c-2 hide-sm" style={script}>{t("nav.domestic")}</Link>
            <Link href={`/book?v=abroad&lang=${locale}`} className="btn btn-p btn-sm" style={script}>{t("nav.talk")}</Link>
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

          <div className="ans" style={{ marginTop: 28, maxWidth: 940 }}>
            <div className="ans-in">
              <div className="field" style={{ marginBottom: 18 }}>
                <span className="label" style={script}>{t("ask.status")}</span>
                {/* Named as a group. Four radios with no group name are read
                    out as four unrelated options with nothing to attach them
                    to, and this is the question the whole page turns on. */}
                <div className="col gap-2" style={{ marginTop: 8 }}
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

              <div className="field" style={{ marginBottom: 18 }}>
                <span className="label" style={script}>{t("ask.use")}</span>
                <div className="g2 gap-2" style={{ marginTop: 8 }}
                  role="radiogroup" aria-label={t("ask.use")}>
                  {USES.map((u) => (
                    <label key={u.id} className="opt" data-on={use === u.id}>
                      <input type="radio" name="use" checked={use === u.id}
                        onChange={() => { setUse(u.id); answered("use"); }} />
                      <span style={script}>
                        <span className="t-sm w55">{t(`use.${u.id}`)}</span>
                        <span className="t-xs c-4" style={{ display: "block", marginTop: 2, lineHeight: 1.5 }}>{t(`use.${u.id}.note`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="g2 gap-4" style={{ alignItems: "end" }}>
                <label className="field">
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span className="label" style={{ margin: 0, ...script }}>{t("ask.price")}</span>
                    <span className="num t-sm">{money(price)}</span>
                  </div>
                  <input className="rng" type="range" min={120_000} max={750_000} step={5_000}
                    aria-label="Purchase price" aria-valuetext={money(price)}
                    value={price} onChange={(e) => { setPrice(Number(e.target.value)); answered("price"); }} />
                </label>
                <label className="field">
                  <span className="label" style={script}>{t("ask.county")}</span>
                  <select className="select" value={county} aria-label={t("ask.county")}
                    onChange={(e) => { setCounty(e.target.value); answered("county"); }}>
                    {counties.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              <label className="field" style={{ marginTop: 16 }}>
                <div className="between" style={{ marginBottom: 5 }}>
                  <span className="label" style={{ margin: 0, ...script }}>{t("ask.down")}</span>
                  <span className="num t-sm">
                    {downPct}% · {money(r.down)}
                  </span>
                </div>
                <input className="rng" type="range" min={minDown} max={60} step={1}
                  aria-label="Down payment percentage" aria-valuetext={`${downPct} percent, ${money(r.down)}`}
                  value={downPct} onChange={(e) => { setExtraDown(Number(e.target.value)); answered("down"); }} />
                <span className="t-xs c-4" style={{ marginTop: 6, display: "block", lineHeight: am ? 1.8 : 1.5, ...script }}>
                  {minDown}% {t("down.floor")}
                  {breakEven !== null
                    ? ` ${breakEven}% — ${t("down.breakEven")}`
                    : use === "rent" ? ` ${t("down.never")}` : ""}
                </span>
              </label>
            </div>

            <div className="ans-out">
              <div className="between wrap gap-4" style={{ alignItems: "flex-end" }}>
                <div>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>
                    {t("out.cashIn")}
                  </div>
                  <div className="ans-num" style={{ marginTop: 8 }}>{money(r.cashIn)}</div>
                  <div className="t-sm" style={{ marginTop: 12, color: "rgba(255,255,255,.6)" }}>
                    {r.downPct}% {t("out.down")} · {money(r.closing)} {t("out.closing")} · {r.ratePct.toFixed(2)}% {t("out.on")} {money(r.loan)}
                  </div>
                </div>
                <Link href={go} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                  <span style={script}>{t("out.cta")}</span> <Ico.arrowR size={16} />
                </Link>
              </div>

              {use === "rent" ? (
                <div className="g3 gap-3" style={{ marginTop: 26, borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 20 }}>
                  {[
                    [t("out.rent"), money(r.rent), `${county} ${t("out.rentNote")}`],
                    [
                      r.cashFlow >= 0 ? t("out.left") : t("out.short"),
                      `${r.cashFlow < 0 ? "−" : ""}${money(Math.abs(r.cashFlow))}`,
                      t("out.flowNote"),
                    ],
                    [t("out.year1"), money(r.year1.total), `${r.returnPct.toFixed(1)}% ${t("out.ofSent")}`],
                  ].map(([t, v, n]) => (
                    <div key={t}>
                      <div className="t-xs" style={{ color: "rgba(255,255,255,.5)", ...script }}>{t}</div>
                      <div className="num" style={{ fontSize: 24, color: "#fff", marginTop: 5 }}>{v}</div>
                      <div className="t-xs" style={{ color: "rgba(255,255,255,.45)", marginTop: 4, lineHeight: 1.5 }}>{n}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 22, borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 18 }}>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.72)", maxWidth: 560, lineHeight: 1.6 }}>
                    Held empty for your own use it costs {money(r.monthly.total)} a month and
                    earns nothing — but {money(r.year1.principal)} of the first year&apos;s
                    payments is principal, which is yours, not the bank&apos;s.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-4" style={{ marginTop: 16, maxWidth: 940, background: "var(--sunk)" }}>
            <div className="row gap-2" style={{ alignItems: "flex-start" }}>
              <Ico.alert size={15} className="c-brand" style={{ flex: "none", marginTop: 2 }} />
              <div>
                <div className="t-sm w6" style={script}>{t("lender.title")}</div>
                <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: am ? 1.85 : 1.6, ...script }}>{t(`status.${s.id}.asks`)}</p>
              </div>
            </div>
          </div>

          <p className="t-xs c-4" style={{ marginTop: 14, maxWidth: 700, lineHeight: am ? 1.85 : 1.6, ...script }}>
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
              <div className="card p-4" style={{ marginTop: 20, background: "var(--sunk)" }}>
                <ReturnBars cashFlow={r.year1.cashFlow} principal={r.year1.principal}
                  appreciation={r.year1.appreciation} lang={locale}
                  labels={[t("bar.rent"), t("bar.principal"), t("bar.appreciation")]} />
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
                [Ico.doc, t("why.4"), t("why.4.body")],
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

        {/* The objections, answered before they're raised. */}
        <section className="shell-w sec">
          <h2 className={am ? "" : "serif"} style={{
            fontSize: am ? "clamp(21px,2.4vw,28px)" : "clamp(24px,2.8vw,34px)",
            letterSpacing: am ? "0" : "-0.02em", maxWidth: 620,
            lineHeight: am ? 1.45 : undefined, ...script,
          }}>
            {t("faq.h2")}
          </h2>
          <div className="g2 gap-3" style={{ marginTop: 24 }}>
            {[
              [t("faq.q1"), t("faq.a1")],
              [t("faq.q2"), t("faq.a2", { pct: `${ASSUMPTIONS.managementPct}%` })],
              [t("faq.q3"), t("faq.a3")],
              [t("faq.q4"), t("faq.a4")],
              [t("faq.q5"), t("faq.a5")],
              [t("faq.q6"), t("faq.a6")],
            ].map(([q, a]) => (
              <div key={q} className="card p-4">
                <div className="t-md w6" style={script}>{q}</div>
                <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: am ? 1.9 : 1.65, ...script }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Three doors at three commitment levels. */}
        <section className="shell-w sec">
          <div className="card" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h3 className={am ? "" : "serif"} style={{
              fontSize: am ? "clamp(20px,2.4vw,28px)" : "clamp(23px,2.8vw,34px)", color: "#fff",
              letterSpacing: am ? "0" : "-0.02em", lineHeight: am ? 1.45 : 1.15, maxWidth: 620, ...script,
            }}>
              {t("doors.h3")}
            </h3>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: am ? 1.9 : 1.6, maxWidth: 560, ...script }}>
              {t("doors.lede")}
            </p>
            <div className="g3 gap-3" style={{ marginTop: 26 }}>
              {[
                { t: t("doors.1"), b: t("doors.1.body"), cta: t("doors.1.cta"), href: go, primary: true },
                { t: t("doors.2"), b: t("doors.2.body"), cta: t("doors.2.cta"), href: `/book?v=abroad&lang=${locale}`, primary: false },
                { t: t("doors.3"), b: t("doors.3.body"), cta: t("doors.3.cta"), href: "/buy", primary: false },
              ].map((d) => (
                <div key={d.t} className="col" style={{ justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="t-lg w6" style={{ color: "#fff", ...script }}>{d.t}</div>
                    <p style={{ marginTop: 7, color: "rgba(255,255,255,.62)", fontSize: 14, lineHeight: am ? 1.8 : 1.55, ...script }}>{d.b}</p>
                  </div>
                  <Link href={d.href} className="btn" style={
                    d.primary
                      ? { background: "#fff", color: "var(--ink)", width: "100%" }
                      : { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.24)", width: "100%" }
                  }><span style={script}>{d.cta}</span> <Ico.arrowR size={15} /></Link>
                </div>
              ))}
            </div>
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
                  <Link href="/buy/how" className="t-sm c-3">How it works</Link>
                  <Link href="/buy" className="t-sm c-3">Buying to live here</Link>
                </div>
                <div className="col gap-2">
                  <div className="kicker c-4">Rift</div>
                  <Link href={`/book?v=abroad&lang=${locale}`} className="t-sm c-3">Book fifteen minutes</Link>
                  <Link href="/sell" className="t-sm c-3">Selling instead?</Link>
                  <Link href="/studio" className="t-sm c-3">Sign in</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
