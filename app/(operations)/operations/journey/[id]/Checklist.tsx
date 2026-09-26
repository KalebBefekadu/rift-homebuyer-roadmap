"use client";

import { useEffect, useRef, useState } from "react";
import { Ico } from "@/components/rift/icons";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/core/progress";
import { STEP_STATE_LABEL, isOpen, markError, type MarkState, type StepState, type StepView } from "@/lib/core/checklist";
import { useWrite } from "./useWrite";

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

/* Rule 10: every state has an icon and a word. */
const STATE_ICON: Record<StepState, keyof typeof Ico> = {
  todo: "minus", doing: "clock", waiting: "pause", reported: "info", blocked: "alert",
  done: "checkCircle", skip: "x", "not-recorded": "minus",
};
const STATE_TONE: Record<StepState, string> = {
  todo: "c-4", doing: "c-2", waiting: "c-warn", reported: "c-warn", blocked: "c-neg",
  done: "c-pos", skip: "c-4", "not-recorded": "c-4",
};
const DOER: Record<StepView["doer"], { icon: keyof typeof Ico; label: (v: StepView) => string }> = {
  rift: { icon: "bolt", label: (v) => (v.step.mode === "auto" ? "Rift, on its own" : "Rift prepares, you approve") },
  you: { icon: "pin", label: () => "You" },
  tc: { icon: "layers", label: () => "Coordinator" },
  client: { icon: "home", label: () => "The client" },
  pro: { icon: "shield", label: (v) => v.step.pro ?? "A professional" },
};
/** Rift's steps that really run are nobody's to tick, so they are not counted as open. */
const countable = (x: StepView) => !(x.doer === "rift" && x.step.live);

/** A passed stage: what is still open, apart from what was simply never recorded. */
function passedSub(all: StepView[]) {
  const inStage = all.filter(countable);
  const unrecorded = inStage.filter((x) => x.state === "not-recorded").length;
  const open = inStage.filter((x) => isOpen(x.state) && x.state !== "not-recorded").length;
  if (open) return `${open} open`;
  if (unrecorded) return `${unrecorded} not recorded`;
  return "All recorded";
}
const DAY = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * The journey's checklist (Blueprint v5 §8.6; lib/core/checklist.ts): the
 * stage track, and the chosen stage's steps, each saying who does it and
 * where it stands. Ticking a step asks who did it, or who confirmed it, and
 * the day (rule 9). A workstream step is updated under Where it stands, so
 * one deal is changed in one place.
 */
export function Checklist({ journeyId, stage, steps, unavailable, today, agentFirst }: {
  journeyId: string;
  stage: Stage;
  steps: StepView[];
  unavailable: string | null;
  today: string;
  agentFirst: string;
}) {
  const { busy, error, write } = useWrite(steps.map((s) => `${s.step.id}:${s.history.length}:${s.state}`).join("|"));
  const [picked, setPicked] = useState<Stage>(stage);
  const [req, setReq] = useState(newRequest);
  const now = STAGES.indexOf(stage);
  /* On a phone the track scrolls sideways; the stage they are in starts in view. */
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(".is-now");
    const box = track.current;
    if (el && box) box.scrollLeft = el.offsetLeft - box.offsetLeft - 16;
  }, []);
  const list = steps.filter((s) => s.step.stage === picked);
  const counted = list.filter(countable);
  const done = counted.filter((s) => !isOpen(s.state)).length;
  const run = async (stepId: string, expectedSeq: number, body: Record<string, unknown>) => {
    const r = await write("step", { journeyId, stepId, expectedSeq, requestId: req, ...body });
    if (r.ok) setReq(newRequest());
    return r.ok;
  };

  return (
    <div>
      <div ref={track} className="ck-track" role="tablist" aria-label="Stages">
        {STAGES.map((s, i) => {
          const inStage = steps.filter((x) => x.step.stage === s);
          const open = inStage.filter((x) => countable(x) && isOpen(x.state)).length;
          const where = i < now ? "done" : i === now ? "now" : "next";
          return (
            <button key={s} role="tab" aria-selected={picked === s} className={`ck-stage is-${where}`} onClick={() => setPicked(s)}>
              <span className="ck-stage-name">{where === "done" ? <Ico.check size={10} aria-hidden /> : null}{STAGE_LABEL[s]}</span>
              <span className="ck-stage-sub">{where === "now" ? `Now · ${open} open` : where === "next" ? `${inStage.length} steps` : passedSub(inStage)}</span>
            </button>
          );
        })}
      </div>

      <div className="between wrap gap-2" style={{ marginTop: 10 }}>
        <div className="t-sm w6">{STAGE_LABEL[picked]}: {done} of {counted.length} done or not needed</div>
        {STAGES.indexOf(picked) < now && list.some((s) => s.state === "not-recorded")
          ? <span className="t-2xs c-4">A step nobody recorded is not assumed done.</span> : null}
      </div>
      {unavailable ? <p className="t-xs c-warn" style={{ marginTop: 6 }}>{unavailable}</p> : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}

      <ol className="ck-list">
        {list.map((v) => (
          <StepRow key={v.step.id} v={v} busy={busy} locked={Boolean(unavailable)} today={today} agentFirst={agentFirst}
            run={(body) => run(v.step.id, v.history.length ? v.history[v.history.length - 1].seq : 0, body)} />
        ))}
      </ol>
    </div>
  );
}

