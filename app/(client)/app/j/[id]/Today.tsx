"use client";

import { useState } from "react";
import { useRefresh } from "@/components/rift/useRefresh";
import type { TodayItem, TodayKind } from "@/lib/core/today";
import type { WorkState, Workstream } from "@/lib/core/progress";
import { post } from "../../post";
import { newRequestId } from "@/lib/core/ids";

/** A workstream as the buyer may see it: worded on the server (lib/core/progress `workLine`). */
export interface BuyerWork {
  workstream: Workstream;
  label: string;
  state: WorkState;
  stateLabel: string;
  line: string;
  /** Theirs to do, and not yet reported or settled: they can say they did it. */
  canReport: boolean;
  seq: number;
}

const HEADING: Record<TodayKind, string> = {
  blocker: "Needs sorting out",
  overdue: "Past its date",
  decision: "Waiting on your answer",
  yours: "Yours to do",
  others: "What others are doing",
};
/* A stage not reached yet: dimmer ink and a dashed edge, never opacity. At
   0.55 the label fell to 3:1, and the stages ahead are exactly the ones a
   buyer reads to see what is coming. --ink-4 is the AA floor on --sunk. */
const AHEAD = { color: "var(--ink-4)", borderStyle: "dashed" } as const;
const ORDER: TodayKind[] = ["blocker", "overdue", "decision", "yours", "others"];
const CHIP: Partial<Record<WorkState, string>> = { blocked: "chip-neg", reported: "chip-warn", confirmed: "chip-pos", waiting: "chip-warn" };

/**
 * Today, for the buyer (blueprint v4 §6). The order is decided on the server
 * by lib/core/today.ts; this renders it and offers the one write a buyer has
 * here: saying they did their part, which is recorded as reported until the
 * person it depends on confirms it (REQ-UX-02).
 */
export function Today({ journeyId, where, strip, items, nothingOwed, contract, canRespond, agentFirst }: {
  journeyId: string;
  where: string;
  strip: { stage: string; label: string; state: "done" | "skipped" | "now" | "ahead" }[];
  items: TodayItem[];
  nothingOwed: string | null;
  contract: { id: string; address: string; title: string; summary: string; work: BuyerWork[] } | null;
  canRespond: boolean;
  agentFirst: string;
}) {
  const refresh = useRefresh(JSON.stringify(contract?.work.map((w) => [w.workstream, w.seq]) ?? []));
  const [reporting, setReporting] = useState<Workstream | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  /* Under the button it is about. It was at the top of Today, above the
     stages and the lists, a screen or more from the contract's parts. */
  const [error, setError] = useState<{ work: Workstream; text: string } | null>(null);
  const [sent, setSent] = useState<Workstream | null>(null);
  const [req, setReq] = useState(newRequestId);

  const report = async (w: BuyerWork) => {
    if (!contract) return;
    setBusy(true);
    const r = await post({ action: "report-work", journeyId, contractId: contract.id, workstream: w.workstream, note, expectedSeq: w.seq, requestId: req });
    setBusy(false);
    if (!r.ok) { setError({ work: w.workstream, text: r.error ?? "That did not save." }); return; }
    setError(null);
    setReq(newRequestId());
    setReporting(null);
    setNote("");
    setSent(w.workstream);
    refresh();
  };

  return (
    <div>
      <ol className="row gap-1 wrap" aria-label="Where your move is" style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
        {strip.map((s) => (
          <li key={s.stage} className={`chip t-2xs ${s.state === "now" ? "chip-pos" : ""}`}
            aria-current={s.state === "now" ? "step" : undefined} style={s.state === "now" || s.state === "done" ? undefined : AHEAD}>
            {s.state === "done" ? "✓ " : ""}{s.label}
          </li>
        ))}
      </ol>
      <p className="t-sm" style={{ marginTop: 8 }}>{where}</p>

      {nothingOwed ? <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>{nothingOwed}</p> : null}
      {ORDER.map((kind) => {
        const list = items.filter((i) => i.kind === kind);
        if (!list.length) return null;
        return (
          <div key={kind} style={{ marginTop: 12 }}>
            <div className={`t-xs w6 ${kind === "blocker" || kind === "overdue" ? "c-neg" : ""}`}>{HEADING[kind]}</div>
            <ul style={{ marginTop: 4, display: "grid", gap: 6 }}>
              {list.map((i, n) => (
                <li key={`${kind}-${n}`} className="t-sm" style={{ lineHeight: 1.5 }}>
                  <span className="w6">{i.title}</span>
                  <span className="c-3"> {i.detail}</span>
                  {i.anchor ? <> <a className="btn-link t-xs" href={`#${i.anchor}`}>Go to it</a></> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {contract ? (
        <div id="under-contract" style={{ marginTop: 16 }}>
          <div className="t-sm w6">{contract.title}</div>
          <p className="t-xs c-3" style={{ marginTop: 2 }}>{contract.summary}</p>
          <ul style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {contract.work.map((w) => (
              <li key={w.workstream} className="card p-3">
                <div className="between gap-2 wrap">
                  <span className="t-sm w6">{w.label}</span>
                  <span className={`chip t-2xs ${CHIP[w.state] ?? ""}`}>{w.stateLabel}</span>
                </div>
                <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.5 }}>{w.line}</p>
                {/* From the moment the server has it, not from when the
                    refresh brings the new state: until then this said
                    nothing and "I have done this" came straight back. */}
                {sent === w.workstream ? (
                  <p role="status" className="t-2xs c-pos" style={{ marginTop: 4 }}>Sent to {agentFirst}.</p>
                ) : null}
                {w.canReport && canRespond && sent !== w.workstream ? (
                  reporting === w.workstream ? (
                    <div style={{ marginTop: 8 }}>
                      <input className="input" value={note} maxLength={500} placeholder="Anything to add? (optional)"
                        aria-label={`About ${w.label.toLowerCase()}`} onChange={(e) => setNote(e.target.value)} />
                      <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
                        <button className="btn btn-p btn-sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => report(w)}>
                          {busy ? "Sending…" : `Tell ${agentFirst} it is done`}
                        </button>
                        <button className="btn btn-g btn-sm" style={{ minHeight: 44 }} onClick={() => setReporting(null)}>Back</button>
                      </div>
                      {error?.work === w.workstream ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error.text}</p> : null}
                      <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
                        {w.workstream === "earnest-money"
                          ? "This says you sent it. It counts as received once the holder confirms it. Only use payment instructions you have confirmed by phone with the holder."
                          : `This tells ${agentFirst} you did your part. It shows as confirmed once whoever it depends on confirms it.`}
                      </p>
                    </div>
                  ) : (
                    <button className="btn btn-s btn-sm" style={{ marginTop: 8, minHeight: 44 }} onClick={() => { setReporting(w.workstream); setNote(""); }}>
                      {w.workstream === "earnest-money" ? "I sent it" : "I have done this"}
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
