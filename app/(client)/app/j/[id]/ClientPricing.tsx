"use client";

import { useState } from "react";
import { money } from "@/lib/core/compute";
import { COMP_STATUS_LABEL, type Opinion } from "@/lib/core/pricing";
import { useRefresh } from "@/components/rift/useRefresh";
import { post } from "../../post";
import { showDay } from "@/lib/core/day";

const DAY = (d: string) => showDay(d, { month: "long", day: "numeric" });

type Answer = "agree" | "discuss";

/**
 * The seller's view of pricing (S04): the agent's opinion and the homes it
 * rests on, their own net at each end of the range, and one answer: launch
 * at it, or talk first. An answer is recorded, never a decision taken for
 * them, and a revised version asks again.
 */
export function ClientPricing({ journeyId, opinion, scenarios, mine, canAnswer, agentFirst }: {
  journeyId: string;
  opinion: Opinion;
  scenarios: { label: string; price: number; text: string }[] | null;
  mine: { response: Answer; at: string } | null;
  canAnswer: boolean;
  agentFirst: string;
}) {
  const refresh = useRefresh(`${opinion.id}|${mine?.at ?? ""}`);
  /* Changing an answer and opening the note are two things. They were one
     flag, so "I want to talk first" while changing an answer closed the
     buttons it was one of. */
  const [changing, setChanging] = useState(false);
  const [talking, setTalking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Answer | null>(null);
  /* Shown the moment the server has it, not when the refresh lands: until
     then the buttons stayed up with nothing said, and a seller who sees
     nothing taps again. Tied to this version, so a revision asks again. */
  const [sent, setSent] = useState<{ opinionId: string; response: Answer } | null>(null);
  const justSent = sent?.opinionId === opinion.id ? sent.response : null;
  const answered = justSent ?? mine?.response ?? null;

  const answer = async (response: Answer) => {
    setBusy(response);
    const r = await post({ action: "pricing-answer", journeyId, opinionId: opinion.id, response, note: response === "discuss" ? note : null });
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "That did not save."); return; }
    setError(null); setSent({ opinionId: opinion.id, response }); setChanging(false); setTalking(false); setNote(""); refresh();
  };

  return (
    <div>
      <p className="t-md">{agentFirst} suggests listing at <span className="w6">{money(opinion.listPrice)}</span>, within a range of {money(opinion.low)} to {money(opinion.high)}.</p>
      <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.6 }}>{opinion.rationale}</p>
      <ul className="t-sm" style={{ marginTop: 8, display: "grid", gap: 4 }}>
        {opinion.comps.map((c, i) => (
          <li key={i}><span className="w6">{c.address}</span>: {money(c.price)}, {COMP_STATUS_LABEL[c.status].toLowerCase()} {DAY(c.on)}. <span className="c-3">{c.note}</span></li>
        ))}
      </ul>
      {scenarios ? (
        <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
          <div className="t-xs w6">What you would keep, on the figures recorded so far</div>
          <ul className="t-sm" style={{ marginTop: 4, display: "grid", gap: 2 }}>
            {scenarios.map((s) => <li key={s.label}>{s.label}, {money(s.price)}: {s.text}</li>)}
          </ul>
        </div>
      ) : null}
      <p className="t-xs c-4" style={{ marginTop: 8 }}>
        An opinion, not a prediction: buyers decide the price, and nobody can promise how long a sale takes. Version {opinion.version}; {agentFirst} reviews it with you on {DAY(opinion.reviewOn)}.
      </p>

      {canAnswer ? (
        <p className="t-sm" style={{ marginTop: 10 }}>
          <span role="status">
            {answered
              ? `✓ You ${answered === "agree" ? "agreed to launch at this price" : "asked to talk it through first"}.${justSent ? ` ${agentFirst} can see your answer.` : ""}`
              : ""}
          </span>
          {answered && !changing ? <>{" "}<button type="button" className="btn-link t-xs" onClick={() => setChanging(true)}>Change your answer</button></> : null}
        </p>
      ) : <p className="t-xs c-4" style={{ marginTop: 10 }}>Your access shows the pricing; the sellers answer it.</p>}

      {canAnswer && (!answered || changing) ? (
        <div className="col gap-2" style={{ marginTop: 10 }}>
          <div className="row gap-2 wrap">
            <button className="btn btn-p btn-sm" disabled={busy !== null} onClick={() => answer("agree")}>
              {busy === "agree" ? "Saving…" : `Launch at ${money(opinion.listPrice)}`}
            </button>
            <button className="btn btn-g btn-sm" disabled={busy !== null} onClick={() => setTalking((v) => !v)} aria-expanded={talking}>I want to talk first</button>
            {changing ? (
              <button className="btn btn-g btn-sm" disabled={busy !== null} onClick={() => { setChanging(false); setTalking(false); }}>Keep my answer</button>
            ) : null}
          </div>
          {talking ? (
            <div className="col gap-2">
              <label className="col gap-1 t-xs">What would you like to talk about? (optional)
                <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button className="btn btn-s btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy !== null} onClick={() => answer("discuss")}>
                {busy === "discuss" ? "Sending…" : `Send to ${agentFirst}`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}
    </div>
  );
}
