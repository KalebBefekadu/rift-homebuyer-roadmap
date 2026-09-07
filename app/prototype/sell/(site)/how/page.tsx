import Link from "next/link";
import { Ico } from "@/components/rift/icons";

const STEPS = [
  ["Six questions", "Timing, county, price, payoff, how long you've owned it, and who else is deciding.", "Free, no account"],
  ["Everything at once", "Net proceeds line by line, unclaimed value, what to fix and what to skip, timing, and a dated preparation plan.", "Yours to keep"],
  ["A conversation, if you want one", "Kaleb walks in already knowing your numbers and your timeline.", "Only if you ask"],
  ["Through to closing", "Preparation, pricing, launch, showings, offers compared on net rather than price, and settlement.", "The whole way"],
];

const STAGES = [
  ["Considering", "Goals, timing, likely costs, and whether now is right."],
  ["Preparing", "Repairs that pay back, documents, presentation, vendors."],
  ["Pricing and launch", "Strategy, estimated proceeds, marketing, launch plan."],
  ["Active listing", "Activity, feedback, showings, and honest adjustments."],
  ["Reviewing offers", "Compared on net proceeds, terms, timing and risk."],
  ["Under contract", "Contingencies, diligence, appraisal, title, obligations."],
  ["Closing", "Settlement, payoff, possession, and your proceeds."],
  ["After", "Records, the move, and what comes next."],
];

export default function How() {
  return (
    <>
      <section className="shell-w">
        <div style={{ paddingTop: "clamp(40px,6vw,80px)", maxWidth: 700 }}>
          <div className="kicker c-brand">How it works</div>
          <h1 className="serif" style={{ fontSize: "clamp(32px,4.4vw,52px)", lineHeight: 1.06, marginTop: 14, letterSpacing: "-0.026em" }}>
            The number first. The pitch never.
          </h1>
        </div>

        <div className="col gap-3" style={{ marginTop: 40, maxWidth: 820 }}>
          {STEPS.map(([t, b, tag], i) => (
            <div key={t} className="card between wrap gap-4" style={{ padding: "clamp(20px,2.6vw,30px)" }}>
              <div className="row-t gap-4" style={{ minWidth: 0 }}>
                <span className="num serif c-4" style={{ fontSize: 30, lineHeight: 1, flex: "none", width: 42 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ maxWidth: 520 }}>
                  <div className="t-xl w6">{t}</div>
                  <p className="t-md c-2" style={{ marginTop: 7, lineHeight: 1.6 }}>{b}</p>
                </div>
              </div>
              <span className="chip chip-brand" style={{ flex: "none" }}>{tag}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="shell-w sec">
        <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em", maxWidth: 480 }}>
          Every stage, with someone who knows where you are.
        </h2>
        <div className="g4 gap-3" style={{ marginTop: 28 }}>
          {STAGES.map(([t, b], i) => (
            <div key={t}>
              <div className="num t-xs c-4">{String(i + 1).padStart(2, "0")}</div>
              <div className="hr" style={{ margin: "10px 0 12px" }} />
              <div className="t-md w6">{t}</div>
              <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.55 }}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell-w sec">
        <div className="card p-5" style={{ maxWidth: 720 }}>
          <Ico.scale size={18} className="c-brand" />
          <h3 className="t-xl w6" style={{ marginTop: 12 }}>When offers come in, you see them properly</h3>
          <p className="t-md c-2" style={{ marginTop: 10, lineHeight: 1.65 }}>
            Every offer reaches Kaleb first, and he decides whether to present it — that decision
            is recorded either way, and nothing is ever discarded. What reaches you is a
            comparison on net proceeds, terms, timing and risk. The highest price is very often
            not the most money.
          </p>
          <Link href="/prototype/sell/start" className="btn btn-brand" style={{ marginTop: 18 }}>
            Start with my numbers <Ico.arrowR size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
