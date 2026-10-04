"use client";

import { useId, useState, useTransition } from "react";
import { recordRateByHand } from "./actions";

/**
 * Record the rate by hand, for the week the Friday job could not.
 *
 * A percentage, as published: 6.72, not 0.0672. The server refuses anything
 * outside 1 to 20, because 0.65 typed for 6.5 would understate every monthly
 * payment shown to every visitor by hundreds of dollars.
 */
export function RateForm({ today }: { today: string }) {
  const [pending, start] = useTransition();
  const [pct, setPct] = useState("");
  const [asOf, setAsOf] = useState(today);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const id = useId();

  const n = Number(pct);
  const valid = pct.trim() !== "" && Number.isFinite(n) && n >= 1 && n <= 20;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        start(async () => {
          const r = await recordRateByHand(n, asOf);
          setSaid(r.ok ? { ok: true, text: `Recorded ${n}% as of ${asOf}. Every monthly figure uses it from the next page load.` } : { ok: false, text: r.error });
          if (r.ok) setPct("");
        });
      }}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}
    >
      <label className="field" htmlFor={`${id}-pct`} style={{ display: "grid", gap: 3 }}>
        <span className="t-2xs c-3">30-year fixed, %</span>
        <input id={`${id}-pct`} className="input input-sm" inputMode="decimal" placeholder="6.72" value={pct}
          onChange={(e) => setPct(e.target.value)} style={{ width: 110 }} aria-invalid={pct !== "" && !valid} />
      </label>
      <label className="field" htmlFor={`${id}-date`} style={{ display: "grid", gap: 3 }}>
        <span className="t-2xs c-3">Survey date</span>
        <input id={`${id}-date`} type="date" className="input input-sm" value={asOf} max={today}
          onChange={(e) => setAsOf(e.target.value)} />
      </label>
      <button className="btn btn-s btn-sm" disabled={pending || !valid}>{pending ? "Recording…" : "Record the rate"}</button>
      {pct !== "" && !valid ? <p className="t-2xs c-neg" style={{ flexBasis: "100%" }}>A percentage between 1 and 20, as published: 6.72, not 0.0672.</p> : null}
      {said ? <p className={`t-2xs ${said.ok ? "c-pos" : "c-neg"}`} role={said.ok ? "status" : "alert"} style={{ flexBasis: "100%" }}>{said.text}</p> : null}
    </form>
  );
}
