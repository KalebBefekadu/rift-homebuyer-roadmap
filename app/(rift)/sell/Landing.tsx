"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Announce } from "@/components/rift/Live";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";
import { money, netProceeds, SELLER_DEFAULTS, type SellerInputs } from "@/lib/core/compute";

/**
 * The seller landing page.
 *
 * The mirror of the buyer thesis: the down payment is not the number, and the
 * list price is not the number either. Three sliders, and the figure moves as
 * they move — a seller who drags their payoff and watches what they keep fall
 * has learnt the product's entire argument without reading a word of it.
 *
 * Deliberately shorter than the buyer page. A seller arrives with one question
 * and it is answerable in the hero; the repair triage that used to sit here is
 * a readout section, not a reason to keep scrolling, and it is two clicks away
 * for anyone who wants it.
 *
 * All three answers carry into the assessment so nobody is asked twice.
 */
export function Landing({ counties }: { counties: string[] }) {
  const [s, setS] = useState<SellerInputs>(SELLER_DEFAULTS);
  const set = <K extends keyof SellerInputs>(k: K, v: SellerInputs[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "sell" });

  const r = useMemo(() => netProceeds(s), [s]);
  const pct = Math.round((r.net / s.price) * 100);
  /* The payoff slider reaches $700,000 and the price slider starts at
     $150,000, so this panel can be — and was — asked to describe a sale that
     does not cover the loan. It answered "What you'd actually walk away with:
     -$566,000", at -377% of the price. The readout was rewritten for this case
     last week; the front door, which is where a seller meets the product, was
     not. Same defect, one page earlier: the arithmetic is right and every word
     around it is written for somebody in the opposite situation. */
  const underwater = r.net < 0;
  const short = money(Math.abs(r.net));
  const go = `/sell/start?p=${s.price}&o=${s.payoff}&c=${encodeURIComponent(s.county)}`;

  return (
    <div className="sell">
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/sell" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">Sellers</span>
          </Link>
          <div className="row gap-3">
            <Link href="/sell/unclaimed" className="t-sm c-2 hide-sm">Unclaimed value</Link>
            <Link href="/sell/how" className="t-sm c-2 hide-sm">How it works</Link>
            <Link href="/sell/start" className="btn btn-p btn-sm">Estimate my net</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Answer first. Three numbers, and the answer moves as they move. */}
        <section className="shell-w">
          <div style={{ paddingTop: "clamp(34px,5vw,64px)", maxWidth: 760 }}>
            <h1 className="serif" style={{ fontSize: "clamp(32px,4.6vw,56px)", lineHeight: 1.06, letterSpacing: "-0.028em" }}>
              Everyone tells you what it&apos;s worth. Nobody tells you what you keep.
            </h1>
            <p className="lede" style={{ marginTop: 16, maxWidth: 500 }}>
              Three numbers. No account, no address lookup, no call from anyone.
            </p>
          </div>

          <div className="ans" style={{ marginTop: 28, maxWidth: 880 }}>
            <div className="ans-in">
              <div className="g3 gap-4">
                {([
                  ["price", "What you'd sell for", 150_000, 900_000, 5_000],
                  ["payoff", "What you still owe", 0, 700_000, 5_000],
                ] as const).map(([k, label, min, max, step]) => (
                  <label key={k} className="field">
                    <div className="between" style={{ marginBottom: 5 }}>
                      <span className="label" style={{ margin: 0 }}>{label}</span>
                      <span className="num t-sm">{money(s[k])}</span>
                    </div>
                    {/* Without valuetext a screen reader reads the raw
                        number — "four hundred twenty thousand" as digits, with
                        no currency. The visible label already says money. */}
                    <input className="rng" type="range" min={min} max={max} step={step} value={s[k]}
                      aria-valuetext={money(s[k])}
                      onChange={(e) => { set(k, Number(e.target.value)); track({ name: "hero_answer", side: "sell", meta: { qid: k } }); }} />
                  </label>
                ))}
                <label className="field">
                  <span className="label">County</span>
                  <select className="select" value={s.county} aria-label="County"
                    onChange={(e) => { set("county", e.target.value); track({ name: "hero_answer", side: "sell", meta: { qid: "county" } }); }}>
                    {counties.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="ans-out">
              <div className="between wrap gap-4" style={{ alignItems: "flex-end" }}>
                <div>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>
                    {underwater
                      ? "What you\u2019d have to bring to the closing table"
                      : "What you\u2019d actually walk away with"}
                  </div>
                  <div className="ans-num" style={{ marginTop: 8 }}>
                    {underwater ? short : money(r.net)}
                  </div>
                  <div className="t-sm" style={{ marginTop: 12, color: "rgba(255,255,255,.6)" }}>
                    {underwater
                      ? `This sale doesn\u2019t cover the ${money(s.payoff)} you still owe · ${money(r.totalCosts - s.payoff)} of that is the cost of selling`
                      : `${pct}% of the sale price · ${money(r.totalCosts)} goes to payoff and costs`}
                  </div>
                </div>
                <Link href={go} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                  Break this down for my home <Ico.arrowR size={16} />
                </Link>
              </div>
              <Announce>
                {underwater
                  ? `On a ${money(s.price)} sale against ${money(s.payoff)} still owed, you would need to bring about ${short} to the closing table.`
                  : `On a ${money(s.price)} sale with ${money(s.payoff)} still owed, you would walk away with about ${money(r.net)}, ${pct} percent of the price.`}
              </Announce>
            </div>
          </div>

          <p className="t-xs c-4" style={{ marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
            A planning estimate. Your payoff is exact only on a lender statement, commission is
            negotiable, prorations depend on the closing date, and repairs almost always move
            after an inspection.
          </p>
        </section>

        {/* Where it goes, and what they may already be losing. */}
        <section className="shell-w sec">
          <div className="g2 gap-4">
            <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
              <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-md w6">Where the money goes</span>
                <span className="num t-sm c-4">{money(s.price)}</span>
              </div>
              {r.costs.map((c) => (
                <div key={c.label} className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                  <div className="grow">
                    <div className="t-sm w5">{c.label}</div>
                    <div className="t-xs c-4" style={{ marginTop: 1 }}>{c.note}</div>
                  </div>
                  <span className="num t-sm c-neg">−{money(c.amount)}</span>
                </div>
              ))}
              <div className="between" style={{ padding: "15px 18px", background: "var(--brand-wash)" }}>
                <span className="t-md w6">{underwater ? "Still owed" : "Yours"}</span>
                <span className="num" style={{ fontSize: 22, color: underwater ? "var(--neg)" : "var(--brand-2)" }}>
                  {underwater ? short : money(r.net)}
                </span>
              </div>
            </div>

            <div>
              <div className="kicker c-brand">And before you list</div>
              <h2 className="serif" style={{ fontSize: "clamp(26px,3.2vw,38px)", lineHeight: 1.1, marginTop: 12, letterSpacing: "-0.022em" }}>
                You may already be losing money you could stop losing.
              </h2>
              <div className="col gap-2" style={{ marginTop: 20 }}>
                {[
                  ["A homestead exemption never filed", "$600 – $1,400 a year"],
                  ["An assessment worth appealing", "Window is short and strictly enforced"],
                  ["Age-based school tax relief", "$1,100 – $3,200 a year"],
                  ["The capital gains exclusion", "Up to $500,000 if you qualify"],
                  ["A prepayment penalty nobody checked", "Better found now than at closing"],
                ].map(([t, v]) => (
                  <div key={t} className="card between p-3 gap-3">
                    <span className="t-sm w5 grow">{t}</span>
                    <span className="t-xs w55 c-brand" style={{ textAlign: "right", flex: "none" }}>{v}</span>
                  </div>
                ))}
              </div>
              <p className="t-xs c-4" style={{ marginTop: 14, lineHeight: 1.6 }}>
                We&apos;re not tax advisors or attorneys. We notice the question is worth asking
                and tell you exactly who decides — your county, your lender, or a tax
                professional.
              </p>
              <Link href="/sell/unclaimed" className="btn btn-brand" style={{ marginTop: 18 }}>
                Check mine <Ico.arrowR size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* Three doors at three commitment levels. */}
        <section className="shell-w sec">
          <div className="card" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h3 className="serif" style={{ fontSize: "clamp(23px,2.8vw,34px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 540 }}>
              Six questions and you&apos;ll know where you stand.
            </h3>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
              Net proceeds, unclaimed value, what&apos;s worth fixing, when to list, and a dated
              plan — yours whether or not we ever speak.
            </p>
            <div className="g3 gap-3" style={{ marginTop: 26 }}>
              {[
                { t: "Answer six questions", b: "The full readout on your home. No account, no address lookup.", cta: "Start", href: go, primary: true },
                { t: "Just the money I'm losing", b: "Exemptions, appeals and reliefs, and who decides each one. Worth reading even if you never sell.", cta: "Unclaimed value", href: "/sell/unclaimed", primary: false },
                { t: "I'd rather just ask someone", b: "Fifteen minutes with Kaleb. No listing presentation, and he calls you.", cta: "See open times", href: "/book?v=sell", primary: false },
              ].map((d) => (
                <div key={d.t} className="col" style={{ justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="t-lg w6" style={{ color: "#fff" }}>{d.t}</div>
                    <p style={{ marginTop: 7, color: "rgba(255,255,255,.62)", fontSize: 14, lineHeight: 1.55 }}>{d.b}</p>
                  </div>
                  <Link href={d.href} className="btn" style={
                    d.primary
                      ? { background: "#fff", color: "var(--ink)", width: "100%" }
                      : { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.24)", width: "100%" }
                  }>{d.cta} <Ico.arrowR size={15} /></Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 48 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <div className="between wrap gap-4" style={{ alignItems: "flex-start" }}>
              <div style={{ maxWidth: 380 }}>
                <Link href="/sell" className="row gap-2">
                  <Mark size={18} />
                  <span className="mark-name" style={{ fontSize: 17 }}>Rift</span>
                </Link>
                <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6 }}>
                  Rift for sellers. Guided by Kaleb Befekadu in Georgia. Every figure is a
                  planning estimate, not a lending commitment, approval, or valuation.
                </p>
                <Link href="/buy" className="btn btn-g btn-sm" style={{ marginTop: 16 }}>
                  Buying instead? <Ico.arrowR size={14} />
                </Link>
              </div>
              <div className="row gap-4" style={{ alignItems: "flex-start" }}>
                <div className="col gap-2">
                  <div className="kicker c-4">This product</div>
                  <Link href="/sell/unclaimed" className="t-sm c-3">Unclaimed value</Link>
                  <Link href="/sell/how" className="t-sm c-3">How it works</Link>
                  <Link href="/sell/start" className="t-sm c-3">Start</Link>
                </div>
                <div className="col gap-2">
                  <div className="kicker c-4">Rift</div>
                  <Link href="/book?v=sell" className="t-sm c-3">Book fifteen minutes</Link>
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
