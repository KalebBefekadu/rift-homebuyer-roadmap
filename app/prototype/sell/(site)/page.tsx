"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { useTrack } from "@/lib/prototype/telemetry";
import { money, netProceeds, repairTriage, SELLER_DEFAULTS, type SellerInputs } from "@/lib/prototype/compute";
import { GA_COUNTIES } from "@/lib/prototype/registry";

const V = {
  "pays-back": { c: "chip-brand", l: "Worth doing" },
  photographs: { c: "chip-warn", l: "Photos only" },
  skip: { c: "chip", l: "Don't bother" },
};

export default function Sell() {
  const [s, setS] = useState<SellerInputs>(SELLER_DEFAULTS);
  const set = <K extends keyof SellerInputs>(k: K, v: SellerInputs[K]) => setS((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => netProceeds(s), [s]);
  const repairs = useMemo(() => repairTriage(s.price), [s.price]);
  const pct = Math.round((r.net / s.price) * 100);
  /* Carried into the assessment so nobody is asked the same thing twice. */
  const go = `/prototype/sell/start?p=${s.price}&o=${s.payoff}&c=${encodeURIComponent(s.county)}`;
  useTrack({ name: "landing_view", side: "sell" });

  return (
    <>
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
                    <span className="num t-sm">{money(s[k] as number)}</span>
                  </div>
                  <input className="rng" type="range" min={min} max={max} step={step}
                    value={s[k] as number} onChange={(e) => set(k, Number(e.target.value) as SellerInputs[typeof k])} />
                </label>
              ))}
              <label className="field">
                <span className="label">County</span>
                <select className="select" value={s.county} onChange={(e) => set("county", e.target.value)}>
                  {GA_COUNTIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="ans-out">
            <div className="between wrap gap-4" style={{ alignItems: "flex-end" }}>
              <div>
                <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>What you&apos;d actually walk away with</div>
                <div className="ans-num" style={{ marginTop: 8 }}>{money(r.net)}</div>
                <div className="t-sm" style={{ marginTop: 12, color: "rgba(255,255,255,.6)" }}>
                  {pct}% of the sale price · {money(r.totalCosts)} goes to payoff and costs
                </div>
              </div>
              <Link href={go} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                Break this down for my home <Ico.arrowR size={16} />
              </Link>
            </div>
          </div>
        </div>

        <p className="t-xs c-4" style={{ marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
          A planning estimate. Your payoff is exact only on a lender statement, commission is
          negotiable, prorations depend on the closing date, and repairs almost always move
          after an inspection.
        </p>
      </section>

      <section className="shell-w sec">
        <div className="g2 gap-4">
          <div className="card" style={{ overflow: "hidden" }}>
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
              <span className="t-md w6">Yours</span>
              <span className="num" style={{ fontSize: 22, color: "var(--brand-2)" }}>{money(r.net)}</span>
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
              and tell you exactly who decides — your county, your lender, or a tax professional.
            </p>
            <Link href={go} className="btn btn-brand" style={{ marginTop: 18 }}>
              Check mine <Ico.arrowR size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className="shell-w sec">
        <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em", maxWidth: 520 }}>
          And an honest answer on what to fix.
        </h2>
        <div className="card" style={{ marginTop: 24, overflow: "hidden" }}>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th style={{ paddingLeft: 20 }}>Work</th><th className="num-c">Typical cost</th><th>Verdict</th><th style={{ paddingRight: 20 }}>Why</th></tr></thead>
              <tbody>
                {repairs.map((x) => (
                  <tr key={x.item}>
                    <td className="w55" style={{ paddingLeft: 20 }}>{x.item}</td>
                    <td className="num-c num">{money(x.cost)}</td>
                    <td><span className={`chip ${V[x.verdict].c}`}>{V[x.verdict].l}</span></td>
                    <td className="t-sm c-3" style={{ paddingRight: 20 }}>{x.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            Net proceeds, unclaimed value, what to fix, when to list, and a dated plan — yours
            whether or not we ever speak.
          </p>
          <div className="g3 gap-3" style={{ marginTop: 26 }}>
            {[
              { t: "Answer six questions", b: "The full readout on your home. No account, no address lookup.", cta: "Start", href: go, primary: true },
              { t: "Just the money I'm losing", b: "Exemptions, appeals and reliefs, and who decides each one. Worth reading even if you never sell.", cta: "Unclaimed value", href: "/prototype/sell/unclaimed", primary: false },
              { t: "I'd rather just ask someone", b: "Fifteen minutes with Kaleb. No listing presentation, and he calls you.", cta: "See open times", href: "/prototype/book?v=sell", primary: false },
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
    </>
  );
}