function StepRow({ v, busy, locked, today, agentFirst, run }: {
  v: StepView; busy: boolean; locked: boolean; today: string; agentFirst: string;
  run: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [form, setForm] = useState<null | MarkState>(null);
  const [byName, setByName] = useState("");
  const [doneOn, setDoneOn] = useState(today);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const Icon = Ico[STATE_ICON[v.state]];
  const D = DOER[v.doer];
  const DoerIcon = Ico[D.icon];
  const recorded = v.history.length > 0 && !v.fromWorkstream && ["done", "reported", "skip"].includes(v.state);
  const canMark = !v.fromWorkstream && !locked && isOpen(v.state);

  const open = (state: MarkState) => {
    setForm(state);
    setMore(false);
    setProblem(null);
    setNote("");
    setDoneOn(today);
    /* Whoever does it, when that is the agent; someone who confirms it is typed. */
    setByName(state === "done" && !v.step.confirms && (v.doer === "you" || v.doer === "rift") ? agentFirst : "");
  };
  const save = async () => {
    const input = { state: form!, byName, doneOn: form === "done" ? doneOn : null, note };
    const bad = markError(v.step, v.state, input);
    if (bad) { setProblem(bad); return; }
    if (await run(input)) setForm(null);
  };

  return (
    <li className={`ck-step is-${v.state}`}>
      <span className={`ck-mark ${STATE_TONE[v.state]}`} title={STEP_STATE_LABEL[v.state]}><Icon size={15} aria-hidden /></span>
      <div className="ck-body">
        <span className="ck-title">
          {v.step.title}
          {v.step.protected ? <span className="c-3" title="Always yours, whatever is automated"><Ico.lock size={10} aria-hidden /><span className="sr-only"> (always yours)</span></span> : null}
        </span>
        <span className="t-xs">
          <span className={STATE_TONE[v.state]}>{STEP_STATE_LABEL[v.state]}</span>
          {v.by ? <span className="c-3"> · {v.by}{v.on ? `, ${DAY(v.on)}` : ""}</span> : null}
          {v.note ? <span className="c-4"> · {v.note}</span> : null}
        </span>
        {more && !form ? (
          <span className="row gap-3 wrap t-xs" style={{ marginTop: 4 }}>
            {v.step.confirms && v.state !== "reported" ? <button className="ck-link" onClick={() => open("reported")}>Someone says it is done, not confirmed yet</button> : null}
            <button className="ck-link" onClick={() => open("not-needed")}>Not needed here</button>
          </span>
        ) : null}
        {form ? (
          <div className="ck-form">
            {form === "done" || form === "reported" ? (
              <label className="t-xs">{form === "reported" ? "Who says it is done" : v.step.confirms ? `Who confirmed it (${v.step.confirms})` : "Who did it"}
                <input className="input ck-input" value={byName} onChange={(e) => setByName(e.target.value)} maxLength={160}
                  placeholder={v.step.confirms ? `Name, ${v.step.confirms.toLowerCase()}` : "Name"} />
              </label>
            ) : null}
            {form === "done" ? (
              <label className="t-xs">The day it happened
                <input className="input ck-input" type="date" value={doneOn} max={today} onChange={(e) => setDoneOn(e.target.value)} />
              </label>
            ) : null}
            {form === "not-needed" || form === "reopened" ? (
              <label className="t-xs">{form === "reopened" ? "Why it is open again" : "Why it does not apply"}
                <input className="input ck-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </label>
            ) : null}
            {problem ? <p role="alert" className="t-xs c-neg">{problem}</p> : null}
            <span className="row gap-2">
              <button className="btn btn-p btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
              <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Cancel</button>
            </span>
          </div>
        ) : null}
      </div>
      <span className={`ck-doer ck-doer-${v.doer}`} title={v.doerNote ?? undefined}>
        <DoerIcon size={11} aria-hidden />{`${D.label(v)}${v.doerNote ? `, ${v.doerNote}` : ""}`}
      </span>
      <span className="ck-act">
        {v.fromWorkstream ? (
          isOpen(v.state) ? <a href="#progress-h" className="ck-link" title="This one follows its workstream, updated under Where it stands">Update above</a> : null
        ) : form || (v.doer === "rift" && v.step.live) ? null : canMark ? (
          <>
            <button className="btn btn-s btn-sm" disabled={busy} onClick={() => open("done")}>Mark done</button>
            {/* One button, the rest one press away (§4.8). */}
            <button className="btn btn-g btn-sm" aria-expanded={more} aria-label={`More for: ${v.step.title}`} onClick={() => setMore((m) => !m)}><Ico.more size={14} aria-hidden /></button>
          </>
        ) : recorded && !locked ? (
          <button className="btn btn-g btn-sm" disabled={busy} onClick={() => open("reopened")}>Reopen</button>
        ) : null}
      </span>
    </li>
  );
}
