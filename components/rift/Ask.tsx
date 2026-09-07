"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "./icons";
import { Track } from "./Track";
import { money } from "@/lib/core/compute";
import type { Question as FQuestion } from "@/lib/core/funnel";

export function AskShell({
  v, n, total, onLeave, children, panel, hasValues,
}: {
  v: "buy" | "sell"; n: number; total: number; onLeave: () => void;
  children: React.ReactNode; panel: React.ReactNode;
  /** False until there is a figure worth showing. Drives the mobile strip. */
  hasValues?: boolean;
}) {
  return (
    <div className={v} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Track />
      <header className="between" style={{ padding: "15px clamp(16px,4vw,32px)", borderBottom: "1px solid var(--line-2)" }}>
        <Link href={`/prototype/${v}`} className="row gap-2">
          <Mark size={20} />
          <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
          <span className="chip chip-brand hide-sm">{v === "buy" ? "Buyers" : "Sellers"}</span>
        </Link>
        <div className="row gap-3">
          <span className="t-xs c-4 num">{n + 1} / {total}</span>
          <button className="btn btn-g btn-sm" onClick={onLeave}>Save and finish later</button>
        </div>
      </header>
      <div className="meter" style={{ height: 2, borderRadius: 0 }}>
        <i style={{ width: `${((n + 1) / total) * 100}%`, background: "var(--brand)" }} />
      </div>

      <div className="askgrid" data-values={hasValues ? "1" : "0"} style={{ flex: 1 }}>
        <div style={{ padding: "clamp(28px,5vw,64px) clamp(16px,4vw,56px)", display: "flex", alignItems: "center" }}>
          <div className="ask-col" style={{ maxWidth: 480, width: "100%" }}>{children}</div>
        </div>
        <aside style={{ borderLeft: "1px solid var(--line-2)", background: "var(--paper)", padding: "clamp(24px,3vw,36px) clamp(16px,2.5vw,28px)" }}>
          <div className="sticky ask-panel" style={{ top: 24 }}>{panel}</div>
        </aside>
      </div>
    </div>
  );
}

export function Leave({ v, n, extra, onBack }: { v: "buy" | "sell"; n: number; extra?: React.ReactNode; onBack: () => void }) {
  return (
    <div className={v} style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card p-6" style={{ maxWidth: 460 }}>
        <Ico.clock size={22} className="c-3" />
        <h1 className="serif" style={{ fontSize: 30, marginTop: 14, letterSpacing: "-0.022em" }}>
          Your answers are saved.
        </h1>
        <p className="t-md c-2" style={{ marginTop: 12, lineHeight: 1.6 }}>
          You stopped at question {n + 1}. Come back on this device and you&apos;ll pick up
          exactly here. No account needed, nothing lost.
        </p>
        {extra}
        <button className="btn btn-brand" style={{ marginTop: 18, width: "100%" }} onClick={onBack}>
          Carry on
        </button>
      </div>
    </div>
  );
}

export function Q({ topic, q, why, children }: { topic: string; q: string; why?: string; children: React.ReactNode }) {
  return (
    <div className="fade-in">
      <div className="kicker c-brand">{topic}</div>
      <h1 className="serif" style={{ fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.12, marginTop: 12, letterSpacing: "-0.022em" }}>
        {q}
      </h1>
      {why ? <p className="t-sm c-3" style={{ marginTop: 12, lineHeight: 1.6 }}>{why}</p> : null}
      <div style={{ marginTop: 26 }}>{children}</div>
    </div>
  );
}

/**
 * Picking an option moves you on. The short delay is deliberate — the tick has
 * to land before the screen changes, or it reads as a glitch rather than an
 * answer. Continue stays available for anyone using a keyboard.
 */
