"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { money } from "@/lib/core/compute";
import {
  rankOffers, headlineTrap, gapsIn, FINANCING_LABEL,
  type Financing, type Offer, type SellerCosts,
} from "@/lib/core/offers";
import { recordOffer, releaseOffer, deleteOffer, saveSellerCosts } from "../../actions";

/**
 * The offer table.
 *
 * Ranked by what reaches the seller, never by the sticker. When the highest
 * offer is not the best one, that is said in a sentence at the top rather than
 * left for somebody to notice in a column — it is the single most useful thing
 * this product can tell a seller, and noticing it is the job.
 *
 * Release is a separate, deliberate act. An offer arrives while the agent is
 * driving; presenting it unreviewed is how somebody replies to a number before
 * anybody has read the terms under it.
 */
export function Offers({ leadId, offers, costs, agentFirst }: {
  leadId: string;
  offers: Offer[];
  costs: SellerCosts | null;
  agentFirst: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [payoff, setPayoff] = useState(costs ? String(costs.payoff) : "");
  const [commission, setCommission] = useState(costs ? String(costs.commissionPct) : "5");

  const [from, setFrom] = useState("");
  const [price, setPrice] = useState("");
  const [concessions, setConcessions] = useState("");
  const [repairCredit, setRepairCredit] = useState("");
  const [earnest, setEarnest] = useState("");
  const [financing, setFinancing] = useState<Financing>("conventional");
  const [closeOn, setCloseOn] = useState("");
  const [preapproval, setPreapproval] = useState(false);
  const [proofOfFunds, setProofOfFunds] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "that did not work"); return; }
      setError(null);
      after?.();
    });

  const ranked = costs ? rankOffers(offers, costs) : [];
  const netById = new Map(ranked.map((n) => [n.offerId, n]));
  const trap = costs ? headlineTrap(offers, costs) : null;
  const ordered = costs
    ? ranked.map((n) => offers.find((o) => o.id === n.offerId)!)
    : offers;

  return (
    <section className="card p-4" style={{ marginTop: 18 }}>
      <div className="between gap-2 wrap">
        <div>
          <div className="t-md w6">Offers</div>
          <div className="t-xs c-4" style={{ marginTop: 2 }}>
            Ranked by what reaches them, not by the price on the front page.
          </div>
        </div>
        {!adding ? (
          <button className="btn btn-p btn-sm" onClick={() => setAdding(true)}>
            <Ico.plus size={14} />Record an offer
          </button>
        ) : null}
      </div>

      {error ? <p className="t-xs c-neg" style={{ marginTop: 10 }}>{error}</p> : null}

      {/* Without these two figures the comparison is not wrong, it is
          meaningless — and a net computed against an assumed payoff of zero
          would look entirely reasonable while being out by the size of
          somebody's mortgage. So it refuses rather than assumes. */}
      {!costs ? (
        <div className="card p-4" style={{ marginTop: 14, background: "var(--sunk)" }}>
          <div className="t-sm w6">Two figures first.</div>
          <p className="t-xs c-4" style={{ marginTop: 4, lineHeight: 1.6, maxWidth: 480 }}>
            Net to seller cannot be worked out without what they still owe and the total
            commission. Nothing is guessed here — a net computed against an assumed payoff
            reads perfectly and is wrong by the size of a mortgage.
          </p>
          <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
            <input className="input" style={{ width: 170 }} inputMode="decimal"
              value={payoff} onChange={(e) => setPayoff(e.target.value)}
              placeholder="Still owed" aria-label="Still owed" />
            <input className="input" style={{ width: 130 }} inputMode="decimal"
              value={commission} onChange={(e) => setCommission(e.target.value)}
              placeholder="Commission %" aria-label="Total commission percent" />
            <button className="btn btn-s btn-sm" disabled={pending || !payoff.trim()}
              onClick={() => run(() => saveSellerCosts(leadId, Number(payoff), Number(commission)))}>
              Save
            </button>
          </div>
        </div>
      ) : null}

      {trap ? (
        <div className="card p-4" style={{ marginTop: 14, borderColor: "var(--warn-line)", background: "var(--warn-wash)" }}>
          <div className="row gap-2" style={{ alignItems: "flex-start" }}>
            <Ico.alert size={15} className="c-warn" style={{ flex: "none", marginTop: 2 }} />
            <div>
              <div className="t-sm w6">The highest offer is not the best one.</div>
              <p className="t-xs c-2" style={{ marginTop: 4, lineHeight: 1.6 }}>
                {trap.highest.from} offered {money(trap.highest.price)}, but {trap.bestNet.from} leaves
                them {money(trap.difference)} more once everything asked back comes out.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <p className="t-xs c-4" style={{ marginTop: 14 }}>Nothing recorded yet.</p>
      ) : (
        <div className="col gap-2" style={{ marginTop: 14 }}>
          {ordered.map((o, i) => {
            const n = netById.get(o.id);
            const gaps = gapsIn(o);
            return (
              <div key={o.id} className="card p-4" style={{
                borderColor: i === 0 && costs ? "var(--pos-line)" : undefined,
              }}>
                <div className="between gap-3 wrap" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row gap-2 wrap">
                      <span className="t-md w6">{o.from}</span>
                      <span className="chip t-2xs">{FINANCING_LABEL[o.financing]}</span>
                      {i === 0 && costs && ordered.length > 1
                        ? <span className="chip chip-pos t-2xs">Nets most</span> : null}
                      {o.releasedAt
                        ? <span className="chip chip-brand t-2xs">They can see this</span>
                        : <span className="chip t-2xs">Not shown to them</span>}
                    </div>
                    <div className="t-xs c-4" style={{ marginTop: 4 }}>
                      {money(o.price)} offered
                      {o.concessions > 0 ? ` · ${money(o.concessions)} concessions` : ""}
                      {o.repairCredit > 0 ? ` · ${money(o.repairCredit)} repair credit` : ""}
                      {o.closeOn ? ` · closes ${o.closeOn}` : " · no closing date"}
                    </div>
                    {o.contingencies.length ? (
                      <div className="t-xs c-4" style={{ marginTop: 3 }}>
                        Contingent on {o.contingencies.join(", ")}
                      </div>
                    ) : null}
                    {gaps.length ? (
                      <div className="col gap-1" style={{ marginTop: 8 }}>
                        {gaps.map((g) => (
                          <div key={g} className="t-xs c-warn">
                            <Ico.alert size={11} style={{ marginRight: 5 }} />{g}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ textAlign: "right", flex: "none" }}>
                    {n ? (
                      <>
                        <div className="num t-lg">{money(n.net)}</div>
                        <div className="t-2xs c-4">reaches them</div>
                        {n.behindBy < 0 ? (
                          <div className="t-2xs c-neg" style={{ marginTop: 2 }}>
                            {money(Math.abs(n.behindBy))} behind
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="t-2xs c-4" style={{ maxWidth: 120 }}>
                        Net needs the payoff
                      </div>
                    )}
                  </div>
                </div>

                <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
                  <button className="btn btn-g btn-sm" disabled={pending}
                    onClick={() => run(() => releaseOffer(leadId, o.id, !o.releasedAt))}>
                    {o.releasedAt ? "Take it back" : "Release to them"}
                  </button>
                  <span className="spacer" />
                  <button className="t-2xs c-4" disabled={pending}
                    onClick={() => run(() => deleteOffer(leadId, o.id))}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="card p-4" style={{ marginTop: 14, background: "var(--sunk)" }}>
          <div className="col gap-2">
            <input className="input" value={from} onChange={(e) => setFrom(e.target.value)}
              placeholder="Who made it" aria-label="Who made it" maxLength={120} />
            <div className="row gap-2 wrap">
              <input className="input" style={{ width: 150 }} inputMode="decimal"
                value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="Price" aria-label="Offer price" />
              <input className="input" style={{ width: 150 }} inputMode="decimal"
                value={concessions} onChange={(e) => setConcessions(e.target.value)}
                placeholder="Concessions" aria-label="Concessions asked" />
              <input className="input" style={{ width: 150 }} inputMode="decimal"
                value={repairCredit} onChange={(e) => setRepairCredit(e.target.value)}
                placeholder="Repair credit" aria-label="Repair credit" />
              <input className="input" style={{ width: 150 }} inputMode="decimal"
                value={earnest} onChange={(e) => setEarnest(e.target.value)}
                placeholder="Earnest money" aria-label="Earnest money" />
            </div>
            <div className="row gap-2 wrap">
              <select className="input" style={{ width: 170 }} value={financing}
                aria-label="Financing"
                onChange={(e) => setFinancing(e.target.value as Financing)}>
                {(Object.keys(FINANCING_LABEL) as Financing[]).map((f) => (
                  <option key={f} value={f}>{FINANCING_LABEL[f]}</option>
                ))}
              </select>
              <input className="input" type="date" style={{ width: 160 }}
                value={closeOn} onChange={(e) => setCloseOn(e.target.value)} aria-label="Closing date" />
              <label className="row gap-1 t-xs c-3">
                <input type="checkbox" style={{ width: "auto" }} checked={preapproval}
                  onChange={(e) => setPreapproval(e.target.checked)} />
                Preapproval attached
              </label>
              <label className="row gap-1 t-xs c-3">
                <input type="checkbox" style={{ width: "auto" }} checked={proofOfFunds}
                  onChange={(e) => setProofOfFunds(e.target.checked)} />
                Proof of funds
              </label>
            </div>
            <div className="row gap-2">
              <button className="btn btn-s btn-sm" disabled={pending || !from.trim() || !(Number(price) > 0)}
                onClick={() => run(
                  () => recordOffer(leadId, {
                    from: from.trim(), price: Number(price),
                    concessions: Number(concessions) || 0,
                    repairCredit: Number(repairCredit) || 0,
                    earnest: Number(earnest) || 0,
                    financing, closeOn: closeOn || null,
                    preapproval, proofOfFunds,
                  }),
                  () => {
                    setAdding(false); setFrom(""); setPrice(""); setConcessions("");
                    setRepairCredit(""); setEarnest(""); setCloseOn("");
                    setPreapproval(false); setProofOfFunds(false);
                  },
                )}>
                Record it
              </button>
              <button className="btn btn-g btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
            {/* Said where it is decided, not in a help page. */}
            <p className="t-2xs c-4">
              Nothing here reaches {agentFirst === "You" ? "them" : "them"} until you release it.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
