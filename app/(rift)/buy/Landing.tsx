"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Announce } from "@/components/rift/Live";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";
import { matchPrograms, FUNDING_LABEL, type AssistanceProgram } from "@/lib/core/registry";
import { money, cashToClose, BUYER_DEFAULTS } from "@/lib/core/compute";
import { firstTimeFrom, OWNERSHIP_CAVEAT, BUY_FUNNEL, type Ownership } from "@/lib/core/funnel";

/**
 * The buyer landing page.
 *
 * It answers before it asks. The two questions in the hero are not a form
 * standing between the visitor and the product: answering them IS the
 * product, and the panel underneath updates as they answer. Somebody who
 * changes the county and watches the number move has already understood what
 * this does, which no amount of explanatory copy achieves.
 *
 * Both answers carry into the assessment, so nobody is asked the same thing
 * twice. Being re-asked something you just answered is the clearest possible
 * signal that a form is not listening.
 *
 * Three doors at three commitment levels at the end, because one repeated
 * button converts one kind of person, and most visitors are not that person
 * yet.
 */
export function Landing({
  counties, programs, todayISO, matchedCount, suppressedCount, registrySource,
}: {
  counties: string[];
  programs: AssistanceProgram[];
  todayISO: string;
  matchedCount: number;
  suppressedCount: number;
  registrySource: "database" | "seed";
}) {
  const [county, setCounty] = useState("DeKalb");
  const [own, setOwn] = useState<Ownership>("none");

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "buy", meta: { matched: matchedCount, source: registrySource } });

  const today = useMemo(() => new Date(todayISO), [todayISO]);
  const first = firstTimeFrom(own);
  const m = useMemo(
    () => matchPrograms({ county, firstTimeBuyer: first, programs, today }),
    [county, first, programs, today],
  );

  const cash = cashToClose({ ...BUYER_DEFAULTS, price: 325_000 });
  const ownOpts = BUY_FUNNEL.questions.find((q) => q.id === "ownership")!.options!;
  const go = `/buy/start?c=${encodeURIComponent(county)}&o=${own}`;

  const answered = (qid: string) => track({ name: "hero_answer", side: "buy", meta: { qid } });

  return (
    <div className="buy">
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/buy" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">Buyers</span>
          </Link>
          <div className="row gap-3">
            <Link href="/buy/programs" className="t-sm c-2 hide-sm">Georgia programs</Link>
            <Link href="/buy/how" className="t-sm c-2 hide-sm">How it works</Link>
            <Link href="/buy/start" className="btn btn-p btn-sm">Get my numbers</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Answer first. The panel below the questions is the whole argument. */}
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
                  <select className="select input-lg" value={county}
                    onChange={(e) => { setCounty(e.target.value); answered("county"); }}>
                    {counties.map((c) => <option key={c} value={c}>{c} County</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Have you owned a home in the last three years?</span>
                  <select className="select input-lg" value={own}
                    onChange={(e) => { setOwn(e.target.value as Ownership); answered("ownership"); }}>
                    {ownOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="ans-out">
              {m.matched.length === 0 ? (
                <>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>
                    Nothing verified matches those answers today
                  </div>
                  <p style={{ marginTop: 10, color: "rgba(255,255,255,.72)", fontSize: 15, maxWidth: 480, lineHeight: 1.6 }}>
                    That doesn&apos;t mean nothing exists, only that we won&apos;t show you a
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
              <Announce>
                {m.matched.length === 0
                  ? `Nothing verified matches ${county} County with those answers today. Your cash-to-close figure still applies.`
                  : `You may qualify for ${money(m.usableMin)} to ${money(m.usableMax)} in ${county} County, across ${m.matched.length} ${m.matched.length === 1 ? "program" : "programs"}.`}
              </Announce>
            </div>
          </div>

          {own === "investment" ? (
            <div className="card p-3" style={{ marginTop: 14, maxWidth: 640, background: "var(--sunk)" }}>
              <p className="t-xs c-2" style={{ lineHeight: 1.6 }}>{OWNERSHIP_CAVEAT.investment}</p>
            </div>
          ) : null}

          <p className="t-xs c-4" style={{ marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
            Estimated ranges, not approvals. Income limits, purchase-price caps and funding
            availability decide what you can actually use; your lender and the program confirm
            it. Anything we haven&apos;t verified in 90 days isn&apos;t shown at all
            {suppressedCount > 0
              ? `, and ${suppressedCount} ${suppressedCount === 1 ? "program is" : "programs are"} being withheld for that reason right now.`
              : "."}
          </p>
        </section>

        {/* The second answer: the number they were never given. */}
        <section className="shell-w sec">
          <div className="g2 gap-4" style={{ alignItems: "center" }}>
            <div>
              <div className="kicker c-brand">The other number</div>
              <h2 className="serif" style={{ fontSize: "clamp(26px,3.2vw,40px)", lineHeight: 1.1, marginTop: 12, letterSpacing: "-0.022em" }}>
                You&apos;ve been told the down payment. That&apos;s not what you need.
              </h2>
              <p className="t-md c-2" style={{ marginTop: 14, lineHeight: 1.65, maxWidth: 440 }}>
                On a {money(325_000)} home the down payment at 3.5% is {money(cash.down)}. The
                cash you actually bring is {money(cash.total)}, and that difference is what
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
                  {/* Ink, not opacity: the same fix as the readout, which carries its own
                      copy of this block. `opacity: 0.4` put a real dollar figure at
                      2.65:1, and the "back at closing" chip beside it was already
                      saying the thing the fade was supposedly saying. */}
                  <span className="num t-sm" style={{ color: l.credited ? "var(--ink-4)" : undefined }}>{money(l.amount)}</span>
                </div>
              ))}
              <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
                <span className="t-md w6">What you bring</span>
                <span className="num" style={{ fontSize: 21 }}>{money(cash.total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* What you get. A list, not six cards: six cards is a brochure. */}
        <section className="shell-w sec">
          <div className="split-w">
            <div>
              <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em", maxWidth: 420, lineHeight: 1.14 }}>
                Seven minutes gets you all of this, free.
              </h2>
              <p className="t-md c-3" style={{ marginTop: 14, lineHeight: 1.65, maxWidth: 400 }}>
                Not a brochure and not a callback. A document with your numbers in it, yours to
                keep whether or not we ever speak.
              </p>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {([
                [Ico.spark, "Your assistance match", "Named programs, what each requires, what it does to your gap"],
                [Ico.wallet, "True cash to close", "Every line, including the ones nobody mentions until three weeks out"],
                [Ico.clock, "Your gap and your timeline", "How many months, and the two changes that shorten it most"],
                [Ico.chart, "Monthly across a price band", "Three price points, all in, so you see the shape of the trade"],
                [Ico.alert, "The one thing in your way", "Named plainly, with what to do about it"],
                [Ico.doc, "Questions for any lender", "Written for your situation. Take it to anyone."],
              ] as const).map(([Icon, t, b], i, arr) => (
                <div key={t} className="row gap-3" style={{
                  padding: "13px 18px", alignItems: "flex-start",
                  borderBottom: i === arr.length - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <Icon size={16} className="c-brand" style={{ marginTop: 2, flex: "none" }} />
                  <div>
                    <div className="t-md w55">{t}</div>
                    <p className="t-xs c-3" style={{ marginTop: 2, lineHeight: 1.5 }}>{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Three doors at three commitment levels. */}
        <section className="shell-w sec">
          <div className="card" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h3 className="serif" style={{ fontSize: "clamp(23px,2.8vw,34px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 520 }}>
              Nothing here is held back until you sign up.
            </h3>
            <div className="g3 gap-3" style={{ marginTop: 26 }}>
              {[
                { t: "Answer seven questions", b: "The full readout. About seven minutes, no account.", cta: "Start", href: go, primary: true },
                { t: "Just show me the programs", b: "Every Georgia program we track, with what each one asks of you. No questions at all.", cta: "Browse assistance", href: "/buy/programs", primary: false },
                { t: "I'd rather just ask someone", b: "Fifteen minutes with Kaleb. Nothing to sign, and he calls you.", cta: "See open times", href: "/book?v=buy", primary: false },
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
                <Link href="/buy" className="row gap-2">
                  <Mark size={18} />
                  <span className="mark-name" style={{ fontSize: 17 }}>Rift</span>
                </Link>
                <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6 }}>
                  Rift for buyers. Guided by Kaleb Befekadu in Georgia. Every figure is a
                  planning estimate, not a lending commitment, approval, or valuation.
                </p>
                <Link href="/sell" className="btn btn-g btn-sm" style={{ marginTop: 16 }}>
                  Selling instead? <Ico.arrowR size={14} />
                </Link>
              </div>
              <div className="row gap-4" style={{ alignItems: "flex-start" }}>
                <div className="col gap-2">
                  <div className="kicker c-4">This product</div>
                  <Link href="/buy/programs" className="t-sm c-3">Assistance</Link>
                  <Link href="/buy/how" className="t-sm c-3">How it works</Link>
                  <Link href="/buy/start" className="t-sm c-3">Start</Link>
                </div>
                <div className="col gap-2">
                  <div className="kicker c-4">Rift</div>
                  <Link href="/book?v=buy" className="t-sm c-3">Book fifteen minutes</Link>
                  <Link href="/privacy" className="t-sm c-3">What we keep</Link>
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
