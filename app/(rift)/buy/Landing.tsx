"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";

/**
 * The buyer landing page.
 *
 * The product thesis in one screen: answer two questions and get a real number
 * before being asked for anything. The two answers carry into the assessment,
 * so nobody is asked the same thing twice — being re-asked something you just
 * answered is the clearest possible signal that a form is not listening.
 *
 * Three doors at three commitment levels, because one repeated button converts
 * one kind of person. Somebody ready to work is not the same visitor as
 * somebody who wants to see the programmes and leave.
 */

const TIMING = ["In the next 3 months", "3 to 9 months", "9 to 18 months", "Just exploring"];

export function Landing({
  counties, openRange, matchedCount, suppressedCount, exampleCash, exampleDown, registrySource,
}: {
  counties: string[];
  openRange: string | null;
  matchedCount: number;
  suppressedCount: number;
  exampleCash: string;
  exampleDown: string;
  registrySource: "database" | "seed";
}) {
  const router = useRouter();
  const [county, setCounty] = useState("");
  const [timing, setTiming] = useState("");

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "buy", meta: { matched: matchedCount, source: registrySource } });

  const go = () => {
    track({ name: "hero_answer", side: "buy", meta: { answered: 2 } });
    const q = new URLSearchParams({ c: county, t: timing });
    router.push(`/buy/start?${q}`);
  };

  const ready = county && timing;

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/buy" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">for buyers</span>
          </Link>
          <div className="row gap-1">
            <Link href="/buy/programs" className="btn btn-g btn-sm hide-sm">Georgia programs</Link>
            <Link href="/buy/start" className="btn btn-p btn-sm">Get my numbers</Link>
          </div>
        </div>
      </header>

      <main className="buy">
        {/* The hero asks before it tells. Two questions, and the second one is
            the strongest single predictor we will ever collect. */}
        <section className="shell-w" style={{ paddingTop: "clamp(30px,5vw,64px)" }}>
          <h1 className="serif" style={{
            fontSize: "clamp(30px,5vw,56px)", lineHeight: 1.06, letterSpacing: "-0.03em", maxWidth: 780,
          }}>
            The down payment is not the number.
          </h1>
          <p className="lede" style={{ marginTop: 16, maxWidth: 620 }}>
            On a typical first home the down payment is {exampleDown}. The amount that actually
            has to be in an account is <strong>{exampleCash}</strong>. Almost nobody is told the
            second figure until the last three weeks, which is when purchases fall apart.
          </p>

          <div className="card p-5" style={{ marginTop: 28, maxWidth: 620 }}>
            <div className="t-sm w6" style={{ marginBottom: 14 }}>Two questions. Then real numbers.</div>

            <label className="field">
              <span className="label">Which Georgia county?</span>
              <select className="input" value={county} onChange={(e) => setCounty(e.target.value)}>
                <option value="">Choose a county</option>
                {counties.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <div className="field" style={{ marginTop: 14 }}>
              <span className="label">When would you like to be in a home?</span>
              <div className="col gap-2" style={{ marginTop: 6 }}>
                {TIMING.map((t) => (
                  <label key={t} className="opt" data-on={timing === t}>
                    <input type="radio" name="timing" checked={timing === t} onChange={() => setTiming(t)} />
                    <span className="t-sm">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="btn btn-p" style={{ width: "100%", marginTop: 16 }} disabled={!ready} onClick={go}>
              {ready ? "Show me my numbers" : "Answer both to continue"}
              <Ico.arrowR size={15} />
            </button>
            <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.55 }}>
              No account, no email, nothing to cancel. You keep the result whether or not you
              ever speak to us.
            </p>
          </div>

          {openRange ? (
            <div className="card p-4" style={{ marginTop: 20, maxWidth: 620, background: "var(--sunk)" }}>
              <div className="row gap-2">
                <Ico.spark size={15} className="c-brand" />
                <span className="t-sm w6">
                  {matchedCount} Georgia program{matchedCount === 1 ? "" : "s"} currently open, worth {openRange}
                </span>
              </div>
              <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Estimated ranges with conditions attached, never approvals — a lender confirms
                what you can actually use. Each one was verified against its administrator, and
                {suppressedCount > 0
                  ? ` ${suppressedCount} more ${suppressedCount === 1 ? "is" : "are"} being withheld because we have not re-checked ${suppressedCount === 1 ? "it" : "them"} recently enough.`
                  : " every programme here has been re-checked inside the verification window."}
              </p>
            </div>
          ) : null}
        </section>

        <section className="shell-w sec">
          <h2 className="serif" style={{ fontSize: "clamp(22px,3vw,34px)", letterSpacing: "-0.02em", maxWidth: 640 }}>
            What you get, before you give anything
          </h2>
          <div className="col gap-2" style={{ marginTop: 18, maxWidth: 700 }}>
            {[
              ["The real cash to close", "Every line — down payment, closing costs, prepaid escrow, inspection, appraisal, the move. Earnest money shown separately, because you get it back."],
              ["The programs you may qualify for", "Named, with what each one asks of you and who administers it. Closed and waitlisted ones shown with their state rather than hidden."],
              ["How far away you actually are", "Months, from your own saving rate — and what changes it most, ranked."],
              ["The questions to ask a lender", "Written down, so the first call is not the one where you learn what you did not know to ask."],
            ].map(([t, d]) => (
              <div key={t} className="row gap-3" style={{ alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid var(--line-3)" }}>
                <Ico.check size={15} className="c-brand" style={{ flex: "none", marginTop: 3 }} />
                <div>
                  <div className="t-sm w6">{t}</div>
                  <p className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.6 }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Three doors at three commitment levels. */}
        <section className="shell-w sec">
          <div className="g3 gap-3">
            {[
              { href: "/buy/start", title: "Answer the questions", note: "Seven questions, about four minutes, and you get everything above.", primary: true },
              { href: "/buy/programs", title: "Just show me the programs", note: "Every Georgia program we track, including the ones that are closed." },
              { href: "/buy/how", title: "Just tell me how this works", note: "What Rift does, what it will not do, and how it makes money." },
            ].map((d) => (
              <Link key={d.href} href={d.href} className="card p-4" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="between">
                  <span className="t-sm w6">{d.title}</span>
                  <Ico.arrowR size={14} className={d.primary ? "c-brand" : "c-4"} />
                </div>
                <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{d.note}</p>
              </Link>
            ))}
          </div>
        </section>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 40 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <p className="t-xs c-4" style={{ lineHeight: 1.6, maxWidth: 620 }}>
              Prepared by Rift, guided by Kaleb Befekadu, Peachtree Cardinal, Georgia. Every
              figure is a planning estimate, not a lending commitment, approval, or valuation.
              Nothing here requires you to work with us, and none of it stops working if you don&apos;t.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