export function Choices({ opts, value, onPick, advance }: {
  opts: { label: string; value: string }[] | string[];
  value: string;
  onPick: (s: string) => void;
  advance?: () => void;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const norm = opts.map((o) => (typeof o === "string" ? { label: o, value: o } : o));

  const pick = (v: string) => {
    onPick(v);
    if (!advance) return;
    setFlash(v);
    setTimeout(() => { setFlash(null); advance(); }, 190);
  };

  return (
    <div className="col gap-2">
      {norm.map((o) => (
        <label key={o.value} className="opt" data-on={value === o.value || flash === o.value}>
          <input type="radio" checked={value === o.value} onChange={() => pick(o.value)} />
          <span className="t-md w5">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * A slider alone is a poor mobile input — the thumb is small, the hand covers
 * the value, and a miss costs a whole step. So the value gets a stepper either
 * side of it: coarse dragging for exploration, taps for the last adjustment.
 */
export function Slider({
  label, value, min, max, step, onChange, fmt, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (n: number) => void; fmt: (n: number) => string; hint?: React.ReactNode;
}) {
  /* A ref, not the prop. Two taps inside one render both read the same stale
     `value` otherwise, so a quick double-tap moves one step instead of two. */
  const live = useRef(value);
  live.current = value;
  const nudge = (d: -1 | 1) => {
    const next = Math.min(max, Math.max(min, live.current + d * step));
    live.current = next;
    onChange(next);
  };
  return (
    <>
      <div className="between gap-2" style={{ marginBottom: 10 }}>
        <span className="label" style={{ margin: 0 }}>{label}</span>
        <div className="row gap-1" style={{ alignItems: "center" }}>
          <button className="btn btn-s step" onClick={() => nudge(-1)} disabled={value <= min} aria-label={`Less ${label}`}>
            <Ico.minus size={14} />
          </button>
          <span className="num" style={{ fontSize: 26, minWidth: 118, textAlign: "center" }}>
            {value ? fmt(value) : "—"}
          </span>
          <button className="btn btn-s step" onClick={() => nudge(1)} disabled={value >= max} aria-label={`More ${label}`}>
            <Ico.plus size={14} />
          </button>
        </div>
      </div>
      <input className="rng" type="range" min={min} max={max} step={step} value={value}
        aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      {hint}
    </>
  );
}

export function Nav({ n, canNext, last, onBack, onNext, cta }: {
  n: number; canNext: boolean; last: boolean; onBack: () => void; onNext: () => void; cta: string;
}) {
  return (
    <div className="row gap-2 ask-nav" style={{ marginTop: 30 }}>
      <button className="btn btn-s" disabled={n === 0} onClick={onBack}><Ico.chevL size={15} /></button>
      <button className={`btn btn-lg grow ${last ? "btn-brand" : "btn-p"}`} disabled={!canNext} onClick={onNext}>
        {last ? cta : "Continue"} {last ? <Ico.arrowR size={16} /> : null}
      </button>
    </div>
  );
}

export function LiveCard({ label, value, note, strong, brand }: {
  label: string; value: string; note?: string; strong?: boolean; brand?: boolean;
}) {
  return (
    <div className="card p-4 fade-in" style={
      brand ? { background: "var(--brand-wash)", borderColor: "var(--brand-line)" }
      : strong ? { borderColor: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--ink)" } : undefined
    }>
      <div className="t-xs c-4">{label}</div>
      <div className="num" style={{ fontSize: 24, marginTop: 4, color: brand ? "var(--brand-2)" : undefined }}>{value}</div>
      {note ? <div className="t-xs c-4" style={{ marginTop: 3 }}>{note}</div> : null}
    </div>
  );
}

/** What they already told us, shown rather than silently assumed. */
export function Carried({ label, value }: { label: string; value: string }) {
  return (
    <div className="tint p-3 fade-in">
      <div className="row gap-2">
        <Ico.check size={13} className="c-pos" />
        <span className="t-xs c-4">{label}</span>
      </div>
      <div className="t-sm w55" style={{ marginTop: 4 }}>{value}</div>
      <div className="t-2xs c-4" style={{ marginTop: 3 }}>Two questions you don&apos;t have to answer again</div>
    </div>
  );
}

/** Renders one question from the funnel definition, whatever the agent made it. */
export function Field({ q, value, onChange, advance, options, extra }: {
  q: FQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  advance: () => void;
  /** Runtime option list for select questions (counties, etc). */
  options?: string[];
  extra?: React.ReactNode;
}) {
  if (q.type === "choice") {
    return (
      <>
        <Choices opts={q.options ?? []} value={String(value ?? "")} onPick={onChange} advance={advance} />
        {extra}
      </>
    );
  }
  if (q.type === "select") {
    return (
      <>
        <select className="select input-lg" value={String(value ?? "")}
          onChange={(e) => { onChange(e.target.value); setTimeout(advance, 190); }}>
          {(options ?? []).map((o) => <option key={o}>{o}</option>)}
        </select>
        {extra}
      </>
    );
  }
  if (q.type === "slider") {
    return (
      <Slider
        label={q.fieldLabel ?? q.title}
        value={Number(value ?? 0)} min={q.min ?? 0} max={q.max ?? 100} step={q.step ?? 1}
        onChange={onChange}
        fmt={q.unit === "$" ? money : (v) => `${v}${q.unit ? ` ${v === 1 ? q.unit.replace(/s$/, "") : q.unit}` : ""}`}
        hint={extra} />
    );
  }
  if (q.type === "boolean") {
    return <Choices opts={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]}
      value={String(value ?? "")} onPick={onChange} advance={advance} />;
  }
  return (
    <>
      <input className="input input-lg" placeholder={q.placeholder || "Your answer"}
        value={String(value ?? "") === "none" ? "" : String(value ?? "")}
        onChange={(e) => onChange(e.target.value)} />
      {extra}
    </>
  );
}
