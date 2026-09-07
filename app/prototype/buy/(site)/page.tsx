"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { track, useTrack } from "@/lib/prototype/telemetry";
import { GA_COUNTIES, matchPrograms, FUNDING_LABEL } from "@/lib/core/registry";
import { money, cashToClose, BUYER_DEFAULTS } from "@/lib/core/compute";
import { firstTimeFrom, OWNERSHIP_CAVEAT, BUY_FUNNEL, type Ownership } from "@/lib/core/funnel";

export default function Buy() {
  const [county, setCounty] = useState("DeKalb");
  const [own, setOwn] = useState<Ownership>("none");
  const first = firstTimeFrom(own);
  const m = useMemo(() => matchPrograms({ county, firstTimeBuyer: first }), [county, first]);
  const cash = cashToClose({ ...BUYER_DEFAULTS, price: 325_000 });
  /* Carried into the assessment so nobody is asked the same thing twice. */
  const go = `/prototype/buy/start?c=${encodeURIComponent(county)}&o=${own}`;
  const OWN_OPTS = BUY_FUNNEL.questions.find((q) => q.id === "ownership")!.options!;
  useTrack({ name: "landing_view", side: "buy" });

  return (
    <>
      {/* answer first */}
      <section className="shell-w">
        <div style={{ paddingTop: "clamp(34px,5vw,64px)", maxWidth: 720 }}>
          <h1 className="serif" style={{ fontSize: "clamp(32px,4.6vw,56px)", lineHeight: 1.06, letterSpacing: "-0.028em" }}>
            There may be money waiting for you in Georgia.
          </h1>
          <p className="lede" style={{ marginTop: 16, maxWidth: 480 }}>
            Two questions. No account, no email, no phone call.
          </p>
        </div>

        <div className="ans" style={{ marginTop: 28, maxWidth: 880 }}>
          <div className="ans-in">
            <div className="g2 gap-4" style={{ alignItems: "end" }}>
              <label className="field">
                <span className="label">Which county are you looking in?</span>
                <select className="select input-lg" value={county} onChange={(e) => { setCounty(e.target.value); track({ name: "hero_answer", side: "buy", qid: "county" }); }}>
                  {GA_COUNTIES.map((c) => <option key={c}>{c} County</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Have you owned a home in the last three years?</span>
                <select className="select input-lg" value={own} onChange={(e) => { setOwn(e.target.value as Ownership); track({ name: "hero_answer", side: "buy", qid: "ownership" }); }}>
                  {OWN_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="ans-out">
            {m.matched.length === 0 ? (
              <>
                <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>Nothing verified matches those answers today</div>
                <p style={{ marginTop: 10, color: "rgba(255,255,255,.72)", fontSize: 15, maxWidth: 480, lineHeight: 1.6 }}>
                  That doesn&apos;t mean nothing exists — only that we won&apos;t show you a
                  number we can&apos;t stand behind. Your cash-to-close figure still matters.
                </p>
                <Link href={go} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)", marginTop: 20 }}>
                  Work out what I&apos;d need <Ico.arrowR size={16} />
                </Link>
              </>
            ) : (
              <div className="between wrap gap-4" style={{ alignItems: "flex-end" }}>
                <div>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>
                    You may qualify for, in {county} County
                  </div>
                  <div className="ans-num" style={{ marginTop: 8 }}>
                    {money(m.usableMin)}<span style={{ color: "rgba(255,255,255,.38)" }}>–</span>{money(m.usableMax)}
                  </div>
                  <div className="row gap-1 wrap" style={{ marginTop: 16 }}>
                    {m.matched.map((p) => (
                      <span key={p.id} style={{
                        fontSize: 11.5, fontWeight: 500, padding: "3px 9px", borderRadius: 5,
                        background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)",
                        color: p.funding === "open" ? "#8fe3bf" : "rgba(255,255,255,.6)",
                      }}>{p.name.split(" ").slice(0, 3).join(" ")} · {FUNDING_LABEL[p.funding]}</span>
                    ))}
                  </div>
                </div>
                <Link href={go} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                  What this does to my numbers <Ico.arrowR size={16} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {own === "investment" ? (
          <div className="card p-3" style={{ marginTop: 14, maxWidth: 640, background: "var(--warn-wash)", borderColor: "var(--warn-line)" }}>
            <p className="t-xs c-2" style={{ lineHeight: 1.6 }}>{OWNERSHIP_CAVEAT.investment}</p>
          </div>
        ) : null}

        <p className="t-xs c-4" style={{ marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
          Estimated ranges, not approvals. Income limits, purchase-price caps and funding
          availability decide what you can actually use — your lender and the program confirm it.
          Anything we haven&apos;t verified in 90 days isn&apos;t shown at all.
        </p>
      </section>

      {/* second answer */}
      <section className="shell-w sec">
        <div className="g2 gap-4" style={{ alignItems: "center" }}>
          <div>
            <div className="kicker c-brand">The other number</div>
            <h2 className="serif" style={{ fontSize: "clamp(26px,3.2vw,40px)", lineHeight: 1.1, marginTop: 12, letterSpacing: "-0.022em" }}>
              You&apos;ve been told the down payment. That&apos;s not what you need.
            </h2>
            <p className="t-md c-2" style={{ marginTop: 14, lineHeight: 1.65, maxWidth: 440 }}>
              On a {money(325_000)} home the down payment at 3.5% is {money(cash.down)}. The
              cash you actually bring is {money(cash.total)} — and that difference is what
              breaks most purchases in the last three weeks.
            </p>
            <Link href={go} className="btn btn-brand" style={{ marginTop: 22 }}>
              See my real figure <Ico.arrowR size={15} />
            </Link>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            {cash.lines.map((l) => (
              <div key={l.label} className="between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                <div className="grow">
                  <div className="row gap-2">
                    <span className="t-sm w5">{l.label}</span>
                    {l.credited ? <span className="chip chip-brand">back at closing</span> : null}
                  </div>
                </div>
                <span className="num t-sm" style={{ opacity: l.credited ? 0.4 : 1 }}>{money(l.amount)}</span>
              </div>
            ))}
            <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
              <span className="t-md w6">What you bring</span>
              <span className="num" style={{ fontSize: 21 }}>{money(cash.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* what you get — a list, not six cards. Six cards is a brochure. */}
      <section className="shell-w sec">
        <div className="split-w">
          <div>
            <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em", maxWidth: 420, lineHeight: 1.14 }}>
              Seven minutes gets you all of this, free.
            </h2>
            <p className="t-md c-3" style={{ marginTop: 14, lineHeight: 1.65, maxWidth: 400 }}>
              Not a brochure and not a callback. A document with your numbers in it, yours to keep
              whether or not we ever speak.
            </p>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {[
              [Ico.spark, "Your assistance match", "Named programs, what each requires, what it does to your gap"],
              [Ico.wallet, "True cash to close", "Every line, including the ones nobody mentions until three weeks out"],
              [Ico.clock, "Your gap and your timeline", "How many months — and the two changes that shorten it most"],
              [Ico.chart, "Monthly across a price band", "Three price points, all in, so you see the shape of the trade"],
              [Ico.alert, "The one thing in your way", "Named plainly, with what to do about it"],
              [Ico.doc, "Questions for any lender", "Written for your situation. Take it to anyone."],
            ].map(([I, t, b], i, arr) => {
              const Icon = I as React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
              return (
                <div key={i} className="row gap-3" style={{
                  padding: "13px 18px", alignItems: "flex-start",
                  borderBottom: i === arr.length - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <Icon size={16} className="c-brand" style={{ marginTop: 2, flex: "none" }} />
                  <div>
                    <div className="t-md w55">{t as string}</div>
                    <p className="t-xs c-3" style={{ marginTop: 2, lineHeight: 1.5 }}>{b as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Three doors at three commitment levels. One repeated button converts
          one kind of person; most visitors are not that person yet. */}
      <section className="shell-w sec">
        <div className="card" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
          <h3 className="serif" style={{ fontSize: "clamp(23px,2.8vw,34px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 520 }}>
            Nothing here is held back until you sign up.
          </h3>
          <div className="g3 gap-3" style={{ marginTop: 26 }}>
            {[
              { t: "Answer seven questions", b: "The full readout. About seven minutes, no account.", cta: "Start", href: go, primary: true },
              { t: "Just show me the programs", b: "Every Georgia program we track, with what each one asks of you. No questions at all.", cta: "Browse assistance", href: "/prototype/buy/assistance", primary: false },
              { t: "I'd rather just ask someone", b: "Fifteen minutes with Kaleb. Nothing to sign, and he calls you.", cta: "See open times", href: "/prototype/book?v=buy", primary: false },
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
