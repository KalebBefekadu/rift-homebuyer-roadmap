"use client";

import { useState } from "react";
import { money } from "@/lib/core/compute";
import { FIGURE_KINDS, FIGURE_LABEL, OWED_LABEL, type FigureKind, type FigureView, type OwedSource } from "@/lib/core/proceeds";
import { useWrite } from "./useWrite";

const DAY = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const num = (v: FormDataEntryValue | null) => { const s = String(v ?? "").replace(/[^0-9.]/g, ""); return s ? Number(s) : null; };
const signed = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));

/**
 * The seller's net in versions, planning to official (S16). Each version is
 * recorded from a named source and kept; the next says how it moved. The
 * official one carries the settlement statement's own net and needs the
 * lender's payoff statement, never a balance.
 */
export function SellerProceeds({ journeyId, views, line }: { journeyId: string; views: FigureView[]; line: string }) {
  const last = views.at(-1) ?? null;
  const { busy, error, setError, write } = useWrite(`${views.length}`);
  const [kind, setKind] = useState<FigureKind>(last ? (last.kind === "planning" ? "offer" : last.kind === "offer" ? "revised" : last.kind) : "planning");
  const [owedSource, setOwedSource] = useState<OwedSource>(last?.owedSource ?? "balance");
  const [open, setOpen] = useState(!last);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const price = num(f.get("price"));
    if (price === null) { setError("Give the price"); return; }
    const r = await write("proceeds", {
      journeyId, requestId: crypto.randomUUID(),
      figure: {
        kind, price, owed: num(f.get("owed")) ?? 0, owedSource, commissionPct: num(f.get("commissionPct")),
        credits: num(f.get("credits")) ?? 0, officialNet: kind === "official" ? num(f.get("officialNet")) : null,
        source: String(f.get("source") ?? ""), asOf: String(f.get("asOf") ?? ""), note: String(f.get("note") ?? "") || null,
      },
    });
    if (r.ok) setOpen(false);
  };

  return (
    <div className="col gap-3">
      <p className="t-sm w6">{line}</p>
      {views.length ? (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="ops-table">
            <thead><tr><th>Version</th><th>Price</th><th>Owed</th><th>Commission</th><th>Credits</th><th>Net</th><th>Change</th><th>Source</th></tr></thead>
            <tbody>{[...views].reverse().map((v) => (
              <tr key={v.at}>
                <td>{v.kind === "official" ? "✓ " : ""}{FIGURE_LABEL[v.kind]}</td>
                <td>{money(v.price)}</td>
                <td>{money(v.owed)}<div className="t-xs c-4">{OWED_LABEL[v.owedSource]}</div></td>
                <td>{v.commissionPct === null ? <span className="c-4">Not agreed</span> : `${v.commissionPct}%`}</td>
                <td>{money(v.credits)}</td>
                <td className={v.net < 0 ? "c-warn w6" : "w6"}>{signed(v.net)}{v.kind === "official" && Math.abs(v.net - v.estimate) >= 1 ? <div className="t-xs c-4">Estimate on these figures: {signed(v.estimate)}</div> : null}</td>
                <td>{v.change === null ? "" : signed(v.change)}</td>
                <td className="t-xs">{v.source}, {DAY(v.asOf)}{v.note ? `. ${v.note}` : ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}

      {open ? (
        <form onSubmit={save} className="card p-3 col gap-2" style={{ background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="col gap-1 t-xs">Version
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value as FigureKind)}>
                {FIGURE_KINDS.map((k) => <option key={k} value={k}>{FIGURE_LABEL[k]}</option>)}
              </select></label>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 120px" }}>Price<input className="input" name="price" required inputMode="numeric" defaultValue={last?.price ?? ""} /></label>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 120px" }}>Owed<input className="input" name="owed" inputMode="numeric" defaultValue={last?.owed ?? ""} /></label>
            <label className="col gap-1 t-xs">From
              <select className="select" value={owedSource} onChange={(e) => setOwedSource(e.target.value as OwedSource)}>
                {(Object.keys(OWED_LABEL) as OwedSource[]).map((k) => <option key={k} value={k} disabled={kind === "official" && k === "balance"}>{OWED_LABEL[k]}</option>)}
              </select></label>
            <label className="col gap-1 t-xs" style={{ flex: "0 1 110px" }}>Commission %<input className="input" name="commissionPct" inputMode="decimal" placeholder="As agreed" defaultValue={last?.commissionPct ?? ""} /></label>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 110px" }}>Credits agreed<input className="input" name="credits" inputMode="numeric" defaultValue={last?.credits ?? 0} /></label>
            {kind === "official" ? <label className="col gap-1 t-xs" style={{ flex: "1 1 140px" }}>Net on the statement<input className="input" name="officialNet" required inputMode="numeric" /></label> : null}
          </div>
          <div className="row gap-2 wrap">
            <label className="col gap-1 t-xs" style={{ flex: "2 1 220px" }}>Where these come from<input className="input" name="source" required maxLength={160} placeholder={kind === "official" ? "Settlement statement, Smith Law" : "Offer from the Adeyemis, 2 Oct"} /></label>
            <label className="col gap-1 t-xs">As of<input className="input" name="asOf" type="date" required max={today()} defaultValue={today()} /></label>
            <label className="col gap-1 t-xs" style={{ flex: "2 1 220px" }}>Note<input className="input" name="note" maxLength={500} placeholder="Per-diem interest to 30 Oct" /></label>
          </div>
          <div className="row gap-2">
            <button className="btn btn-p btn-sm" disabled={busy}>{busy ? "Saving…" : "Record this version"}</button>
            {last ? <button type="button" className="btn btn-g btn-sm" onClick={() => { setOpen(false); setError(null); }}>Cancel</button> : null}
          </div>
        </form>
      ) : <button type="button" className="btn btn-g btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>Record a new version</button>}
      {error ? <p role="alert" className="t-xs c-neg">{error}</p> : null}
      <p className="t-xs c-4">The seller sees these on their page. Projected proceeds are never certain cash until the settlement statement.</p>
    </div>
  );
}
