"use client";

import { useState, useTransition } from "react";
import { STALL_CHIP, type ManagedLead, type NoteKind, type Stage } from "@/lib/core/pipeline";
import { stagesFor, dueView, isTerminal } from "@/lib/core/people";
import { Ico } from "@/components/rift/icons";
import { Section, Notice } from "../../ui";
import { logContact, moveStage, archive, restore, planNextAction } from "./actions";
import { georgiaDay, daysBetween } from "@/lib/core/day";
import css from "./record.module.css";

const KINDS: { id: NoteKind; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "text", label: "Text" },
  { id: "email", label: "Email" },
  { id: "meeting", label: "Met" },
  { id: "note", label: "Note" },
];

/**
 * The two things the agent does on this page while somebody is waiting: say
 * where they are and what is owed next, and write down what just happened.
 * Everything else on the record is reference or slower work.
 */
export function Actions({ lead }: { lead: ManagedLead }) {
  return (
    <div className={css.top}>
      <StatusAndNext lead={lead} />
      <LogNote lead={lead} />
    </div>
  );
}

function StatusAndNext({ lead }: { lead: ManagedLead }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [action, setAction] = useState("");
  const [due, setDue] = useState("");
  const [pick, setPick] = useState<Stage | null>(null);
  const archived = Boolean(lead.archivedAt);

  /* Only the stages that exist on this side. A person already in one that does
     not (an old record, a move made before this was enforced) keeps it listed
     rather than the select silently showing something else. */
  const options = stagesFor(lead.side);
  const list: string[] = lead.stage && !options.includes(lead.stage) ? [lead.stage, ...options] : options;
  const inStage = lead.stageSince ? Math.max(0, daysBetween(georgiaDay(new Date(lead.stageSince)), georgiaDay())) : null;

  const move = () => {
    if (!pick) return;
    setError(null);
    start(async () => {
      const r = await moveStage(lead.id, pick);
      if (!r.ok) { setError(r.error); return; }
      setPick(null);
    });
  };

  const save = () => {
    if (!action.trim() || !due) return;
    setError(null);
    start(async () => {
      const r = await planNextAction(lead.id, action, due);
      if (!r.ok) { setError(r.error); return; }
      setAction(""); setDue(""); setChanging(false);
    });
  };

  const done = () => {
    setError(null);
    start(async () => {
      const r = await planNextAction(lead.id, null, null, `Done: ${lead.nextAction}`);
      if (!r.ok) setError(r.error);
    });
  };

  const view = lead.nextAction && lead.nextDue ? dueView(lead.nextDue) : null;
  const editing = changing || !lead.nextAction;

  return (
    <Section title="Status and next step">
      <div className="card p-4">
        <div className={css.lead}>
          <div>
            <div className={css.label}>Stage</div>
            <div className={css.stageRow} style={{ marginTop: 6 }}>
              <select className="input select" aria-label="Move them to a stage" disabled={pending || archived}
                value={pick ?? lead.stage ?? ""} onChange={(e) => setPick(e.target.value === lead.stage ? null : (e.target.value as Stage))}>
                {!lead.stage ? <option value="" disabled>Not picked up yet</option> : null}
                {list.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {pick ? (
                <>
                  <button className="btn btn-p btn-sm" disabled={pending} onClick={move}>{pending ? "Moving…" : `Move to ${pick}`}</button>
                  <button className="btn btn-g btn-sm" disabled={pending} onClick={() => setPick(null)}>Cancel</button>
                </>
              ) : inStage !== null ? (
                <span className={css.since}>{inStage === 0 ? "Moved today" : `${inStage} day${inStage === 1 ? "" : "s"} in this stage`}</span>
              ) : null}
            </div>
            {pick && isTerminal(pick) ? (
              <p className={css.hint} style={{ marginTop: 6 }}>
                {pick === "Closed" ? "Closed" : "Lost"} ends their time on the board and counts toward your own closing history.
                Moving them back later is possible and is written to the history.
              </p>
            ) : null}
            {lead.stall && lead.stall.level !== "moving" ? (
              <div style={{ marginTop: 10 }}>
                <span className={`chip ${STALL_CHIP[lead.stall.level].c}`}><Ico.alert size={11} />{STALL_CHIP[lead.stall.level].l}</span>
                <p className={css.stall} style={{ marginTop: 6 }}>{lead.stall.reason} <b>{lead.stall.unstick}</b></p>
              </div>
            ) : null}
          </div>

          <div className={css.sep} />

          <div>
            <div className={css.label}>Next step</div>
            {lead.nextAction && !changing ? (
              <div className={css.form} style={{ marginTop: 6 }}>
                <div className={css.action}>{lead.nextAction}</div>
                {view ? (
                  <span className={`${css.due} ${css[view.state]}`}>
                    {view.state === "overdue" ? <Ico.alert size={13} /> : <Ico.cal size={13} />}{view.label}
                  </span>
                ) : null}
                <div className={css.row}>
                  <button className="btn btn-p btn-sm" disabled={pending || archived} onClick={done}><Ico.check size={13} />{pending ? "Saving…" : "Done"}</button>
                  <button className="btn btn-s btn-sm" disabled={pending || archived} onClick={() => { setChanging(true); setAction(lead.nextAction ?? ""); setDue(lead.nextDue ?? ""); }}>Change</button>
                </div>
              </div>
            ) : editing ? (
              <div className={css.form} style={{ marginTop: 6 }}>
                {!lead.nextAction ? (
                  <p className={css.hint}>
                    Nothing is scheduled. One thing at a time: a queue of six things owed to the same person is a queue nobody works.
                  </p>
                ) : null}
                <input className="input" aria-label="The next thing to do" placeholder="Call about the Oakhurst listing"
                  value={action} onChange={(e) => setAction(e.target.value)} disabled={pending || archived} maxLength={200} />
                <input className="input" type="date" aria-label="When it is due" value={due} onChange={(e) => setDue(e.target.value)} disabled={pending || archived} />
                <div className={css.row}>
                  <button className="btn btn-p btn-sm" disabled={pending || !action.trim() || !due || archived} onClick={save}>
                    {pending ? "Saving…" : lead.nextAction ? "Save the change" : "Schedule it"}
                  </button>
                  {changing ? <button className="btn btn-g btn-sm" disabled={pending} onClick={() => setChanging(false)}>Cancel</button> : null}
                </div>
                {!action.trim() || !due ? <p className={css.hint}>A step needs both words and a day: one without the other is a wish.</p> : null}
              </div>
            ) : null}
          </div>

          {error ? <div className={css.err}><Notice tone="neg" title="That did not save.">{error}</Notice></div> : null}
        </div>
      </div>
    </Section>
  );
}

function LogNote({ lead }: { lead: ManagedLead }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<NoteKind>("call");
  const [error, setError] = useState<string | null>(null);
  const archived = Boolean(lead.archivedAt);

  const save = () => {
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const r = await logContact(lead.id, kind, body);
      if (!r.ok) { setError(r.error); return; }
      setBody("");
    });
  };

  return (
    <Section title="Record what happened">
      <div className="card p-4">
        <div className={css.form}>
          <div className={css.kinds} role="group" aria-label="What kind of contact">
            {KINDS.map((k) => (
              <button key={k.id} className={`btn btn-sm ${kind === k.id ? "btn-p" : "btn-s"}`} aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)} disabled={pending}>
                {kind === k.id ? <Ico.check size={12} /> : null}{k.label}
              </button>
            ))}
          </div>
          <textarea className="input" rows={4} aria-label="What happened" style={{ resize: "vertical", lineHeight: 1.55, height: "auto" }}
            placeholder="Pre-approved to 340. Wants Decatur, needs to be in before the school year. Wife is the decider."
            value={body} onChange={(e) => setBody(e.target.value)} disabled={pending || archived} />
          <div className={css.row}>
            <button className="btn btn-p btn-sm" disabled={pending || !body.trim() || archived} onClick={save}>{pending ? "Saving…" : "Save it"}</button>
          </div>
          {archived ? <p className={css.hint}>Restore them from the archive to record anything new.</p> : null}
          {error ? <Notice tone="neg" title="That did not save.">{error}</Notice> : null}
          <p className={css.hint}>
            Notes cannot be edited or deleted afterwards. The point of a record is that it says what was true at the time.
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Setting somebody aside, and bringing them back. Nothing is ever deleted. */
export function ArchiveBox({ lead }: { lead: ManagedLead }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "that did not work"); return; }
      after?.();
    });
  };

  if (lead.archivedAt) {
    return (
      <div className={css.form}>
        <button className="btn btn-s btn-sm" disabled={pending} onClick={() => run(() => restore(lead.id))}>
          <Ico.refresh size={13} />{pending ? "Restoring…" : "Restore from the archive"}
        </button>
        {error ? <Notice tone="neg" title="That did not save.">{error}</Notice> : null}
      </div>
    );
  }

  return open ? (
    <div className="card p-4">
      <div className="t-sm w6">Why are you archiving them?</div>
      <div className={css.form} style={{ marginTop: 8 }}>
        <input className="input" placeholder="Bought with another agent" aria-label="Why you are archiving them" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <div className={css.row}>
          <button className="btn btn-p btn-sm" disabled={pending || !reason.trim()} onClick={() => run(() => archive(lead.id, reason), () => { setOpen(false); setReason(""); })}>Archive</button>
          <button className="btn btn-g btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        </div>
        {error ? <Notice tone="neg" title="That did not save.">{error}</Notice> : null}
        <p className={css.hint}>Archiving takes them off the board. Nothing is deleted, the record stays, and you can restore them.</p>
      </div>
    </div>
  ) : (
    <button className="btn btn-g btn-sm" onClick={() => setOpen(true)}>Archive this record</button>
  );
}
