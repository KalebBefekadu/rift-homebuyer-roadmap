"use client";

import { useId, useState } from "react";
import { compareEstimates, type Estimate } from "@/lib/core/loan-estimate";
import { money } from "@/lib/core/compute";

const digits = (t: string) => Number(t.replace(/[^0-9]/g, ""));
const fmt = (n: number) => (n ? n.toLocaleString("en-US") : "");

/**
 * Two Loan Estimates side by side (docs/audit/value-depth-2026-10.md §4.6).
 *
 * The person types three figures from each estimate they were given. The
 * comparison runs here, in the page: nothing is stored, sent or tracked,
 * because these are figures from a lender's document about their loan, and
 * the telemetry allowlist has no place for them on purpose.
 */
export function EstimateCompare({ loan: initialLoan }: { loan: number }) {
  const [loanText, setLoanText] = useState(fmt(Math.round(initialLoan)));
  const [a, setA] = useState({ rate: "", origination: "", credits: "" });
  const [b, setB] = useState({ rate: "", origination: "", credits: "" });
  const loan = digits(loanText);

  const parse = (x: typeof a): Estimate | null => {
    const ratePct = Number(x.rate);
    if (!x.rate.trim() || !Number.isFinite(ratePct) || ratePct < 0 || ratePct > 20) return null;
    return { ratePct, origination: digits(x.origination), credits: digits(x.credits) };
  };
  const ea = parse(a);
  const eb = parse(b);
  const result = ea && eb && loan > 0 ? compareEstimates(loan, 30, ea, eb) : null;
  const name = (k: "a" | "b") => (k === "a" ? "Estimate A" : "Estimate B");
  const years = (m: number) => (m < 24 ? `${m} months` : `${Math.floor(m / 12)} years and ${m % 12} months`);

  return (
    <section className="sec-sm" aria-labelledby="le-h">
      <div className="card p-5">
        <h2 id="le-h" className="t-lg w6">When the Loan Estimates arrive, compare them here</h2>
        <p className="t-sm c-3 mt-1 measure" style={{ lineHeight: 1.6 }}>
          Every lender must give you the same three-page Loan Estimate. Type three figures from each: they are the ones the lender controls.
          Nothing you type here is saved or sent.
        </p>
        <MoneyInput label="Loan amount, page 1" value={loanText} onChange={setLoanText} />
        <div className="g2 gap-4 mt-3">
          {([["a", a, setA], ["b", b, setB]] as const).map(([k, v, set]) => (
            <fieldset key={k} className="col gap-2" style={{ border: "1px solid var(--line-3)", borderRadius: 10, padding: 14 }}>
              <legend className="t-md w6" style={{ padding: "0 6px" }}>{name(k)}</legend>
              <RateInput value={v.rate} onChange={(rate) => set({ ...v, rate })} />
              <MoneyInput label="Origination charges, section A (includes points)" value={v.origination} onChange={(origination) => set({ ...v, origination })} />
              <MoneyInput label="Lender credits, section J" value={v.credits} onChange={(credits) => set({ ...v, credits })} />
            </fieldset>
          ))}
        </div>

        {result ? (
          <div className="mt-4" aria-live="polite">
            <table className="t-sm" style={{ width: "100%", borderCollapse: "collapse" }}>
              <caption className="t-sm w6" style={{ textAlign: "left", paddingBottom: 6 }}>Upfront charges plus interest paid, if you keep the loan for</caption>
              <thead>
                <tr className="c-3"><th style={{ textAlign: "left" }}>Years</th><th style={{ textAlign: "right" }}>{name("a")}</th><th style={{ textAlign: "right" }}>{name("b")}</th></tr>
              </thead>
              <tbody>
                {result.byYears.map((h) => (
                  <tr key={h.years} style={{ borderTop: "1px solid var(--line-3)" }}>
                    <td style={{ padding: "6px 0" }}>{h.years}</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: h.a < h.b ? 600 : 400 }}>{money(Math.round(h.a))}{h.a < h.b ? " (less)" : ""}</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: h.b < h.a ? 600 : 400 }}>{money(Math.round(h.b))}{h.b < h.a ? " (less)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-md mt-3 measure" style={{ lineHeight: 1.6 }}>
              {result.crossover
                ? <>{name(result.crossover.cheaperAfter === "a" ? "b" : "a")} costs less at first. {name(result.crossover.cheaperAfter)} catches up in month {result.crossover.month} ({years(result.crossover.month)}) and costs less from then on. Keep the loan longer than that and {name(result.crossover.cheaperAfter)} is the better deal; refinance or sell sooner and it is not.</>
                : result.alwaysCheaper
                  ? <>{name(result.alwaysCheaper)} costs less upfront and has the lower or equal rate: it costs less however long you keep the loan.</>
                  : <>These two cost the same.</>}
            </p>
            <p className="t-xs c-4 mt-2 measure" style={{ lineHeight: 1.6 }}>
              A 30-year fixed loan is assumed. Third-party fees (sections B and C) and escrow are left out because they are much the same from lender to lender; check them too. Principal is left out because it is yours either way.
            </p>
          </div>
        ) : (
          <p className="t-sm c-4 mt-3">Fill in both rates to compare.</p>
        )}
      </div>
    </section>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="field mt-2">
      <span className="t-sm c-3">{label}</span>
      <input id={id} className="input num" inputMode="numeric" autoComplete="off" placeholder="$0" value={value ? `$${value}` : ""}
        onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, "").slice(0, 8); onChange(d ? Number(d).toLocaleString("en-US") : ""); }} />
    </label>
  );
}

function RateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="field">
      <span className="t-sm c-3">Interest rate, page 1 (%)</span>
      <input id={id} className="input num" inputMode="decimal" autoComplete="off" placeholder="6.500" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").slice(0, 6))} />
    </label>
  );
}
