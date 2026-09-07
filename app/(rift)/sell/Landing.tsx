"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";

/**
 * The seller landing page.
 *
 * Same shape as the buyer side and for the same reason: answer two questions,
 * get a real number, be asked for nothing. The two answers carry into the
 * assessment so nobody is asked the same thing twice.
 *
 * Three doors at three commitment levels. Somebody who wants to know whether
 * they are losing money on exemptions is not the same visitor as somebody
 * ready to list.
 */

const TIMING = ["In the next 3 months", "3 to 9 months", "9 to 18 months", "Just exploring"];

export function Landing({ counties, examplePrice, exampleNet, exampleCosts }: {
  counties: string[];
  examplePrice: string;
  exampleNet: string;
  exampleCosts: string;
}) {
  const router = useRouter();
  const [county, setCounty] = useState("");
  const [timing, setTiming] = useState("");

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "sell" });

  const go = () => {
    track({ name: "hero_answer", side: "sell", meta: { answered: 2 } });
    const q = new URLSearchParams({ c: county, t: timing });
    router.push(`/sell/start?${q}`);
  };

  const ready = county && timing;

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
            <span className="chip chip-brand hide-sm">for sellers</span>
          </Link>
          <div className="row gap-3">
            <Link href="/sell/unclaimed" className="t-sm c-2 hide-sm">Unclaimed value</Link>
            <Link href="/sell/how" className="t-sm c-2 hide-sm">How it works</Link>
            <Link href="/sell/start" className="btn btn-p">See your number</Link>
          </div>
        </div>
      </header>

      <section className="shell-w" style={{ paddingTop: "clamp(40px,6vw,84px)" }}>
        <div style={{ maxWidth: 760 }}>
          <h1 className="serif" style={{ fontSize: "clamp(34px,5.2vw,62px)", lineHeight: 1.04, letterSpacing: "-0.028em" }}>
            The list price is not the number.
          </h1>
          <p className="t-lg c-2" style={{ marginTop: 18, lineHeight: 1.6, maxWidth: 640 }}>
            On a {examplePrice} Georgia sale, {exampleCosts} goes to commission, concessions,
            transfer tax and the things nobody itemises until closing. What actually reaches
            you is <strong>{exampleNet}</strong> — after your payoff. Most sellers see that
            figure for the first time on a settlement statement.
          </p>
        </div>

        <div className="card" style={{ marginTop: 30, padding: 24, maxWidth: 560 }}>
          <div className="t-md w6">Two questions. Then real numbers.</div>

          <label className="field" style={{ marginTop: 16 }}>
            <span className="t-sm c-3">Which county is the home in?</span>
            <select className="input" value={county} onChange={(e) => setCounty(e.target.value)}>
              <option value="">Choose a county</option>
              {counties.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <div style={{ marginTop: 16 }}>
            <span className="t-sm c-3">When would you like to have sold?</span>
            <div className="col gap-2" style={{ marginTop: 8 }}>
              {TIMING.map((t) => (
                <label key={t} className="opt" data-on={timing === t}>
                  <input type="radio" name="timing" checked={timing === t} onChange={() => setTiming(t)} />
                  <span className="t-sm">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-brand btn-lg" style={{ width: "100%", marginTop: 20 }} disabled={!ready} onClick={go}>
            Show me what I would keep
          </button>
          <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.55 }}>
            No account, no phone number, and no call unless you ask for one.
          </p>
        </div>
      </section>

      <section className="shell-w sec">
        <div className="grid-3 gap-3">
          {[
            { icon: <Ico.wallet size={18} />, t: "Net proceeds, line by line", d: "Commission, concessions, transfer tax, repairs, moving and your payoff — each one named, with what it is based on." },
            { icon: <Ico.search size={18} />, t: "Money you may already be losing", d: "Homestead and senior exemptions, assessment appeals, and the capital gains exclusion. Worth a call whether or not you ever list." },
            { icon: <Ico.check size={18} />, t: "What to fix, and what to skip", d: "Most pre-sale work does not come back in the price. We say which does, and which only needs photographing." },
          ].map((x) => (
            <div key={x.t} className="card p-5">
              <div className="c-brand">{x.icon}</div>
              <div className="t-md w6" style={{ marginTop: 10 }}>{x.t}</div>
              <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell-w sec">
        <div className="card p-5 between wrap gap-3">
          <div style={{ maxWidth: 520 }}>
            <div className="t-lg w6 serif">Not ready to think about selling?</div>
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
              The exemptions and appeal deadlines have nothing to do with listing. Check those
              on their own, and leave.
            </p>
          </div>
          <Link href="/sell/unclaimed" className="btn btn-p">Check unclaimed value</Link>
        </div>
      </section>

      <footer className="shell-w" style={{ paddingTop: 40, paddingBottom: 56, borderTop: "1px solid var(--line-2)", marginTop: 40 }}>
        <div className="row gap-3 wrap">
          <Link href="/sell/how" className="t-sm c-3">How it works</Link>
          <Link href="/sell/unclaimed" className="t-sm c-3">Unclaimed value</Link>
          <Link href="/buy" className="t-sm c-3">Buying instead?</Link>
        </div>
        <p className="t-xs c-4" style={{ marginTop: 14, lineHeight: 1.6, maxWidth: 640 }}>
          Estimates based on published Georgia rates and typical costs. Not tax or legal advice.
          Your actual proceeds depend on your contract, your payoff on the day, and your closing attorney.
        </p>
      </footer>
    </div>
  );
}
