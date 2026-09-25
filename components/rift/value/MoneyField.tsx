"use client";

import { useId, useState } from "react";
import { Ico } from "@/components/rift/icons";
import type { AskDef } from "@/lib/core/asks";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * A money answer: type any figure, or drag through the common range.
 *
 * The old sliders were the only way in and stopped at a ceiling ($700,000 for
 * a price), so "what if I want $1,000,000?" had no answer (Kaleb, R2). The
 * typed figure is the answer; the slider is a shortcut that pins at its end
 * when the typed figure is beyond it. Limits are the hard ones in
 * lib/core/asks.ts, and the server checks them again.
 */
export function MoneyField({ def, value, onDone, cta = "Continue" }: {
  def: AskDef;
  value: number;
  onDone: (n: number) => void;
  cta?: string;
}) {
  const id = useId();
  const [text, setText] = useState(fmt(value));
  const n = Number(text.replace(/[^0-9]/g, ""));
  const lim = def.limits ?? { min: 0, max: 5_000_000 };
  const s = def.slider ?? { min: lim.min, max: lim.max, step: 1_000 };
  const valid = text.trim() !== "" && Number.isFinite(n) && n >= lim.min && n <= lim.max;
  const error = !valid && text.trim() !== ""
    ? n > lim.max ? `Up to $${fmt(lim.max)}.` : `At least $${fmt(lim.min)}.`
    : null;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onDone(n); }}
      className="card p-5"
    >
      <label htmlFor={id} className="label">{def.unitLabel ?? "Amount"}</label>
      <div className="row" style={{
        border: "1px solid var(--line)", borderRadius: 10, background: "var(--paper)", paddingLeft: 14, height: 60,
      }}>
        <span className="num c-4" style={{ fontSize: 26 }}>$</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          className="num"
          value={text}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-e` : undefined}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
            setText(digits ? fmt(Number(digits)) : "");
          }}
          style={{ border: 0, outline: "none", boxShadow: "none", background: "transparent", fontSize: 28, height: 56, padding: "0 12px 0 6px", width: "100%" }}
        />
      </div>
      {error ? <p id={`${id}-e`} role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}

      <input
        type="range"
        className="rng"
        style={{ marginTop: 18 }}
        min={s.min} max={s.max} step={s.step}
        value={Math.min(Math.max(valid ? n : s.min, s.min), s.max)}
        aria-label={`${def.unitLabel ?? "Amount"}, common range`}
        onChange={(e) => setText(fmt(Number(e.target.value)))}
      />
      <div className="between t-xs c-4" style={{ marginTop: 2 }}>
        <span>${fmt(s.min)}</span>
        <span>${fmt(s.max)}{lim.max > s.max ? " or type more" : ""}</span>
      </div>

      <button type="submit" className="btn btn-brand btn-lg" style={{ width: "100%", marginTop: 20 }} disabled={!valid}>
        {cta} <Ico.arrowR size={15} />
      </button>
    </form>
  );
}
