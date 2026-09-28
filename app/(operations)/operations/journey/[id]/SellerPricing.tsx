"use client";

import { useState } from "react";
import { money } from "@/lib/core/compute";
import { COMP_STATUS_LABEL, responseLine, type Comp, type CompStatus, type Opinion } from "@/lib/core/pricing";
import { useWrite } from "./useWrite";
import { georgiaDay } from "@/lib/core/day";

const DAY = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const today = () => georgiaDay();
const blank = (): Comp => ({ address: "", price: 0, status: "sold", on: today(), note: "" });
const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;

/**
 * Pricing strategy (S04): the agent's approved opinion, versioned, with the
 * comparables chosen and why, the seller's net at each end of the range on
 * their terms, and what the household said. No generated valuation and no
 * days-to-sell promise; commission and costs come from the recorded terms.
 */
export function SellerPricing({ journeyId, opinions, scenarios }: {
  journeyId: string;
  opinions: Opinion[];
  /** On the latest version, from the latest recorded proceeds terms. Null when none are recorded. */
  scenarios: { label: string; price: number; text: string }[] | null;
}) {
  const latest = opinions.at(-1) ?? null;
  const { busy, error, setError, write } = useWrite(`${opinions.length}:${latest?.responses.length ?? 0}`);
  const [editing, setEditing] = useState(!latest);
  const [comps, setComps] = useState<Comp[]>(latest?.comps ?? [blank()]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await write("pricing", {
      journeyId, expectedVersion: latest?.version ?? 0, requestId: crypto.randomUUID(),
      pricing: {
        listPrice: num(String(f.get("listPrice") ?? "")), low: num(String(f.get("low") ?? "")), high: num(String(f.get("high") ?? "")),
        comps, rationale: String(f.get("rationale") ?? ""), reviewOn: String(f.get("reviewOn") ?? ""),
      },
    });
    if (r.ok) setEditing(false);
  };
  const setComp = (i: number, patch: Partial<Comp>) => setComps((cs) => cs.map((c, n) => (n === i ? { ...c, ...patch } : c)));

  return (
    <div className="col gap-3">
      {latest ? (
        <div>
          <div className="between wrap gap-2" style={{ alignItems: "baseline" }}>
            <div className="t-md w6">List at {money(latest.listPrice)}</div>
            <span className="t-xs c-4">Version {latest.version}, {DAY(latest.at)} by {latest.by} · review {DAY(latest.reviewOn)}</span>
          </div>
          <p className="t-sm c-3" style={{ marginTop: 2 }}>Your range: {money(latest.low)} to {money(latest.high)}. {latest.rationale}</p>
          <div className="card" style={{ marginTop: 8, overflowX: "auto" }}>
            <table className="ops-table">
              <thead><tr><th>Comparable</th><th>Price</th><th>Status</th><th>Why it compares</th></tr></thead>
              <tbody>{latest.comps.map((c, i) => (
                <tr key={i}><td>{c.address}</td><td>{money(c.price)}</td><td>{COMP_STATUS_LABEL[c.status]}, {DAY(c.on)}</td><td>{c.note}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {scenarios ? (
            <ul className="row gap-3 wrap t-sm" style={{ marginTop: 8 }}>
              {scenarios.map((s) => <li key={s.label}><span className="w6">{s.label}, {money(s.price)}:</span> {s.text}</li>)}
            </ul>
          ) : <p className="t-xs c-4" style={{ marginTop: 8 }}>Record planning figures on the Proceeds tab to show the seller their net at each end.</p>}
          <p className="t-xs c-3" style={{ marginTop: 6 }}>{responseLine(latest)}</p>
          {!editing ? <button type="button" className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={() => { setComps(latest.comps); setEditing(true); }}>Revise the pricing</button> : null}
        </div>
      ) : <p className="t-sm c-3">No pricing yet. Record your opinion with the comparables you chose; the seller sees it and answers on their page.</p>}

      {editing ? (
        <form onSubmit={save} className="card p-3 col gap-2" style={{ background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="col gap-1 t-xs" style={{ flex: "1 1 120px" }}>List price<input className="input" name="listPrice" required inputMode="numeric" defaultValue={latest?.listPrice ?? ""} /></label>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 120px" }}>Low end<input className="input" name="low" required inputMode="numeric" defaultValue={latest?.low ?? ""} /></label>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 120px" }}>High end<input className="input" name="high" required inputMode="numeric" defaultValue={latest?.high ?? ""} /></label>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 140px" }}>Review with them on<input className="input" name="reviewOn" type="date" required min={today()} defaultValue={latest?.reviewOn ?? ""} /></label>
          </div>
          <fieldset className="col gap-2">
            <legend className="t-xs w6">Comparables you chose</legend>
            {comps.map((c, i) => (
              <div key={i} className="row gap-2 wrap" style={{ paddingBottom: 6, borderBottom: "1px solid var(--line-3)" }}>
                <input className="input input-sm" style={{ flex: "2 1 180px" }} aria-label={`Comparable ${i + 1} address`} placeholder="Address" value={c.address} onChange={(e) => setComp(i, { address: e.target.value })} />
                <input className="input input-sm" style={{ flex: "1 1 90px" }} aria-label={`Comparable ${i + 1} price`} placeholder="Price" inputMode="numeric" value={c.price || ""} onChange={(e) => setComp(i, { price: num(e.target.value) })} />
                <select className="select input-sm" style={{ flex: "0 1 150px" }} aria-label={`Comparable ${i + 1} status`} value={c.status} onChange={(e) => setComp(i, { status: e.target.value as CompStatus })}>
                  {(Object.keys(COMP_STATUS_LABEL) as CompStatus[]).map((s) => <option key={s} value={s}>{COMP_STATUS_LABEL[s]}</option>)}
                </select>
                <input className="input input-sm" style={{ flex: "0 1 150px" }} type="date" aria-label={`Comparable ${i + 1} date`} max={today()} value={c.on} onChange={(e) => setComp(i, { on: e.target.value })} />
                <input className="input input-sm" style={{ flex: "3 1 200px" }} aria-label={`Comparable ${i + 1}: why it compares`} placeholder="Why it compares, and how it differs" value={c.note} onChange={(e) => setComp(i, { note: e.target.value })} />
                {comps.length > 1 ? <button type="button" className="u t-xs" onClick={() => setComps((cs) => cs.filter((_, n) => n !== i))}>Remove</button> : null}
              </div>
            ))}
            {comps.length < 12 ? <button type="button" className="u t-xs" style={{ alignSelf: "flex-start" }} onClick={() => setComps((cs) => [...cs, blank()])}>Add a comparable</button> : null}
          </fieldset>
          <label className="col gap-1 t-xs">Why this price
            <textarea className="input" name="rationale" required minLength={10} maxLength={1500} rows={3} defaultValue={latest?.rationale ?? ""} />
          </label>
          <div className="row gap-2">
            <button className="btn btn-p btn-sm" disabled={busy}>{busy ? "Saving…" : latest ? `Save as version ${latest.version + 1}` : "Save the pricing"}</button>
            {latest ? <button type="button" className="btn btn-g btn-sm" onClick={() => { setEditing(false); setError(null); }}>Cancel</button> : null}
          </div>
          <p className="t-xs c-4">Your opinion, not a prediction: the market decides the price, and nothing here says how long it will take.</p>
        </form>
      ) : null}
      {error ? <p role="alert" className="t-xs c-neg">{error}</p> : null}
    </div>
  );
}
