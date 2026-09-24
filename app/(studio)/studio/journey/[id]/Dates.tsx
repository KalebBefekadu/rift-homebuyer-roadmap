"use client";

import { useState } from "react";
import {
  KIND_LABEL, RULES, RULE_IDS, deadlineError, inDays, resolve, whenText,
  type DeadlineInput, type DeadlineKind, type DeadlineView, type Revision, type RuleId,
} from "@/lib/core/deadline";
import { WORKSTREAMS, WORKSTREAM_LABEL, type Workstream } from "@/lib/core/progress";
import { useWrite } from "./useWrite";

export interface DateView {
  id: string;
  label: string;
  kind: DeadlineKind;
  workstream: Workstream | null;
  revisions: Revision[];
  view: DeadlineView;
}

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const DAY = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * The open contract's dates (W09). Each says where it comes from and whether
 * it has been checked against the document. A date written without a time is
 * shown and counted as a date. A missed one stays until what actually happened
 * is recorded; nothing here says what a missed date means legally.
 */
export function Dates({ journeyId, dates, docs }: {
  journeyId: string;
  dates: DateView[];
  docs: { id: string; label: string }[];
}) {
  const { busy, error, write } = useWrite(dates.map((d) => `${d.id}:${d.view.current.seq}`).join("|"));
  const [req, setReq] = useState(newRequest);
  const [form, setForm] = useState<null | "add" | "amend">(null);
  const [showDone, setShowDone] = useState(false);
  const run = async (op: string, body: Record<string, unknown>) => {
    const r = await write(op, { journeyId, requestId: req, ...body });
    if (r.ok) setReq(newRequest());
    return r.ok;
  };
  const active = dates.filter((d) => d.view.state === "active");
  const finished = dates.filter((d) => d.view.state !== "active");
  const docLabel = new Map(docs.map((d) => [d.id, d.label]));

  return (
    <div style={{ marginTop: 14 }}>
      <div className="between gap-2 wrap">
        <div className="t-sm w6">Contract dates</div>
        <div className="row gap-2">
          <button className="btn btn-s btn-sm" onClick={() => setForm(form === "add" ? null : "add")}>Add a date</button>
          {active.length ? <button className="btn btn-g btn-sm" onClick={() => setForm(form === "amend" ? null : "amend")}>Record an amendment</button> : null}
        </div>
      </div>
      <p className="t-2xs c-4" style={{ marginTop: 2, lineHeight: 1.5 }}>
        Each from the executed documents, with where it comes from. The buyer sees a date only once you have checked it against the document.
      </p>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}

      {form === "add" ? <AddDate docs={docs} busy={busy} onCancel={() => setForm(null)}
        onSave={(body) => run("date-add", body).then((ok) => { if (ok) setForm(null); })} /> : null}
      {form === "amend" ? <Amend dates={active} busy={busy} onCancel={() => setForm(null)}
        onSave={(body) => run("date-amend", body).then((ok) => { if (ok) setForm(null); })} /> : null}

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {active.length === 0 && !form ? <p className="t-xs c-4">No dates recorded for this contract yet.</p> : null}
        {active.map((d) => <DateRow key={d.id} d={d} docLabel={docLabel} busy={busy} run={run} journeyId={journeyId} />)}
      </div>
      {finished.length ? (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-g btn-sm" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : "Show"} met or removed ({finished.length})</button>
          {showDone ? <div style={{ display: "grid", gap: 6, marginTop: 6 }}>{finished.map((d) => <DateRow key={d.id} d={d} docLabel={docLabel} busy={busy} run={run} journeyId={journeyId} />)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function DateRow({ d, docLabel, busy, run, journeyId }: {
  d: DateView;
  docLabel: Map<string, string>;
  busy: boolean;
  run: (op: string, body: Record<string, unknown>) => Promise<boolean>;
  journeyId: string;
}) {
  const [form, setForm] = useState<null | "met" | "removed" | "correct">(null);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState(false);
  const v = d.view;
  const c = v.current;
  const seq = c.seq;
  const chip = v.state === "met" ? "Met" : v.state === "removed" ? "No longer applies" : v.missed ? "Passed, not recorded as met" : v.timing === "due-today" ? "Due today" : inDays(v.days!);
  const revise = (body: Record<string, unknown>) => run("date-revise", { deadlineId: d.id, expectedSeq: seq, ...body }).then((ok) => { if (ok) { setForm(null); setNote(""); } });

  return (
    <div className="card p-3">
      <div className="between gap-2 wrap">
        <div className="row gap-2 wrap">
          <span className="t-sm w6">{d.label}</span>
          <span className={`chip t-2xs ${v.missed ? "chip-neg" : v.timing === "due-today" ? "chip-warn" : v.state === "met" ? "chip-pos" : ""}`}>{chip}</span>
          {!c.verified && v.state === "active" ? <span className="chip t-2xs chip-warn">Not checked</span> : null}
        </div>
        <span className="t-2xs c-4">{KIND_LABEL[d.kind]}{d.workstream ? ` · ${WORKSTREAM_LABEL[d.workstream]}` : ""}</span>
      </div>
      <p className="t-xs" style={{ marginTop: 4 }}>{v.when}</p>
      <p className="t-2xs c-4" style={{ marginTop: 2, lineHeight: 1.5 }}>
        {c.rule === "as-written" ? "As written" : `${c.days} ${c.rule === "calendar-days-v1" ? "calendar" : "business"} days after ${c.triggerLabel} (${DAY(c.triggerDate!)})`}
        {" · "}{c.sourceTerm}{c.sourcePage ? `, page ${c.sourcePage}` : ""}
        {c.sourceDocumentId ? <> · <a className="u" href={`/api/studio/document?journeyId=${journeyId}&id=${c.sourceDocumentId}`} target="_blank" rel="noreferrer">{docLabel.get(c.sourceDocumentId) ?? "the document"}</a></> : null}
        {c.amendment && c.amendment !== c.sourceTerm ? ` · from ${c.amendment}` : ""}
        {c.note ? ` · ${c.note}` : ""}
      </p>
      {v.missed ? (
        <p className="t-2xs c-neg" style={{ marginTop: 4, lineHeight: 1.5 }}>
          This date has passed and is not recorded as met. Rift does not decide what that means. Record what actually happened: met, changed by an amendment, or no longer applying.
        </p>
      ) : null}
      {v.state === "active" ? (
        form ? (
          form === "correct" ? (
            <DateForm start={c} docs={[...docLabel].map(([id, label]) => ({ id, label }))} busy={busy} submitLabel="Save the correction"
              onCancel={() => setForm(null)} onSave={(input) => revise({ to: "active", input })} />
          ) : (
            <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
              <input className="input" style={{ flex: "1 1 240px" }} value={note} maxLength={500} aria-label="How"
                placeholder={form === "met" ? "Inspection response delivered Oct 2" : "Financing contingency removed by the buyer's notice"}
                onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-p btn-sm" disabled={busy || note.trim().length < 3} onClick={() => revise({ to: form, note })}>{busy ? "Recording…" : "Record it"}</button>
              <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
            </div>
          )
        ) : (
          <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
            {!c.verified ? <button className="btn btn-s btn-sm" disabled={busy} onClick={() => revise({ to: "checked" })}>Checked against the document</button> : null}
            <button className="btn btn-g btn-sm" onClick={() => { setNote(""); setForm("met"); }}>Met</button>
            <button className="btn btn-g btn-sm" onClick={() => { setNote(""); setForm("removed"); }}>No longer applies</button>
            <button className="btn btn-g btn-sm" onClick={() => setForm("correct")}>Correct it</button>
            {d.revisions.length > 1 ? <button className="btn btn-g btn-sm" onClick={() => setHistory((x) => !x)}>History</button> : null}
          </div>
        )
      ) : d.revisions.length > 1 ? <button className="btn btn-g btn-sm" style={{ marginTop: 6 }} onClick={() => setHistory((x) => !x)}>History</button> : null}
      {history ? (
        <ul className="t-2xs c-3" style={{ marginTop: 6, display: "grid", gap: 3 }}>
          {[...d.revisions].reverse().map((r) => (
            <li key={r.seq}>{DAY(r.at)} · {r.state === "active" ? whenText(r) : r.state === "met" ? "Met" : "No longer applies"}{r.verified ? ", checked" : ", not checked"}{r.amendment ? `, ${r.amendment}` : ""}{r.note ? `: ${r.note}` : ""} · {r.by}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AddDate({ docs, busy, onSave, onCancel }: {
  docs: { id: string; label: string }[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<DeadlineKind>("contractual");
  const [workstream, setWorkstream] = useState<Workstream | "">("");
  return (
    <div className="card p-3" style={{ marginTop: 8, background: "var(--sunk)" }}>
      <div className="row gap-2 wrap">
        <label className="field" style={{ flex: "2 1 220px" }}><span className="label">What is due</span>
          <input className="input" value={label} maxLength={120} placeholder="Due diligence period ends" onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="field" style={{ flex: "1 1 150px" }}><span className="label">Whose date</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as DeadlineKind)}>
            <option value="contractual">{KIND_LABEL.contractual}</option>
            <option value="target">{KIND_LABEL.target}</option>
          </select></label>
        <label className="field" style={{ flex: "1 1 150px" }}><span className="label">Part of (optional)</span>
          <select className="input" value={workstream} onChange={(e) => setWorkstream(e.target.value as Workstream | "")}>
            <option value="">Nothing in particular</option>
            {WORKSTREAMS.map((w) => <option key={w} value={w}>{WORKSTREAM_LABEL[w]}</option>)}
          </select></label>
      </div>
      <DateForm start={null} docs={docs} busy={busy} submitLabel="Add the date" disabled={label.trim().length < 3}
        onCancel={onCancel} onSave={(input) => onSave({ label, kind, workstream: workstream || null, input })} />
    </div>
  );
}

/** The date itself: as written, or counted by a named rule. The result is shown before it is saved. */
function DateForm({ start, docs, busy, submitLabel, onSave, onCancel, disabled }: {
  start: Revision | null;
  docs: { id: string; label: string }[];
  busy: boolean;
  submitLabel: string;
  onSave: (input: DeadlineInput) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [rule, setRule] = useState<RuleId>(start?.rule ?? "as-written");
  const [date, setDate] = useState(start?.rule === "as-written" ? start.dueDate : "");
  const [time, setTime] = useState(start?.dueTime ?? "");
  const [triggerLabel, setTriggerLabel] = useState(start?.triggerLabel ?? "Binding agreement date");
  const [triggerDate, setTriggerDate] = useState(start?.triggerDate ?? "");
  const [days, setDays] = useState(start?.days ? String(start.days) : "");
  const [sourceTerm, setSourceTerm] = useState(start?.sourceTerm ?? "");
  const [sourcePage, setSourcePage] = useState(start?.sourcePage ?? "");
  const [doc, setDoc] = useState(start?.sourceDocumentId ?? "");
  const [verified, setVerified] = useState(false);
  const input: DeadlineInput = {
    rule, date: rule === "as-written" ? date : null, time: time || null, timezone: "America/New_York",
    triggerLabel: rule === "as-written" ? null : triggerLabel, triggerDate: rule === "as-written" ? null : triggerDate,
    days: rule === "as-written" ? null : Number(days), sourceTerm, sourcePage: sourcePage || null, sourceDocumentId: doc || null, verified,
  };
  const bad = deadlineError(input);
  const r = bad ? null : resolve(input);

  return (
    <div style={{ marginTop: 8 }}>
      <label className="field"><span className="label">How the date is reached</span>
        <select className="input" value={rule} onChange={(e) => setRule(e.target.value as RuleId)}>
          {RULE_IDS.map((id) => <option key={id} value={id}>{RULES[id].label}</option>)}
        </select></label>
      <p className="t-2xs c-4" style={{ marginTop: 2, lineHeight: 1.5 }}>{RULES[rule].explain}</p>
      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
        {rule === "as-written" ? (
          <label className="field" style={{ flex: "0 1 170px" }}><span className="label">Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        ) : (
          <>
            <label className="field" style={{ flex: "0 1 90px" }}><span className="label">Days</span>
              <input className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} /></label>
            <label className="field" style={{ flex: "2 1 200px" }}><span className="label">Counted from</span>
              <input className="input" value={triggerLabel} maxLength={120} onChange={(e) => setTriggerLabel(e.target.value)} /></label>
            <label className="field" style={{ flex: "0 1 170px" }}><span className="label">Which was on</span>
              <input className="input" type="date" value={triggerDate} onChange={(e) => setTriggerDate(e.target.value)} /></label>
          </>
        )}
        <label className="field" style={{ flex: "0 1 150px" }}><span className="label">Time, only if stated</span>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
        <label className="field" style={{ flex: "2 1 220px" }}><span className="label">Where it comes from</span>
          <input className="input" value={sourceTerm} maxLength={200} placeholder="Purchase agreement, paragraph 12" onChange={(e) => setSourceTerm(e.target.value)} /></label>
        <label className="field" style={{ flex: "0 1 90px" }}><span className="label">Page</span>
          <input className="input" value={sourcePage} maxLength={40} onChange={(e) => setSourcePage(e.target.value)} /></label>
        {docs.length ? (
          <label className="field" style={{ flex: "1 1 180px" }}><span className="label">Document (optional)</span>
            <select className="input" value={doc} onChange={(e) => setDoc(e.target.value)}>
              <option value="">None</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select></label>
        ) : null}
      </div>
      <label className="row gap-1 t-xs" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> I checked this against the executed document
      </label>
      <p className={`t-xs ${r ? "" : "c-4"}`} style={{ marginTop: 6 }} aria-live="polite">
        {r ? <>Due <span className="w6">{whenText(r)}</span>{!r.dueTime ? ". No time is stated, so none is assumed." : "."}{!verified ? " Not checked yet: the buyer will not see it." : ""}</> : bad}
      </p>
      <div className="row gap-2" style={{ marginTop: 8 }}>
        <button className="btn btn-p btn-sm" disabled={busy || !r || disabled} onClick={() => onSave(input)}>{busy ? "Saving…" : submitLabel}</button>
        <button className="btn btn-g btn-sm" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

/** One amendment, many dates, one save: they land together or not at all (AT27). */
function Amend({ dates, busy, onSave, onCancel }: {
  dates: DateView[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [reference, setReference] = useState("");
  const [picked, setPicked] = useState<Record<string, { remove: boolean; date: string; time: string }>>({});
  const [checked, setChecked] = useState(false);
  const changes = Object.entries(picked).map(([id, p]) => {
    const d = dates.find((x) => x.id === id)!;
    return {
      deadlineId: id, remove: p.remove, expectedSeq: d.view.current.seq,
      input: p.remove ? null : { rule: "as-written", date: p.date, time: p.time || null, timezone: "America/New_York", sourceTerm: reference, verified: true },
    };
  });
  const ready = reference.trim().length >= 3 && changes.length > 0 && checked && changes.every((c) => c.remove || /^\d{4}-\d{2}-\d{2}$/.test(c.input!.date));

  return (
    <div className="card p-3" style={{ marginTop: 8, background: "var(--sunk)" }}>
      <label className="field"><span className="label">Amendment</span>
        <input className="input" value={reference} maxLength={200} placeholder="Amendment 1, executed Oct 2" onChange={(e) => setReference(e.target.value)} /></label>
      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {dates.map((d) => {
          const p = picked[d.id];
          return (
            <div key={d.id} className="t-xs">
              <label className="row gap-1">
                <input type="checkbox" checked={!!p} onChange={(e) => {
                  const next = { ...picked };
                  /* The time starts as it is now: an amendment that changes only the date may leave the time
                     standing, and clearing it should be a decision, not a blank field nobody noticed. */
                  if (e.target.checked) next[d.id] = { remove: false, date: "", time: d.view.current.dueTime ?? "" }; else delete next[d.id];
                  setPicked(next);
                }} />
                <span className="w6">{d.label}</span> <span className="c-4">now {d.view.when}</span>
              </label>
              {p ? (
                <div className="row gap-2 wrap" style={{ marginTop: 4, marginLeft: 20 }}>
                  <select className="input" aria-label={`What the amendment does to ${d.label}`} value={p.remove ? "remove" : "move"}
                    onChange={(e) => setPicked({ ...picked, [d.id]: { ...p, remove: e.target.value === "remove" } })}>
                    <option value="move">Moves it to</option>
                    <option value="remove">Removes it</option>
                  </select>
                  {!p.remove ? (
                    <>
                      <input className="input" type="date" aria-label={`New date for ${d.label}`} value={p.date} onChange={(e) => setPicked({ ...picked, [d.id]: { ...p, date: e.target.value } })} />
                      <input className="input" type="time" aria-label={`New time for ${d.label}, only if stated`} value={p.time} onChange={(e) => setPicked({ ...picked, [d.id]: { ...p, time: e.target.value } })} />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <label className="row gap-1 t-xs" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I checked these against the executed amendment
      </label>
      <div className="row gap-2" style={{ marginTop: 8 }}>
        <button className="btn btn-p btn-sm" disabled={busy || !ready} onClick={() => onSave({ reference, changes })}>
          {busy ? "Saving…" : `Record the amendment (${changes.length} date${changes.length === 1 ? "" : "s"})`}
        </button>
        <button className="btn btn-g btn-sm" onClick={onCancel}>Back</button>
      </div>
      <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>All of these change together, or none does. Reminders follow the new dates; there are none left for the old ones.</p>
    </div>
  );
}
