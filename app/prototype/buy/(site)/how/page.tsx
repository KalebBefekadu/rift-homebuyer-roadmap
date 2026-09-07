import Link from "next/link";
import { Ico } from "@/components/rift/icons";

const STEPS = [
  ["Seven questions", "County, timing, price, savings, saving rate, and who else is deciding. Five minutes.", "Free, no account"],
  ["Everything at once", "Assistance match, true cash to close, your gap and timeline, monthly cost across a band, your one blocker, and questions for any lender.", "Yours to keep"],
  ["A conversation, if you want one", "Kaleb reads your situation before you speak, so you're not explaining it from scratch.", "Only if you ask"],
  ["A plan that stays current", "When a program opens, funding closes, or rates move, your numbers update and we tell you what changed.", "For as long as it takes"],
];

const STAGES = [
  ["Exploring", "Is this even the right year?"],
  ["Building readiness", "Close the gap, find the assistance, fix what's fixable."],
  ["Financing", "Compare lenders properly and get verified."],
  ["Ready to shop", "Criteria, budget, and the rules you'll decide by."],
  ["Searching", "Compare homes on total cost, not sticker price."],
  ["Making an offer", "Strategy, terms, cash, and risk."],
  ["Under contract", "Deadlines, inspection, appraisal, title."],
  ["Closing and after", "Funds, keys, and the first year of owning it."],
];

export default function How() {
  return (
    <>
      <section className="shell-w">
        <div style={{ paddingTop: "clamp(40px,6vw,80px)", maxWidth: 700 }}>
          <div className="kicker c-brand">How it works</div>
          <h1 className="serif" style={{ fontSize: "clamp(32px,4.4vw,52px)", lineHeight: 1.06, marginTop: 14, letterSpacing: "-0.026em" }}>
            You get everything before you decide anything.
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
          Then we walk the whole thing with you.
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
        <div className="g2 gap-4">
          <div className="card p-5">
            <Ico.shield size={18} className="c-brand" />
            <h3 className="t-xl w6" style={{ marginTop: 12 }}>What we promise</h3>
            <ul className="col gap-2" style={{ marginTop: 12 }}>
              {["Nothing held back to force a sign-up",
                "Every number shows its assumptions and how it could be wrong",
                "We never show a program we haven't verified in 90 days",
                "We never say you qualify — only that you may"].map((x) => (
                <li key={x} className="row-t gap-2">
                  <Ico.check size={14} className="c-brand" style={{ marginTop: 3, flex: "none" }} />
                  <span className="t-sm c-2">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <Ico.x size={18} className="c-4" />
            <h3 className="t-xl w6" style={{ marginTop: 12 }}>What we&apos;re not</h3>
            <ul className="col gap-2" style={{ marginTop: 12 }}>
              {["A lender or mortgage broker", "A law firm or tax advisor",
                "An appraiser", "An MLS or listing portal"].map((x) => (
                <li key={x} className="row-t gap-2">
                  <Ico.x size={14} className="c-4" style={{ marginTop: 3, flex: "none" }} />
                  <span className="t-sm c-2">{x}</span>
                </li>
              ))}
            </ul>
            <p className="t-sm c-3" style={{ marginTop: 14, lineHeight: 1.6 }}>
              Every figure is a planning estimate. Your lender and the program administrator are
              the authority on the real ones.
            </p>
          </div>
        </div>
      </section>

      <section className="shell-w sec">
        <div className="card between wrap gap-4" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--brand)", borderColor: "var(--brand)" }}>
          <h3 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", color: "#fff", letterSpacing: "-0.02em", maxWidth: 440, lineHeight: 1.15 }}>
            Five minutes, and you&apos;ll know exactly where you stand.
          </h3>
          <Link href="/prototype/buy/start" className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
            Start <Ico.arrowR size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
