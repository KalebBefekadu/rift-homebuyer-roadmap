"use client";

import { useState } from "react";
import Link from "next/link";
import { useGo } from "@/components/rift/useRefresh";
import { SIDE_LABEL, type Side } from "@/lib/core/journey";
import { send } from "../../journey/send";

export interface JourneySummary {
  id: string;
  side: Side;
  label: string;
  createdAt: string;
  statusLabel: string | null;
}

/**
 * A person's buying and selling goals.
 *
 * A journey is new, and deliberately small: a name and a side, pointing at
 * this record. Their readout, plan and history stay exactly where they are
 * (AT01). One person can have several, because people buy, then sell, then
 * buy again, and one `side` on a lead row cannot hold that.
 */
export function Journeys({ leadId, side, journeys, unavailable }: {
  leadId: string;
  side: Side;
  journeys: JourneySummary[];
  unavailable: string | null;
}) {
  const go = useGo();
  const [open, setOpen] = useState(false);
  const [newSide, setNewSide] = useState<Side>(side);
  const [label, setLabel] = useState(side === "buy" ? "Buying a home" : "Selling a home");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const create = async () => {
    if (pending) return;
    setPending(true);
    const r = await send("start", { leadId, side: newSide, label });
    if (!r.ok || typeof r.id !== "string") {
      setError(r.error ?? "That did not start. Try again.");
      setPending(false);
      return;
    }
    setError(null);
    go(`/operations/journey/${r.id}`);
  };

  return (
    <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="journeys-h">
      <div className="between gap-2 wrap">
        <div>
          <div id="journeys-h" className="t-md w6">Journeys</div>
          <div className="t-xs c-4" style={{ marginTop: 2 }}>
            Each buying or selling goal, with its search brief, household and homes.
          </div>
        </div>
        {!open && !unavailable ? (
          <button className="btn btn-s btn-sm" onClick={() => setOpen(true)}>Start a journey</button>
        ) : null}
      </div>

      {unavailable ? (
        <p className="t-xs c-4" style={{ marginTop: 12 }}>{unavailable}</p>
      ) : journeys.length === 0 && !open ? (
        <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6 }}>
          None yet. Start one to write their search brief and set up the Matrix search from it.
        </p>
      ) : (
        <ul style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {journeys.map((j) => (
            <li key={j.id}>
              <Link href={`/operations/journey/${j.id}`} className="card p-3 between gap-2 wrap" style={{ display: "flex" }}>
                <span className="row gap-2">
                  <span className="chip t-2xs">{SIDE_LABEL[j.side]}</span>
                  <span className="t-sm w6">{j.label}</span>
                </span>
                <span className="t-2xs c-4">{j.statusLabel ?? `Started ${new Date(j.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="card p-3" style={{ marginTop: 12, background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "0 0 140px" }}>
              <span className="label">Goal</span>
              <select className="input" value={newSide} onChange={(e) => setNewSide(e.target.value as Side)}>
                <option value="buy">Buying</option>
                <option value="sell">Selling</option>
              </select>
            </label>
            <label className="field" style={{ flex: "1 1 220px" }}>
              <span className="label">Name</span>
              <input className="input" value={label} maxLength={160} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={pending} onClick={create}>
              {pending ? "Starting…" : "Start"}
            </button>
            <button className="btn btn-g btn-sm" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {newSide === "sell" ? (
            <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Selling journeys hold the household for now. The seller workflow comes after the buyer release.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
