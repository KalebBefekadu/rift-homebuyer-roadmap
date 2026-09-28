"use client";

import { useState } from "react";
import { money } from "@/lib/core/compute";
import { FACT_KINDS, FACT_LABEL, type Fact, type FactKind } from "@/lib/core/ledger";
import { useWrite } from "./useWrite";
import { georgiaDay, showDay } from "@/lib/core/day";
import { newRequestId } from "@/lib/core/ids";
import { typedNumber } from "@/lib/core/typed";

const DAY = (d: string) => showDay(d, { month: "short", day: "numeric", year: "numeric" });
const today = () => georgiaDay();

/**
 * Recording a money amount from a named source (money v2, Blueprint v5
 * §10.1): the contract price, the earnest money, the lender's closing costs,
 * a seller credit, assistance once approved, the closing disclosure's cash
 * to close. Each amount says where it came from and the day; a new amount of
 * the same kind replaces the old one in the ledger and both stay on record.
 */
export function MoneyFacts({ journeyId, facts }: { journeyId: string; facts: Fact[] }) {
  const { busy, error, setError, write } = useWrite(`${facts.length}:${facts.at(-1)?.at ?? ""}`);
  const [kind, setKind] = useState<FactKind>("earnest");
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amount = typedNumber(f.get("amount"));
    if (amount === null || Number.isNaN(amount)) { setError("Give the amount in dollars, like 5000"); return; }
    const form = e.currentTarget;
    const r = await write("record-money", {
      journeyId, kind, amount, source: String(f.get("source") ?? ""), asOf: String(f.get("asOf") ?? ""), requestId: newRequestId(),
    });
    if (r.ok) { setDone(`${FACT_LABEL[kind]}: ${money(amount)} recorded.`); form.reset(); }
  };

  return (
    <div className="col gap-3">
      <form onSubmit={submit} className="card p-4 col gap-2" aria-labelledby="money-record-h">
        <h3 id="money-record-h" className="t-sm w6">Record an amount</h3>
        <div className="g2 gap-2">
          <label className="col gap-1 t-xs">What it is
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as FactKind)}>
              {FACT_KINDS.map((k) => <option key={k} value={k}>{FACT_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="col gap-1 t-xs">Amount, in dollars
            <input className="input" name="amount" inputMode="decimal" required placeholder="3,500" />
          </label>
          <label className="col gap-1 t-xs">Where it comes from
            <input className="input" name="source" required minLength={3} maxLength={160} placeholder="Loan Estimate from Peach Mortgage" />
          </label>
          <label className="col gap-1 t-xs">The day they gave it
            <input className="input" name="asOf" type="date" required defaultValue={today()} max={today()} />
          </label>
        </div>
        {kind === "assistance-approved" ? <p className="t-xs c-3">Only an approval counts: name who approved it, like &ldquo;Georgia Dream approval letter via Peach Mortgage&rdquo;.</p> : null}
        {kind === "official-cash-to-close" ? <p className="t-xs c-3">From the closing disclosure. It is shown as its own figure and never replaces the estimate.</p> : null}
        <div className="row gap-2 wrap">
          <button className="btn btn-p btn-sm" disabled={busy}>{busy ? "Saving…" : "Record it"}</button>
          {error ? <span role="alert" className="t-xs c-neg">{error}</span> : done ? <span role="status" className="t-xs c-pos">✓ {done}</span> : null}
        </div>
      </form>

      {facts.length ? (
        <section aria-labelledby="money-history-h">
          <h3 id="money-history-h" className="t-sm w6">Recorded, newest first</h3>
          <ul style={{ marginTop: 4 }}>
            {[...facts].reverse().map((f) => (
              <li key={f.at + f.kind} className="desk-row t-sm">
                <span className="w6">{FACT_LABEL[f.kind]}</span> {money(f.amount)}
                <div className="desk-meta">{f.source}, {DAY(f.asOf)} · recorded by {f.by}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
