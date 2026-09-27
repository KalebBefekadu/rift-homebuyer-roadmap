"use client";

import { useState } from "react";
import Link from "next/link";
import { DEPENDENCY_KINDS, KIND_LABEL, STATE_LABEL, lineFor, stateOf, type Dependency, type DependencyKind } from "@/lib/core/dependency";
import { useWrite } from "./useWrite";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * A sale linked to a purchase (STATE-07), on the journey's Overview: what
 * one needs from the other, who owns it, and whether it has been met. It
 * moves nothing; it is here so nobody forgets the other journey exists.
 */
export function Linked({ journeyId, side, deps, candidates, agentName }: {
  journeyId: string;
  side: "buy" | "sell";
  deps: Dependency[];
  /** The same relationship's journeys on the other side. */
  candidates: { id: string; label: string }[];
  agentName: string;
}) {
  const { busy, error, setError, write } = useWrite(deps.map((d) => `${d.id}:${d.events.length}`).join("|"));
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const link = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const other = String(f.get("other") ?? "");
    if (!other) { setError("Choose the other journey"); return; }
    const r = await write("link-journeys", {
      journeyId, saleJourneyId: side === "sell" ? journeyId : other, purchaseJourneyId: side === "buy" ? journeyId : other,
      kind: String(f.get("kind")), note: String(f.get("note") ?? ""), owner: String(f.get("owner") ?? ""), requestId: crypto.randomUUID(),
    });
    if (r.ok) setAdding(false);
  };

  const happened = (dependencyId: string, state: "met" | "removed" | "reopened") => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const evidence = String(new FormData(e.currentTarget).get("evidence") ?? "");
    const r = await write("dependency-event", { journeyId, dependencyId, state, evidence, requestId: crypto.randomUUID() });
    if (r.ok) setOpen(null);
  };

  return (
    <div>
      {deps.length ? (
        <ul>
          {deps.map((d) => {
            const st = stateOf(d);
            const last = d.events.at(-1);
            const otherId = side === "buy" ? d.saleJourneyId : d.purchaseJourneyId;
            return (
              <li key={d.id} className="desk-row">
                <div className="row gap-2" style={{ alignItems: "baseline" }}>
                  <span className={`chip t-2xs ${st === "open" ? "chip-warn" : st === "met" ? "chip-pos" : "chip-out"}`}>{st === "open" ? "◷ " : st === "met" ? "✓ " : "– "}{STATE_LABEL[st]}</span>
                  <Link className="u w6" href={`/operations/journey/${otherId}`}>{lineFor(d, side)}</Link>
                </div>
                <div className="desk-meta">{d.note} · owner: {d.owner} · recorded {DAY(d.at)} by {d.by}</div>
                {last ? <div className="desk-meta">{STATE_LABEL[stateOf({ events: [last] })]} {DAY(last.at)}: {last.evidence} ({last.by})</div> : null}
                <div className="row gap-2 t-xs c-3" style={{ marginTop: 3 }}>
                  {st === "open" ? (
                    <>
                      <button type="button" className="u" onClick={() => setOpen(`${d.id}:met`)}>Record it met</button>
                      <button type="button" className="u" onClick={() => setOpen(`${d.id}:removed`)}>Remove</button>
                    </>
                  ) : <button type="button" className="u" onClick={() => setOpen(`${d.id}:reopened`)}>Reopen</button>}
                </div>
                {open?.startsWith(d.id) ? (
                  <form className="desk-form" onSubmit={happened(d.id, open.split(":")[1] as "met" | "removed" | "reopened")}>
                    <label style={{ flex: 1, minWidth: 220 }}>{open.endsWith("met") ? "What shows it was met" : "Why"}
                      <input className="input input-sm" name="evidence" required minLength={3} maxLength={300}
                        placeholder={open.endsWith("met") ? "Settlement statement, funds wired 3 Oct" : "They are keeping the house"} />
                    </label>
                    <button className="btn btn-p btn-sm" disabled={busy}>Record</button>
                    <button type="button" className="btn btn-g btn-sm" onClick={() => setOpen(null)}>Cancel</button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="t-sm c-4">None recorded.</p>}

      {adding ? (
        candidates.length ? (
          <form className="desk-form" onSubmit={link}>
            <label>{side === "buy" ? "The sale" : "The purchase"}
              <select className="select input-sm" name="other" defaultValue={candidates[0]!.id}>{candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            </label>
            <label>What the purchase needs
              <select className="select input-sm" name="kind" defaultValue="proceeds">{DEPENDENCY_KINDS.map((k: DependencyKind) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
            </label>
            <label style={{ flex: 1, minWidth: 220 }}>In words
              <input className="input input-sm" name="note" required minLength={3} maxLength={300} placeholder="Down payment comes from the sale of 12 Oak St" />
            </label>
            <label>Who owns it
              <input className="input input-sm" name="owner" required maxLength={120} defaultValue={agentName} />
            </label>
            <button className="btn btn-p btn-sm" disabled={busy}>Link them</button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        ) : <p className="t-xs c-3" style={{ marginTop: 6 }}>This relationship has no {side === "buy" ? "selling" : "buying"} journey to link. Start one from their record first.</p>
      ) : (
        <button type="button" className="u t-xs" style={{ marginTop: 6 }} onClick={() => setAdding(true)}>Link {side === "buy" ? "a sale" : "a purchase"}</button>
      )}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 4 }}>{error}</p> : null}
      <p className="t-xs c-4" style={{ marginTop: 6 }}>A link moves nothing: neither journey&apos;s stage or dates change because of the other.</p>
    </div>
  );
}
