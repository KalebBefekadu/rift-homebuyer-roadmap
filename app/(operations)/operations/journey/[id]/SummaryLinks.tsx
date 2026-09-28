"use client";

import { useState, useTransition } from "react";
import { SCOPES, SCOPE_LABEL, DEFAULT_DAYS, MAX_DAYS, linkState, type SummaryLink } from "@/lib/core/summary-link";
import { makeSummaryLink, revokeLink } from "./summary-actions";
import { showDay } from "@/lib/core/day";
import { useRefresh } from "@/components/rift/useRefresh";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric" });

/**
 * Read-only summary links for someone outside the household (§7.2,
 * ACCESS-02): a parent, a relocation officer, a lender's assistant. The
 * address is shown here once, to copy; after that only who it is for, what
 * it shows and until when.
 */
export function SummaryLinks({ journeyId, links }: { journeyId: string; links: SummaryLink[] | null }) {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["progress"]);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [made, setMade] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [turning, setTurning] = useState<string | null>(null);
  /* The actions do not revalidate (why: ./summary-actions.ts), so the list is
     brought up to date from here once they answer. */
  const refresh = useRefresh((links ?? []).map((l) => `${l.id}:${l.revokedAt ?? ""}`).join(","));

  if (links === null) return <p className="t-xs c-4">Summary links need a database update (migration 20260927020000).</p>;

  const unreached = "Rift could not be reached. Check the connection and try again.";
  const make = () => start(async () => {
    setError(null);
    try {
      const r = await makeSummaryLink(journeyId, label, scopes, days);
      if (!r.ok) { setError(r.error); return; }
      setMade(r.url); setLabel("");
      /* Never a reload: the address is shown once, from this page's memory. */
      refresh({ reload: false });
    } catch { setError(unreached); }
  });
  const turnOff = (id: string) => {
    setError(null);
    setTurning(id);
    start(async () => {
      try {
        const r = await revokeLink(journeyId, id);
        if (!r.ok) { setError(r.error ?? "The link is still on. Try again."); return; }
        refresh();
      } catch { setError(`${unreached} The link is still on.`); }
    });
  };

  return (
    <div>
      <p className="t-xs c-3">A read-only summary for someone outside the household. It never shows money, notes or documents.</p>
      <div className="row gap-2 wrap" style={{ marginTop: 8, alignItems: "flex-end" }}>
        <label className="field"><span className="label">Who it is for</span><input className="input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Dana's mother" /></label>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="label">It shows</legend>
          <div className="row gap-2">
            {SCOPES.map((s) => (
              <label key={s} className="row gap-1 t-xs"><input type="checkbox" checked={scopes.includes(s)} onChange={() => setScopes((x) => x.includes(s) ? x.filter((y) => y !== s) : [...x, s])} />{SCOPE_LABEL[s]}</label>
            ))}
          </div>
        </fieldset>
        <label className="field"><span className="label">Days</span><input className="input" type="number" min={1} max={MAX_DAYS} value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 72 }} /></label>
        <button className="btn btn-g btn-sm" disabled={pending || !label.trim() || !scopes.length} onClick={() => { setTurning(null); make(); }}>{pending && turning === null ? "Making…" : "Make a link"}</button>
      </div>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}
      {made ? (
        <div className="card p-3" style={{ marginTop: 8, background: "var(--sunk)" }}>
          <div className="t-xs w6">Copy it now: it is not shown again.</div>
          <input className="input mono t-xs" readOnly value={made} onFocus={(e) => e.currentTarget.select()} style={{ marginTop: 4 }} />
        </div>
      ) : null}
      {links.length ? (
        <ul style={{ marginTop: 10, display: "grid", gap: 4 }}>
          {links.map((l) => {
            const st = linkState(l);
            return (
              <li key={l.id} className="between gap-2 wrap t-xs">
                <span>{l.label} · {l.scopes.map((s) => SCOPE_LABEL[s].toLowerCase()).join(", ")}</span>
                <span className="row gap-2">
                  <span className={`chip t-2xs ${st === "live" ? "chip-pos" : "chip-out"}`}>{st === "live" ? `Until ${DAY(l.expiresAt)}` : st === "expired" ? "Expired" : "Turned off"}</span>
                  {st === "live" ? <button type="button" className="u" disabled={pending} onClick={() => turnOff(l.id)}>{pending && turning === l.id ? "Turning off…" : "Turn off"}</button> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
