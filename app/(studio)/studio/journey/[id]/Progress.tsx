"use client";

import { useState } from "react";
import Link from "next/link";
import {
  STAGE_LABEL, STATUS_LABEL, WORK_STATES, WORK_STATE_LABEL,
  afterClose, marketDay, ownerText, stageStrip, visitedStages, workSummary,
  type Financing, type JourneyEvent, type JourneyStatus, type Owner, type Progress as ProgressState,
  type Stage, type WorkState, type WorkUpdate, type Workstream, type WorkstreamView,
} from "@/lib/core/progress";
import { useWrite } from "./useWrite";

export interface ContractView {
  id: string;
  address: string;
  financing: Financing;
  evidence: string;
  by: string;
  at: string;
  outcome: { outcome: "closed" | "terminated"; reason: string; by: string; at: string } | null;
  work: WorkstreamView[];
  history: Record<Workstream, WorkUpdate[]>;
}

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const DAY = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const today = () => marketDay();
const CHIP: Record<WorkState, string> = {
  "not-started": "", "in-progress": "", waiting: "chip-warn", blocked: "chip-neg",
  reported: "chip-warn", confirmed: "chip-pos", "not-applicable": "",
};
/* Stages the agent can pick by hand. Under contract and Own come from the contract record. */
/* A stage not reached yet: dimmer ink and a dashed edge, never opacity. At
   0.55 the label fell to 3:1, and the stages ahead are exactly the ones a
   buyer reads to see what is coming. --ink-4 is the AA floor on --sunk. */
const AHEAD = { color: "var(--ink-4)", borderStyle: "dashed" } as const;
const MANUAL: Stage[] = ["prepare", "search", "tour", "offer", "close"];

/**
 * Where the journey is and, under contract, what is running (W07).
 *
 * Every change is recorded with a reason and says who made it; nothing here
 * moves on its own. Under contract and Own are reached only by recording
 * the contract and how it ended, so the stage and the attempt never
 * disagree. Each workstream has its own owner and the date of the last word
 * from whoever gave it; one gone quiet for a week says so.
 */
