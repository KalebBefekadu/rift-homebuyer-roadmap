"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { Trust } from "@/components/rift/Trust";
import {
  BUYER_DEFAULTS, cashToClose, cashGap, gapLevers, monthlyComputed, money, type BuyerInputs,
} from "@/lib/prototype/compute";
import { matchPrograms } from "@/lib/prototype/registry";

const M = matchPrograms({ county: "DeKalb", firstTimeBuyer: true });
const BASE: BuyerInputs = {
  ...BUYER_DEFAULTS, price: 325_000, savings: 9_000, monthlySaving: 650,
  assistance: Math.round((M.openMin + M.openMax) / 2),
};

export default function Money() {
  const [i, setI] = useState<BuyerInputs>(BASE);
  const [help, setHelp] = useState(true);
  const inputs = useMemo(() => ({ ...i, assistance: help ? BASE.assistance : 0 }), [i, help]);
  const cash = useMemo(() => cashToClose(inputs), [inputs]);
  const gap = useMemo(() => cashGap(inputs), [inputs]);
  const mo = useMemo(() => monthlyComputed(inputs), [inputs]);
  const levers = useMemo(() => gapLevers(inputs), [inputs]);
  const parts = [
    ["Principal & interest", mo.parts.pi], ["Property tax", mo.parts.tax],
    ["Insurance", mo.parts.insurance], ["PMI", mo.parts.pmi], ["HOA", mo.parts.hoa],
  ] as const;

  return (
    <>
      <div className="between wrap gap-3" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="serif d3">Your money</h1>
          <p className="t-sm c-4" style={{ marginTop: 3 }}>Every assumption below is yours to change.</p>
        </div>
        <div className="row gap-2 wrap">
          <Trust state="reviewed" />
          <span className="t-xs c-4">2 September</span>
        </div>
      </div>

      <div className="split-w" style={{ marginBottom: 16 }}>
        <div className="col gap-3">
          <div className="card p-5">
            <div className="between" style={{ marginBottom: 18 }}>
              <div>
                <div className="row gap-2">
                  <span className="kicker" style={{ margin: 0 }}>Still to find</span>
                  <Trust state="reviewed" short />
                </div>
                <div className="num" style={{ fontSize: 40, marginTop: 6, color: gap.gap > 0 ? "var(--ink)" : "var(--pos)" }}>
                  {money(gap.gap)}
                </div>
                {gap.monthsToClose ? (
                  <div className="t-sm c-3" style={{ marginTop: 4 }}>
                    About {gap.monthsToClose} months at {money(i.monthlySaving)} a month
                  </div>
                ) : null}
              </div>
              <button onClick={() => setHelp(!help)} className="btn btn-s btn-sm">
                {help ? <Ico.check size={13} className="c-pos" /> : <Ico.x size={13} />}
                Assistance {help ? "applied" : "excluded"}
              </button>
            </div>
            <div className="meter" style={{ height: 6 }}><i className="pos" style={{ width: `${Math.min(100, (gap.covered / gap.cashNeeded) * 100)}%` }} /></div>
            <div className="between" style={{ marginTop: 8 }}>
              <span className="t-xs c-4">{money(gap.covered)} covered</span>
              <span className="t-xs c-4">{money(gap.cashNeeded)} needed</span>
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
              <span className="t-sm w6">What you actually need at closing</span>
              <span className="num t-sm">{money(cash.total)}</span>
            </div>
            {cash.lines.map((l) => (
              <div key={l.label} className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                <div className="grow">
                  <div className="row gap-2">
                    <span className="t-sm w5">{l.label}</span>
                    {l.credited ? <span className="chip chip-pos">Credited back</span> : null}
                  </div>
                  <div className="t-xs c-4" style={{ marginTop: 1 }}>{l.note}</div>
                </div>
                <span className="num t-sm" style={{ opacity: l.credited ? 0.45 : 1 }}>{money(l.amount)}</span>
              </div>
            ))}
            <div className="tint" style={{ padding: "11px 16px", borderRadius: 0 }}>
              <div className="row gap-2">
                <Ico.info size={14} className="c-4" style={{ flex: "none", marginTop: 1 }} />
                <span className="t-xs c-3" style={{ lineHeight: 1.55 }}>
                  Most people are only told the down payment — {money(cash.down)} here. The gap
                  between that and {money(cash.total)} is what usually breaks a purchase late.
                </span>
              </div>
            </div>
          </div>

          {levers.length ? (
            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 12 }}>What would shorten this most</div>
              <div className="g3 gap-2">
                {levers.slice(0, 3).map((l) => (
                  <div key={l.label} className="tint p-3">
                    <div className="num" style={{ fontSize: 19, color: "var(--pos)" }}>−{l.saved}mo</div>
                    <div className="t-sm w55" style={{ marginTop: 4 }}>{l.label}</div>
                    <div className="t-xs c-4" style={{ marginTop: 3, lineHeight: 1.45 }}>{l.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="col gap-3">
          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 14 }}>Change anything</div>
            {([
              ["price", "Target price", 150_000, 600_000, 5_000, (v: number) => money(v)],
              ["savings", "Saved so far", 0, 80_000, 500, (v: number) => money(v)],
              ["monthlySaving", "Saving each month", 0, 2_500, 25, (v: number) => money(v)],
              ["downPct", "Down payment", 0, 20, 0.5, (v: number) => `${v}%`],
              ["ratePct", "Rate", 4, 9, 0.125, (v: number) => `${v}%`],
            ] as const).map(([k, l, min, max, step, fmt]) => (
              <label key={k} className="field" style={{ marginBottom: 14 }}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <span className="label" style={{ margin: 0 }}>{l}</span>
                  <span className="num t-sm">{fmt(i[k] as number)}</span>
                </div>
                <input className="rng" type="range" min={min} max={max} step={step}
                  value={i[k] as number} onChange={(e) => setI({ ...i, [k]: Number(e.target.value) })} />
              </label>
            ))}
            <button className="btn btn-g btn-sm" style={{ paddingLeft: 0 }} onClick={() => setI(BASE)}>
              <Ico.refresh size={13} />Reset to my plan
            </button>
          </div>

          <div className="card p-4">
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row gap-2">
                <span className="t-sm w6">Every month</span>
                <Trust state="preliminary" short />
              </div>
              <span className="num" style={{ fontSize: 20 }}>{money(mo.value)}</span>
            </div>
            <div className="row" style={{ height: 6, borderRadius: 99, overflow: "hidden", gap: 1, marginBottom: 12 }}>
              {parts.filter(([, v]) => v > 0).map(([l, v], n) => (
                <div key={l} title={l} style={{
                  width: `${(v / mo.value) * 100}%`,
                  background: ["var(--ink)", "var(--accent)", "var(--warn)", "var(--pos)", "var(--ink-4)"][n],
                }} />
              ))}
            </div>
            {parts.map(([l, v], n) => (
              <div key={l} className="between" style={{ padding: "5px 0" }}>
                <div className="row gap-2">
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: v > 0 ? ["var(--ink)", "var(--accent)", "var(--warn)", "var(--pos)", "var(--ink-4)"][n] : "var(--line)" }} />
                  <span className={`t-sm ${v > 0 ? "" : "c-4"}`}>{l}</span>
                </div>
                <span className={`num t-sm ${v > 0 ? "" : "c-4"}`}>{money(v)}</span>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <div className="t-xs c-4" style={{ lineHeight: 1.6 }}>
              Planning estimates based on the assumptions above — not a loan approval, rate
              quote or lending commitment. Your lender is the authority on final figures.
            </div>
            <Link href="/prototype/app/plan" className="btn btn-g btn-sm" style={{ paddingLeft: 0, marginTop: 8 }}>
              Back to my plan <Ico.chevR size={13} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
