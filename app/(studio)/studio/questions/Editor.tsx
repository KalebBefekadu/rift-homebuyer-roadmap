"use client";

import { useState, useTransition, useMemo } from "react";
import { Ico } from "@/components/rift/icons";
import { applyWording, wordingChanges, type Funnel, type Wording } from "@/lib/core/funnel";
import { publishQuestions } from "../actions";

/**
 * Editing the words, and nothing else.
 *
 * There is no control here for a question's key, its type, what it feeds,
 * whether it is required, or the machine value behind an option — not because
 * they are hidden, but because the server rebuilds every question from
 * `lib/core/funnel.ts` and applies only the words on top. Sending one would
 * achieve nothing. That is worth stating in the interface rather than leaving
 * as a silent property: each row says what the question feeds, so the agent
 * can see why the wording is his and the rest is not.
 *
 * The diff before publishing is the important part. A form that saves silently
 * makes it possible to change the first question a stranger ever reads without
 * having looked at the change — and the old and new words side by side is the
 * only way to notice that "What have you saved?" became something that reads
 * like an accusation.
 */
export function Editor({ side, funnel, stored }: {
  side: "buy" | "sell";
  funnel: Funnel;
  stored: Record<string, Wording>;
}) {
  const [draft, setDraft] = useState<Record<string, Wording>>(stored);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  /* Against the code's own definition, so the list is "what a visitor will
     read that is different from what shipped" rather than a diff against the
     last save — which would call a published change no change at all. */
  const changes = useMemo(() => wordingChanges(funnel, draft), [funnel, draft]);
  const preview = useMemo(() => applyWording(funnel, draft), [funnel, draft]);

  const set = (id: string, patch: Wording) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const publish = () => {
    setError("");
    start(async () => {
      const r = await publishQuestions(side, draft, note);
      if (!r.ok) { setError(r.error); setState("error"); return; }
      setState("done");
      setNote("");
    });
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div className="col gap-3">
        {funnel.questions.map((q, i) => {
          const now = preview.questions[i]!;
          return (
            <div key={q.id} className="card p-4">
              <div className="between wrap gap-2" style={{ alignItems: "baseline" }}>
                <span className="kicker c-4">{q.topic}</span>
                <span className="t-2xs c-4">
                  {/* Said plainly. The agent is entitled to know why he can
                      rename this and not remove it. */}
                  {q.bound
                    ? <>Feeds <code>{q.bound}</code> · wording only</>
                    : <>Asks only — feeds no figure</>}
                </span>
              </div>

              <label className="t-2xs c-4" style={{ display: "block", marginTop: 10 }}>The question</label>
              <input
                className="input"
                style={{ width: "100%", marginTop: 4 }}
                value={now.title}
                onChange={(e) => set(q.id, { title: e.target.value })}
              />

              <label className="t-2xs c-4" style={{ display: "block", marginTop: 10 }}>
                The note underneath {q.description ? "" : "(optional)"}
              </label>
              <input
                className="input"
                style={{ width: "100%", marginTop: 4 }}
                value={now.description ?? ""}
                placeholder="People answer honestly far more often when they know why."
                onChange={(e) => set(q.id, { description: e.target.value })}
              />

              {q.options?.length ? (
                <>
                  <div className="t-2xs c-4" style={{ marginTop: 12 }}>
                    The answers — you can rename them, and what each one means stays put
                  </div>
                  <div className="col gap-2" style={{ marginTop: 6 }}>
                    {q.options.map((o, n) => (
                      <div key={o.value} className="row gap-2">
                        <input
                          className="input grow"
                          value={now.options?.[n]?.label ?? o.label}
                          onChange={(e) =>
                            set(q.id, {
                              optionLabels: { ...(draft[q.id]?.optionLabels ?? {}), [o.value]: e.target.value },
                            })}
                        />
                        <code className="t-2xs c-4" style={{ flex: "none", alignSelf: "center" }}>{o.value}</code>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card p-4" style={{ marginTop: 20 }}>
        <div className="t-sm w6">
          {changes.length
            ? `${changes.length} change${changes.length === 1 ? "" : "s"} against the words we shipped`
            : "No changes yet"}
        </div>

        {changes.length ? (
          <ul className="t-xs c-3" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.7 }}>
            {changes.map((c) => <li key={c}>{c}</li>)}
          </ul>
        ) : (
          <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Edit any question above. You will see exactly what a visitor would read differently
            before anything is published.
          </p>
        )}

        <label className="t-2xs c-4" style={{ display: "block", marginTop: 14 }}>
          Why, for your own record
        </label>
        <input
          className="input"
          style={{ width: "100%", marginTop: 4 }}
          value={note}
          placeholder="People kept stopping on the savings question"
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="row gap-2 wrap" style={{ marginTop: 14 }}>
          <button className="btn btn-p" onClick={publish} disabled={pending || changes.length === 0}>
            {pending ? "Publishing…" : "Publish as a new version"}
          </button>
          {changes.length ? (
            <button className="btn btn-g" disabled={pending} onClick={() => { setDraft({}); setState("idle"); }}>
              Back to the words we shipped
            </button>
          ) : null}
        </div>

        {state === "done" ? (
          <p className="t-xs c-pos row-t gap-2" style={{ marginTop: 12 }}>
            <Ico.checkCircle size={12} style={{ flex: "none", marginTop: 2 }} />
            <span>Published. The next person to open the assessment reads your words.</span>
          </p>
        ) : null}
        {state === "error" ? (
          <p className="t-xs c-neg row-t gap-2" style={{ marginTop: 12 }}>
            <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />
            <span>Nothing was published. {error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
