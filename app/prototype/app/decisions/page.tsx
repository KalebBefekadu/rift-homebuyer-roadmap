"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import {
  BUYER_DEFAULTS, cashToClose, cashGap, monthlyComputed, money, type BuyerInputs,
} from "@/lib/core/compute";
import { matchPrograms } from "@/lib/core/registry";

const M = matchPrograms({ county: "DeKalb", firstTimeBuyer: true });
const HELP = Math.round((M.openMin + M.openMax) / 2);

const OPTIONS = [
  { id: "a", price: 285_000, label: "Stretch less", note: "Smaller, further out, or needs work" },
  { id: "b", price: 325_000, label: "Your current target", note: "What the plan is currently built around" },
  { id: "c", price: 365_000, label: "Stretch more", note: "Closer in, or move-in ready" },
];

export default function Decisions() {
  const [pick, setPick] = useState<string | null>("b");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string[]>([]);

  const rows = useMemo(() => OPTIONS.map((o) => {
    const i: BuyerInputs = { ...BUYER_DEFAULTS, price: o.price, savings: 9_000, monthlySaving: 650, assistance: HELP };
    const c = cashToClose(i); const g = cashGap(i); const m = monthlyComputed(i);
    return { ...o, cash: c.total, gap: g.gap, months: g.monthsToClose ?? 0, monthly: m.value };
  }), []);

  const best = rows.reduce((a, b) => (b.months < a.months ? b : a));

  return (
    <>
      <div className="between wrap gap-3" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="serif d3">What price should we actually aim at?</h1>
          <p className="t-sm c-4" style={{ marginTop: 3 }}>Prepared by Kaleb after your 2 September call.</p>
        </div>
        <span className="chip"><Ico.clock size={10} />No deadline — take your time</span>
      </div>

      <div className="g3 gap-3" style={{ marginBottom: 16 }}>
        {rows.map((r) => {
          const on = pick === r.id;
          return (
            <button key={r.id} onClick={() => setPick(r.id)} className="card lift" style={{
              padding: 20, textAlign: "left", display: "block",
              borderColor: on ? "var(--ink)" : undefined,
              boxShadow: on ? "inset 0 0 0 1px var(--ink)" : undefined,
            }}>
              <div className="between" style={{ marginBottom: 12 }}>
                <span className="t-sm w6">{r.label}</span>
                {r.id === best.id ? <span className="chip chip-pos">Soonest</span> : null}
              </div>
              <div className="serif" style={{ fontSize: 32, letterSpacing: "-0.025em" }}>{money(r.price)}</div>
              <div className="t-xs c-4" style={{ marginTop: 4 }}>{r.note}</div>
              <div className="hr" style={{ margin: "14px 0" }} />
              <div className="col gap-2">
                {[
                  ["Every month", money(r.monthly)],
                  ["Cash to close", money(r.cash)],
                  ["Your gap", money(r.gap)],
                  ["Time to get there", `${r.months} months`],
                ].map(([l, v]) => (
                  <div key={l} className="between">
                    <span className="t-sm c-3">{l}</span>
                    <span className="num t-sm">{v}</span>
                  </div>
                ))}
              </div>
              <div className="row gap-2" style={{ marginTop: 14 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", flex: "none",
                  border: `1.5px solid ${on ? "var(--ink)" : "var(--ink-5)"}`,
                  background: on ? "var(--ink)" : "transparent", display: "grid", placeItems: "center", color: "#fff",
                }}>{on ? <Ico.check size={10} /> : null}</span>
                <span className="t-sm w55">{on ? "This is my target" : "Choose this"}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <div className="scroll-x">
          <table className="tbl">
            <thead><tr><th style={{ paddingLeft: 18 }}></th>{rows.map((r) => <th key={r.id} className="num-c">{money(r.price)}</th>)}</tr></thead>
            <tbody>
              {[
                ["Down payment at 3.5%", (r: typeof rows[0]) => money(r.price * 0.035)],
                ["All-in monthly", (r: typeof rows[0]) => money(r.monthly)],
                ["Cash needed at closing", (r: typeof rows[0]) => money(r.cash)],
                ["Assistance applied", () => money(HELP)],
                ["Gap remaining", (r: typeof rows[0]) => money(r.gap)],
                ["Months at $650/mo", (r: typeof rows[0]) => `${r.months}`],
              ].map(([l, fn]) => (
                <tr key={l as string}>
                  <td className="w55 c-3" style={{ paddingLeft: 18, width: 220 }}>{l as string}</td>
                  {rows.map((r) => <td key={r.id} className="num-c num">{(fn as (r: typeof rows[0]) => string)(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split-w">
        <div className="card p-5">
          <div className="row gap-3" style={{ marginBottom: 14 }}>
            <div className="av" style={{ background: "var(--accent)" }}>K</div>
            <div><div className="t-sm w6">Kaleb&apos;s take</div><div className="t-xs c-4">Added 2 Sep</div></div>
          </div>
          <p className="t-md c-2" style={{ lineHeight: 1.65, marginBottom: 12 }}>
            {money(285_000)} gets you there fastest, but in DeKalb at that price you&apos;re
            mostly looking at homes that need real work — and the repair budget eats the head
            start.
          </p>
          <p className="t-md c-2" style={{ lineHeight: 1.65, marginBottom: 12 }}>
            {money(365_000)} is a stretch I don&apos;t think you should make with a
            {money(650)}-a-month saving rate. It adds nearly a year.
          </p>
          <p className="t-md c-2" style={{ lineHeight: 1.65 }}>
            I&apos;d stay at {money(325_000)}. Devon mentioned {money(295_000)} on the call — worth
            the three of us talking about that difference specifically, because it&apos;s about
            four months, not about the house.
          </p>
        </div>

        <div className="col gap-3">
          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 10 }}>Ask before you decide</div>
            <textarea className="ta" style={{ minHeight: 74 }} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Anything you want to understand" />
            <button className="btn btn-s btn-sm" style={{ marginTop: 9 }} disabled={!q.trim()}
              onClick={() => { setAsked([...asked, q]); setQ(""); }}>
              <Ico.send size={13} />Send to Kaleb
            </button>
            {asked.map((a, i) => (
              <div key={i} className="tint p-3" style={{ marginTop: 9 }}>
                <div className="t-2xs c-4" style={{ marginBottom: 3 }}>You asked · just now</div>
                <p className="t-sm">{a}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            {pick ? (
              <>
                <div className="t-sm w6" style={{ marginBottom: 6 }}>Record your decision</div>
                <p className="t-sm c-3" style={{ marginBottom: 12 }}>
                  Targeting {money(rows.find((r) => r.id === pick)!.price)}. Your whole plan
                  recalculates from this.
                </p>
                <button className="btn btn-p" style={{ width: "100%" }}>Confirm target price</button>
                <p className="t-xs c-4" style={{ marginTop: 9, lineHeight: 1.5 }}>
                  Devon will be asked to confirm too, since he&apos;s part of the decision.
                </p>
              </>
            ) : (
              <p className="t-sm c-4">Pick an option above when you&apos;re ready.</p>
            )}
          </div>

          <Link href="/prototype/app/money" className="card p-4 link-row" style={{ display: "block" }}>
            <div className="between">
              <div>
                <div className="t-sm w6">Try your own numbers</div>
                <div className="t-xs c-4" style={{ marginTop: 2 }}>Change any assumption and watch it move</div>
              </div>
              <Ico.chevR size={16} className="c-4" />
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