export function Progress({ journeyId, progress, events, open, past, homes, coverage, leadId, person, unavailable, nudge }: {
  journeyId: string;
  progress: ProgressState;
  events: JourneyEvent[];
  open: ContractView | null;
  past: ContractView[];
  homes: { id: string; address: string }[];
  coverage: { covered: boolean; note: string };
  leadId: string;
  person: string;
  unavailable?: string;
  /** A suggestion from the rest of the page, e.g. an offer in progress. Never moves anything. */
  nudge?: string | null;
}) {
  /* Once a contract closed: possession is still worked on it (W11, B18). */
  const closed = afterClose(past, open);
  const stamp = `${progress.seq}|${open ? open.work.map((w) => w.seq).join(",") : "-"}|${closed ? closed.work.map((w) => w.seq).join(",") : "-"}`;
  const { busy, error, write } = useWrite(stamp);
  const [req, setReq] = useState(newRequest);
  const [form, setForm] = useState<null | "stage" | "status" | "contract" | "end">(null);
  const [to, setTo] = useState<Stage>("search");
  const [status, setStatus] = useState<JourneyStatus>("paused");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [homeId, setHomeId] = useState("");
  const [financing, setFinancing] = useState<Financing>("financed");
  const [outcome, setOutcome] = useState<"closed" | "terminated">("terminated");
  const [backTo, setBackTo] = useState<Stage>("search");
  const [history, setHistory] = useState(false);

  if (unavailable) return <p className="t-xs c-warn">{unavailable}</p>;

  const run = async (op: string, body: Record<string, unknown>) => {
    const r = await write(op, { journeyId, requestId: req, expectedSeq: progress.seq, ...body });
    if (r.ok) { setReq(newRequest()); setForm(null); setReason(""); setEvidence(""); }
    return r.ok;
  };
  const finished = progress.status === "completed" || progress.status === "cancelled";
  const statusChoices: JourneyStatus[] = finished
    ? ["active"]
    : progress.status === "paused"
      ? ["active", "cancelled"]
      : progress.stage === "own" ? ["completed", "paused", "cancelled"] : ["paused", "cancelled"];

  return (
    <div>
      <ol className="row gap-1 wrap" aria-label="Stages" style={{ listStyle: "none", padding: 0 }}>
        {stageStrip(progress, visitedStages(events)).map((s) => (
          <li key={s.stage} className={`chip t-2xs ${s.state === "now" ? "chip-pos" : ""}`}
            aria-current={s.state === "now" ? "step" : undefined} style={s.state === "ahead" ? AHEAD : undefined}>
            {s.state === "done" ? "✓ " : ""}{s.label}{s.state === "skipped" ? " (not recorded)" : ""}
          </li>
        ))}
      </ol>
      <p className="t-xs c-3" style={{ marginTop: 8 }}>
        <span className="w6">{STAGE_LABEL[progress.stage]}</span>
        {progress.stageSince ? ` since ${DAY(progress.stageSince)}` : ", nothing recorded yet"}
        {progress.status !== "active" ? <> · <span className="c-warn">{STATUS_LABEL[progress.status]}</span></> : null}
      </p>
      {nudge ? <p className="t-xs c-warn" style={{ marginTop: 6, lineHeight: 1.55 }}>{nudge}</p> : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}

      <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
        {!finished ? <button className="btn btn-s btn-sm" onClick={() => { setTo(MANUAL.find((s) => s !== progress.stage)!); setForm(form === "stage" ? null : "stage"); }}>Change the stage</button> : null}
        <button className="btn btn-g btn-sm" onClick={() => { setStatus(statusChoices[0]!); setForm(form === "status" ? null : "status"); }}>
          {finished ? "Reopen" : progress.status === "paused" ? "Resume or cancel" : "Pause, cancel or complete"}
        </button>
        {events.length ? <button className="btn btn-g btn-sm" onClick={() => setHistory((v) => !v)}>{history ? "Hide" : "History"} ({events.length})</button> : null}
      </div>

      {form === "stage" ? (
        <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "1 1 160px" }}><span className="label">Move to</span>
              <select className="input" value={to} onChange={(e) => setTo(e.target.value as Stage)}>
                {MANUAL.filter((s) => s !== progress.stage).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select></label>
            <label className="field" style={{ flex: "3 1 240px" }}><span className="label">Why</span>
              <input className="input" value={reason} maxLength={500} placeholder="Search set up in Matrix and approved"
                onChange={(e) => setReason(e.target.value)} /></label>
          </div>
          {to === "close" ? (
            <label className="field" style={{ marginTop: 8 }}><span className="label">What shows closing is being prepared</span>
              <input className="input" value={evidence} maxLength={300} placeholder="Closing set with Smith Law for Oct 30"
                onChange={(e) => setEvidence(e.target.value)} /></label>
          ) : null}
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={busy || !reason.trim()} onClick={() => run("stage", { to, reason, evidence })}>
              {busy ? "Recording…" : "Record the move"}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
          </div>
          <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
            Under contract and Own come from recording the contract below, so the stage always matches it.
            {!coverage.covered ? <> Moving forward past Prepare needs {person}&apos;s agreement in force: {coverage.note} <Link className="u" href={`/studio/lead/${leadId}`}>Their record</Link>.</> : null}
          </p>
        </div>
      ) : null}

      {form === "status" ? (
        <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "1 1 160px" }}><span className="label">Make it</span>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as JourneyStatus)}>
                {statusChoices.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select></label>
            <label className="field" style={{ flex: "3 1 240px" }}><span className="label">Why</span>
              <input className="input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
          </div>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={busy || !reason.trim()} onClick={() => run("status", { to: status, reason })}>
              {busy ? "Recording…" : "Record it"}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
          </div>
          {status === "paused" && open ? (
            <p className="t-2xs c-4" style={{ marginTop: 8 }}>Pausing does not pause the contract: its workstreams and dates still show.</p>
          ) : null}
        </div>
      ) : null}

      {history ? (
        <ul className="t-2xs c-3" style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {[...events].reverse().map((e) => (
            <li key={e.seq}>
              {DAY(e.at)} · {e.kind === "stage" ? STAGE_LABEL[e.from as Stage] ?? e.from : STATUS_LABEL[e.from as JourneyStatus] ?? e.from}
              {" → "}{e.kind === "stage" ? STAGE_LABEL[e.to as Stage] ?? e.to : STATUS_LABEL[e.to as JourneyStatus] ?? e.to}
              {" · "}{e.reason}{e.evidence ? ` (${e.evidence})` : ""} · {e.by}
            </li>
          ))}
        </ul>
      ) : null}

      {closed ? (
        <div style={{ marginTop: 16 }}>
          <div className="t-sm w6">{person}&apos;s home: {closed.contract.address}</div>
          <p className="t-2xs c-4" style={{ marginTop: 2, lineHeight: 1.5 }}>
            {closed.closing ? `Closing confirmed by ${closed.closing.from} on ${DAY(closed.closing.on)}. ` : ""}
            Possession is recorded here: it can come after the closing, and {person} sees it on Today until it is confirmed.
          </p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {closed.work.map((w) => <Work key={w.workstream} contractId={closed.contract.id} w={w} history={closed.contract.history[w.workstream]} busy={busy} run={run} person={person} />)}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {open ? (
          <OpenContract c={open} busy={busy} run={run} person={person}
            ending={form === "end"} setEnding={(v) => setForm(v ? "end" : null)}
            outcome={outcome} setOutcome={setOutcome} backTo={backTo} setBackTo={setBackTo} reason={reason} setReason={setReason} />
        ) : form === "contract" ? (
          <div className="card p-3" style={{ background: "var(--sunk)" }}>
            <div className="t-sm w6">Record the contract</div>
            <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
              <label className="field" style={{ flex: "2 1 220px" }}><span className="label">Home</span>
                <select className="input" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                  <option value="">Choose a home on the list</option>
                  {homes.map((h) => <option key={h.id} value={h.id}>{h.address}</option>)}
                </select></label>
              <label className="field" style={{ flex: "1 1 140px" }}><span className="label">Paying by</span>
                <select className="input" value={financing} onChange={(e) => setFinancing(e.target.value as Financing)}>
                  <option value="financed">A loan</option>
                  <option value="cash">Cash</option>
                </select></label>
            </div>
            <label className="field" style={{ marginTop: 8 }}><span className="label">What shows it is binding</span>
              <input className="input" value={evidence} maxLength={300} placeholder="Executed purchase agreement, both signatures, Sep 23"
                onChange={(e) => setEvidence(e.target.value)} /></label>
            <div className="row gap-2" style={{ marginTop: 10 }}>
              <button className="btn btn-p btn-sm" disabled={busy || !homeId || !evidence.trim()}
                onClick={() => run("contract", { homeId, financing, evidence })}>
                {busy ? "Recording…" : "Record it and move to Under contract"}
              </button>
              <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
            </div>
            <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
              Record it once both sides have signed. An accepted offer still waiting on signatures is not a contract yet.
              {financing === "cash" ? " A cash purchase has no loan or lender appraisal to track, so those two are marked as not applying." : ""}
            </p>
          </div>
        ) : !finished && progress.stage !== "own" ? (
          <button className="btn btn-s btn-sm" disabled={!homes.length} onClick={() => setForm("contract")}>Record a contract</button>
        ) : null}
        {!open && !homes.length && !finished && progress.stage !== "own" ? <p className="t-2xs c-4" style={{ marginTop: 6 }}>Add the home to the list first.</p> : null}
      </div>

      {past.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="t-2xs c-4 w6">Earlier contracts</div>
          <ul className="t-2xs c-3" style={{ marginTop: 4, display: "grid", gap: 4 }}>
            {past.map((c) => (
              <li key={c.id}>
                {c.address}: recorded {DAY(c.at)}, {c.outcome?.outcome === "closed" ? "closed" : "terminated"} {c.outcome ? DAY(c.outcome.at) : ""}. {c.outcome?.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OpenContract({ c, busy, run, person, ending, setEnding, outcome, setOutcome, backTo, setBackTo, reason, setReason }: {
  c: ContractView;
  busy: boolean;
  run: (op: string, body: Record<string, unknown>) => Promise<boolean>;
  person: string;
  ending: boolean;
  setEnding: (v: boolean) => void;
  outcome: "closed" | "terminated";
  setOutcome: (v: "closed" | "terminated") => void;
  backTo: Stage;
  setBackTo: (v: Stage) => void;
  reason: string;
  setReason: (v: string) => void;
}) {
  return (
    <div>
      <div className="between gap-2 wrap">
        <div className="t-sm w6">Under contract: {c.address}</div>
        <span className="t-2xs c-4">{c.financing === "cash" ? "Cash" : "With a loan"} · recorded {DAY(c.at)} by {c.by}</span>
      </div>
      <p className="t-2xs c-4" style={{ marginTop: 2 }}>{c.evidence}</p>
      <p className="t-xs" style={{ marginTop: 8 }}>{workSummary(c.work)}</p>

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {c.work.map((w) => <Work key={w.workstream} contractId={c.id} w={w} history={c.history[w.workstream]} busy={busy} run={run} person={person} />)}
      </div>

      <div style={{ marginTop: 12 }}>
        {ending ? (
          <div className="card p-3" style={{ background: "var(--sunk)" }}>
            <div className="row gap-2 wrap">
              <label className="field" style={{ flex: "1 1 160px" }}><span className="label">It</span>
                <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value as "closed" | "terminated")}>
                  <option value="terminated">Was terminated</option>
                  <option value="closed">Closed</option>
                </select></label>
              {outcome === "terminated" ? (
                <label className="field" style={{ flex: "1 1 160px" }}><span className="label">The journey goes back to</span>
                  <select className="input" value={backTo} onChange={(e) => setBackTo(e.target.value as Stage)}>
                    <option value="search">Search</option>
                    <option value="offer">Offer, on another home</option>
                  </select></label>
              ) : null}
              <label className="field" style={{ flex: "3 1 240px" }}><span className="label">Why, or what shows it</span>
                <input className="input" value={reason} maxLength={500}
                  placeholder={outcome === "closed" ? "Funded and recorded, keys handed over" : "Terminated in due diligence after the inspection"}
                  onChange={(e) => setReason(e.target.value)} /></label>
            </div>
            <div className="row gap-2" style={{ marginTop: 10 }}>
              <button className="btn btn-p btn-sm" disabled={busy || !reason.trim()}
                onClick={() => run("end-contract", { contractId: c.id, outcome, reason, backTo: outcome === "terminated" ? backTo : null })}>
                {busy ? "Recording…" : outcome === "closed" ? "Record the closing" : "Record the termination"}
              </button>
              <button className="btn btn-g btn-sm" onClick={() => setEnding(false)}>Back</button>
            </div>
            <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
              The contract and everything recorded against it stay on file either way.
              {outcome === "closed" ? " Closed needs the closing confirmed first, by whoever confirmed it. Possession is recorded separately, after." : ""}
            </p>
          </div>
        ) : (
          <button className="btn btn-g btn-sm" onClick={() => setEnding(true)}>It closed, or was terminated</button>
        )}
      </div>
    </div>
  );
}

function Work({ contractId, w, history, busy, run, person }: {
  contractId: string;
  w: WorkstreamView;
  history: WorkUpdate[];
  busy: boolean;
  run: (op: string, body: Record<string, unknown>) => Promise<boolean>;
  person: string;
}) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [state, setState] = useState<WorkState>(w.state);
  const [owner, setOwner] = useState<Owner>(w.owner);
  const [ownerName, setOwnerName] = useState(w.ownerName ?? "");
  const [source, setSource] = useState("");
  const [confirmedOn, setConfirmedOn] = useState(today());
  const [note, setNote] = useState("");

  const open = () => { setState(w.state); setOwner(w.owner); setOwnerName(w.ownerName ?? ""); setSource(""); setConfirmedOn(today()); setNote(""); setEditing(true); };
  const who = w.owner === "client" ? person : ownerText(w, "agent", "");

  return (
    <div className="card p-3">
      <div className="between gap-2 wrap">
        <div className="row gap-2 wrap">
          <span className="t-sm w6">{w.label}</span>
          <span className={`chip t-2xs ${CHIP[w.state]}`}>{WORK_STATE_LABEL[w.state]}</span>
        </div>
        <span className="t-2xs c-4">{who}</span>
      </div>
      <p className={`t-2xs ${w.stale ? "c-warn" : "c-4"}`} style={{ marginTop: 4, lineHeight: 1.5 }}>
        {w.lastWord ? `Last word ${DAY(w.lastWord.on)}, from ${w.lastWord.from}.` : "No word from anybody yet."}
        {w.stale ? ` ${w.daysSinceWord === null ? "Nobody has given word yet" : `Nothing for ${w.daysSinceWord} days`}: ask for an update. The buyer sees "waiting for an update".` : ""}
        {w.note ? ` ${w.note}` : ""}
      </p>
      {w.state === "reported" ? (
        <p className="t-2xs c-warn" style={{ marginTop: 4 }}>
          {person} says this is done. Confirm it once {w.workstream === "earnest-money" ? "the holder confirms receipt" : "whoever it depends on confirms it"}.
        </p>
      ) : null}

      {editing ? (
        <div style={{ marginTop: 8 }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "1 1 150px" }}><span className="label">State</span>
              <select className="input" value={state} onChange={(e) => setState(e.target.value as WorkState)}>
                {WORK_STATES.filter((s) => s !== "reported").map((s) => <option key={s} value={s}>{WORK_STATE_LABEL[s]}</option>)}
              </select></label>
            <label className="field" style={{ flex: "1 1 130px" }}><span className="label">Owner</span>
              <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as Owner)}>
                <option value="client">{person}</option>
                <option value="agent">You</option>
                <option value="other">Someone else</option>
              </select></label>
            {owner === "other" ? (
              <label className="field" style={{ flex: "2 1 180px" }}><span className="label">Who</span>
                <input className="input" value={ownerName} maxLength={160} placeholder="Dana at Peach Mortgage" onChange={(e) => setOwnerName(e.target.value)} /></label>
            ) : null}
          </div>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            <label className="field" style={{ flex: "2 1 180px" }}><span className="label">Heard from{state === "confirmed" ? "" : " (optional)"}</span>
              <input className="input" value={source} maxLength={160} placeholder={w.workstream === "earnest-money" ? "Smith Law, the holder" : "Dana at Peach Mortgage"}
                onChange={(e) => setSource(e.target.value)} /></label>
            <label className="field" style={{ flex: "1 1 140px" }}><span className="label">On</span>
              <input className="input" type="date" value={confirmedOn} max={today()} onChange={(e) => setConfirmedOn(e.target.value)} /></label>
          </div>
          <label className="field" style={{ marginTop: 8 }}><span className="label">{state === "blocked" ? "What is blocking it" : state === "not-applicable" ? "Why it does not apply" : "Note (optional)"}</span>
            <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={busy}
              onClick={() => run("work", { contractId, workstream: w.workstream, expectedSeq: w.seq, state, owner, ownerName, source, confirmedOn: source.trim() || state === "confirmed" ? confirmedOn : "", note })
                .then((ok) => { if (ok) setEditing(false); })}>
              {busy ? "Recording…" : `Record ${w.label.toLowerCase()} update`}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setEditing(false)}>Back</button>
          </div>
        </div>
      ) : (
        <div className="row gap-2" style={{ marginTop: 6 }}>
          <button className="btn btn-g btn-sm" onClick={open}>Update</button>
          {history.length > 1 ? <button className="btn btn-g btn-sm" onClick={() => setShowHistory((v) => !v)}>History</button> : null}
        </div>
      )}
      {showHistory ? (
        <ul className="t-2xs c-3" style={{ marginTop: 6, display: "grid", gap: 3 }}>
          {[...history].reverse().map((u) => (
            <li key={u.seq}>
              {DAY(u.at)} · {WORK_STATE_LABEL[u.state]}{u.source ? `, from ${u.source}` : ""}{u.confirmedOn ? ` on ${DAY(u.confirmedOn)}` : ""}
              {u.note ? `: ${u.note}` : ""} · {u.by}{u.byKind === "client" ? " (buyer)" : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

