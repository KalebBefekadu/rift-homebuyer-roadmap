"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { prepareProgramAlerts, reviewProgramPage } from "./actions";

type Answer = { ok: boolean; text: string };

const UNREACHED = "Rift could not be reached. Nothing was changed. Check the connection and try again.";

function Said({ a }: { a: Answer | null }) {
  if (!a) return null;
  return <p role={a.ok ? "status" : "alert"} className={`t-xs ${a.ok ? "c-pos" : "c-neg"}`}>{a.ok ? "✓" : "✕"} {a.text}</p>;
}

/**
 * The answer to one changed program page. The note is held in state so a
 * review the server refused does not come back with it wiped.
 */
export function ReviewForm({ checkId, agentName }: { checkId: string; agentName: string }) {
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (outcome: "still-right" | "needs-update") => {
    setAnswer(null);
    setActing(outcome);
    start(async () => {
      try { setAnswer(await reviewProgramPage({ checkId, outcome, note })); } catch { setAnswer({ ok: false, text: UNREACHED }); }
    });
  };

  return (
    <div className="col gap-2 mt-3" style={{ paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
      <label className="field">
        <span className="label">Note (optional)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What you checked, or what needs changing" disabled={pending} />
      </label>
      <div className="row gap-2 wrap">
        <button className="btn btn-p btn-sm" type="button" disabled={pending} onClick={() => run("still-right")}>
          <Ico.check size={13} />{pending && acting === "still-right" ? "Recording…" : "The record is still right"}
        </button>
        <button className="btn btn-g btn-sm" type="button" disabled={pending} onClick={() => run("needs-update")}>
          <Ico.alert size={13} />{pending && acting === "needs-update" ? "Recording…" : "It needs updating: stop showing it"}
        </button>
      </div>
      <span className="t-2xs c-4">Recorded as reviewed by {agentName}. &ldquo;Needs updating&rdquo; withholds the program from buyers until its record is edited.</span>
      <Said a={answer} />
    </div>
  );
}

/** Prepare the program-change emails, and say how many were made. */
export function PrepareAlerts({ checkId }: { checkId: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="col gap-1 mt-2">
      <button className="btn btn-g btn-sm" type="button" style={{ alignSelf: "flex-start" }} disabled={pending}
        onClick={() => { setAnswer(null); start(async () => { try { setAnswer(await prepareProgramAlerts({ checkId })); } catch { setAnswer({ ok: false, text: UNREACHED }); } }); }}>
        {pending ? "Preparing…" : "Prepare an email to each, for my approval"}
      </button>
      <Said a={answer} />
    </div>
  );
}
