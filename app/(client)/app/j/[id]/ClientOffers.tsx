"use client";

import { Fragment, useState } from "react";
import { useRefresh } from "@/components/rift/useRefresh";
import { INSTRUCTION_LABEL, termText, type BuyerBid, type Instruction, type Terms } from "@/lib/core/bid";
import { FAMILY_LABEL, type Family } from "@/lib/core/document";
import { post } from "../../post";

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const WHEN = (iso: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
}).format(new Date(iso));
const ROWS: [keyof Terms, string][] = [
  ["price", "Price"], ["earnestMoney", "Earnest money"], ["financing", "Paying by"], ["downPct", "Down payment"],
  ["concessions", "Asked back from the seller"], ["dueDiligenceDays", "Due diligence period"],
  ["financingContingency", "Financing contingency"], ["appraisalContingency", "Appraisal contingency"], ["closingDate", "Closing date"],
];

/**
 * The household's offers, for a buyer (journey contracts B08 to B10). Only
 * versions the agent asked them about; the terms and money are worded on the
 * server. The one write is an instruction on the current version, which is
 * said plainly to be neither a signature nor an acceptance (REQ-DEC-03).
 */
export function ClientOffers({ journeyId, bids, canRespond, agentFirst }: {
  journeyId: string;
  bids: Omit<BuyerBid, "sharedDocumentIds">[];
  canRespond: boolean;
  agentFirst: string;
}) {
  const refresh = useRefresh(JSON.stringify(bids.map((b) => [b.id, b.status, b.asked?.version, b.asked?.answers.length])));
  const [choice, setChoice] = useState<Record<string, Instruction | null>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [req, setReq] = useState(newRequest);

  const answer = async (b: (typeof bids)[number]) => {
    const instruction = choice[b.id];
    if (!instruction || !b.asked) return;
    setBusy(b.id);
    const r = await post({ action: "bid-answer", journeyId, bidId: b.id, version: b.asked.version, instruction, note: note[b.id] ?? "", requestId: req });
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "That did not save."); return; }
    setError(null);
    setReq(newRequest());
    setSent(b.id);
    refresh();
  };

  return (
    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
      {error ? <p role="alert" className="t-xs c-neg">{error}</p> : null}
      {bids.map((b) => {
        const a = b.asked;
        const picked = choice[b.id] ?? null;
        return (
          <div key={b.id} className="card p-3">
            <div className="t-sm w6">{b.address}</div>
            <p className="t-xs c-3" style={{ marginTop: 2, lineHeight: 1.5 }}>{b.line}</p>
            {a ? (
              <>
                <div className="t-xs w6" style={{ marginTop: 10 }}>
                  Version {a.version}{a.fromThem ? ", the seller's counter" : ""}{b.newerDraft ? ` (${agentFirst} is working on a newer version)` : ""}
                </div>
                {a.changes.length ? (
                  <p className="t-xs" style={{ marginTop: 4, lineHeight: 1.5 }}>
                    What changed: {a.changes.map((c) => `${c.label} ${c.before} to ${c.after}`).join("; ")}.
                  </p>
                ) : null}
                <dl className="t-xs" style={{ marginTop: 6, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "2px 12px" }}>
                  {ROWS.map(([f, label]) => <Fragment key={f}><dt className="c-4">{label}</dt><dd>{termText(f, a.terms)}</dd></Fragment>)}
                  {a.terms.respondBy ? <><dt className="c-4">Respond by</dt><dd>{WHEN(a.terms.respondBy)} ({a.terms.respondBySource})</dd></> : null}
                  {a.terms.other ? <><dt className="c-4">Other</dt><dd>{a.terms.other}</dd></> : null}
                </dl>
                <p className="t-2xs c-3" style={{ marginTop: 6, lineHeight: 1.5 }}>
                  On these terms: {usd(a.effects.cashAtContract)} earnest money when it goes under contract, then about{" "}
                  {usd(a.effects.cashAtClosingBeforeCosts)} more at closing before closing costs, which are not estimated here.
                  {a.effects.loanAmount ? ` Loan of ${usd(a.effects.loanAmount)}.` : ""}
                </p>
                {a.documents.length ? (
                  <p className="t-xs" style={{ marginTop: 6 }}>
                    {a.documents.map((d, i) => (
                      <span key={d.id}>{i ? " · " : ""}<a className="u" href={`/api/app/document?journeyId=${journeyId}&id=${d.id}`} target="_blank" rel="noreferrer">
                        {d.label}</a> <span className="c-4">({FAMILY_LABEL[d.family as Family] ?? "Document"})</span></span>
                    ))}
                  </p>
                ) : null}
                {a.answers.length ? (
                  <ul className="t-xs" style={{ marginTop: 8, display: "grid", gap: 2 }}>
                    {a.answers.map((x) => (
                      <li key={x.name}><span className="w6">{x.mine ? "You" : x.name}:</span> {INSTRUCTION_LABEL[x.instruction]}{x.note ? `. "${x.note}"` : ""}</li>
                    ))}
                  </ul>
                ) : null}
                {a.waitingOn.length && a.open ? <p className="t-2xs c-4" style={{ marginTop: 4 }}>Still to answer: {a.waitingOn.join(", ")}.</p> : null}

                {a.open && a.mineNeeded && canRespond && !b.newerDraft ? (
                  <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
                    <div className="t-sm w6">{a.myAnswer ? "Change your answer?" : `How should ${agentFirst} proceed?`}</div>
                    <div className="row gap-2 wrap" role="group" aria-label={`Your instruction on ${b.address}`} style={{ marginTop: 8 }}>
                      {(Object.keys(INSTRUCTION_LABEL) as Instruction[]).map((i) => (
                        <button key={i} className={`btn btn-sm ${picked === i ? "btn-p" : "btn-s"}`} style={{ minHeight: 44 }}
                          aria-pressed={picked === i} onClick={() => setChoice({ ...choice, [b.id]: i })}>
                          {INSTRUCTION_LABEL[i]}
                        </button>
                      ))}
                    </div>
                    {picked && picked !== "proceed" ? (
                      <input className="input" style={{ marginTop: 8 }} maxLength={500} value={note[b.id] ?? ""}
                        placeholder={picked === "change" ? "What should change?" : "Why not?"} aria-label="What should change, or why not"
                        onChange={(e) => setNote({ ...note, [b.id]: e.target.value })} />
                    ) : null}
                    <button className="btn btn-p btn-sm" style={{ marginTop: 8, minHeight: 44 }}
                      disabled={!picked || busy === b.id || (picked !== "proceed" && !(note[b.id] ?? "").trim())}
                      onClick={() => answer(b)}>
                      {busy === b.id ? "Sending…" : `Send to ${agentFirst}`}
                    </button>
                    <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
                      This tells {agentFirst} how to proceed on version {a.version}. It does not sign, send or accept anything: the offer is
                      prepared and signed separately, and nothing goes ahead until everyone asked has said go ahead.
                    </p>
                    {sent === b.id ? <p role="status" className="t-2xs c-pos" style={{ marginTop: 4 }}>Sent to {agentFirst}.</p> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
