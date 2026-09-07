"use client";

import { useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { money, range } from "@/lib/prototype/compute";
import { matchPrograms, FUNDING_LABEL } from "@/lib/prototype/registry";

const M = matchPrograms({ county: "DeKalb", firstTimeBuyer: true });

const PLAN = [
  { w: "This week", items: [
    { t: "Open a dedicated savings account", o: "You", d: "11 Sep", done: false },
    { t: "Send the buyer agency agreement", o: "Kaleb", d: "4 Sep", done: false, late: true },
  ]},
  { w: "Next two weeks", items: [
    { t: "Take the question sheet into two lender conversations", o: "You", d: "18 Sep", done: false },
    { t: "Georgia Dream eligibility confirmation", o: "Brookhaven", d: "15 Sep", done: false },
  ]},
  { w: "This month", items: [
    { t: "Start the homebuyer education course", o: "You", d: "20 Oct", done: false },
    { t: "Gather two months of pay stubs", o: "You", d: "1 Oct", done: false },
  ]},
  { w: "Done", items: [
    { t: "Complete the readiness assessment", o: "You", d: "24 Aug", done: true },
    { t: "Planning session with Kaleb", o: "You", d: "2 Sep", done: true },
    { t: "Plan reviewed and published", o: "Kaleb", d: "2 Sep", done: true },
  ]},
];

const QUESTIONS = [
  "Are you an approved Georgia Dream participating lender?",
  "Can this be combined with DeKalb assistance, and have you closed one this year?",
  "What is my actual rate today with my credit profile, and what would a lock cost?",
  "What is the total cash I bring to the table on your worksheet?",
  "How much could a seller contribute without breaking a program rule?",
  "What is your PMI estimate, and when does it come off?",
  "What documents do you need, and how long are they good for?",
  "If assistance approval is delayed, what happens to my closing date?",
  "What would disqualify me between now and closing?",
  "Can I see your fee sheet line by line?",
];

export default function Plan() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <div className="between wrap gap-3" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="serif d3">Your plan</h1>
          <p className="t-sm c-4" style={{ marginTop: 3 }}>Reviewed by Kaleb · 2 September</p>
        </div>
        <Link href="/prototype/app/share" className="btn btn-s"><Ico.share size={15} />Share</Link>
      </div>

      {/* the blocker */}
      <div className="card p-5" style={{ marginBottom: 16, borderColor: "var(--accent-line)", background: "var(--accent-wash)" }}>
        <div className="kicker c-acc">The one thing in your way</div>
        <h2 className="t-xl w6" style={{ marginTop: 8 }}>
          Confirming which assistance programs you actually qualify for.
        </h2>
        <p className="t-md c-2" style={{ marginTop: 10, maxWidth: 620, lineHeight: 1.6 }}>
          Everything else is workable. Your gap is {money(20_400)}, and {range(M.openMin, M.openMax)} of
          assistance is the difference between 29 months and 11. None of it is real until a
          participating lender confirms your income.
        </p>
        <Link href="/prototype/app/messages" className="btn btn-a" style={{ marginTop: 16 }}>
          Ask Kaleb about this <Ico.arrowR size={15} />
        </Link>
      </div>

      <div className="split-w" style={{ marginBottom: 16 }}>
        <div className="col gap-3">
          {PLAN.map((g) => (
            <div key={g.w} className="card" style={{ overflow: "hidden" }}>
              <div className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-sm w6">{g.w}</span>
                <span className="t-xs c-4">{g.items.filter((i) => !i.done).length || g.items.length} items</span>
              </div>
              {g.items.map((i) => (
                <div key={i.t} className="between" style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--line-3)", gap: 12,
                  opacity: i.done ? 0.5 : 1,
                }}>
                  <div className="row gap-3 grow">
                    <span style={{
                      width: 16, height: 16, borderRadius: 5, flex: "none", marginTop: 1,
                      border: `1.5px solid ${i.done ? "var(--pos)" : "var(--ink-5)"}`,
                      background: i.done ? "var(--pos)" : "transparent",
                      display: "grid", placeItems: "center", color: "#fff",
                    }}>{i.done ? <Ico.check size={10} /> : null}</span>
                    <span className="t-md" style={{ textDecoration: i.done ? "line-through" : undefined }}>{i.t}</span>
                  </div>
                  <span className="t-xs c-4">{i.o}</span>
                  <span className={`t-xs num ${i.late ? "c-neg w55" : "c-4"}`}>{i.d}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="col gap-3">
          <div className="card p-4">
            <div className="between" style={{ marginBottom: 12 }}>
              <span className="t-sm w6">Assistance matched</span>
              <span className="chip chip-pos">{M.matched.length}</span>
            </div>
            <div className="num" style={{ fontSize: 25, color: "var(--pos)" }}>{range(M.usableMin, M.usableMax)}</div>
            <p className="t-xs c-4" style={{ marginTop: 4, lineHeight: 1.5 }}>
              Estimated ranges, not approvals. Your lender and each program confirm eligibility.
            </p>
            <div className="col gap-1" style={{ marginTop: 12 }}>
              {M.matched.map((p) => (
                <div key={p.id} className="between" style={{ padding: "7px 0", borderTop: "1px solid var(--line-3)" }}>
                  <span className="t-xs grow trunc">{p.name}</span>
                  <span className={`chip ${p.funding === "open" ? "chip-pos" : "chip-warn"}`} style={{ flex: "none" }}>
                    {FUNDING_LABEL[p.funding]}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/prototype/app/money" className="btn btn-g btn-sm" style={{ marginTop: 10, paddingLeft: 0 }}>
              See the effect on my gap <Ico.chevR size={13} />
            </Link>
          </div>

          <div className="card">
            <button className="between" style={{ width: "100%", padding: "14px 16px" }} onClick={() => setOpen(!open)}>
              <div style={{ textAlign: "left" }}>
                <div className="t-sm w6">Your lender question sheet</div>
                <div className="t-xs c-4" style={{ marginTop: 1 }}>Written for your situation</div>
              </div>
              <Ico.chevD size={15} className="c-4" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .16s" }} />
            </button>
            {open ? (
              <div style={{ padding: "0 16px 14px" }}>
                <ol className="col gap-2" style={{ counterReset: "q" }}>
                  {QUESTIONS.map((q, i) => (
                    <li key={q} className="row-t gap-2">
                      <span className="num t-xs c-4" style={{ width: 15, flex: "none", paddingTop: 2 }}>{i + 1}</span>
                      <span className="t-sm c-2">{q}</span>
                    </li>
                  ))}
                </ol>
                <Link href="/prototype/app/share" className="btn btn-s btn-sm" style={{ marginTop: 14, width: "100%" }}>
                  <Ico.send size={13} />Send to a lender
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
