"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { LiveRegion } from "@/components/rift/Live";
import { LIMITS, type CustomQuestion } from "@/lib/core/question-wording";

/**
 * The agent's own questions (D37), asked on the "Saved." screen and nowhere
 * else.
 *
 * Why here and not among a value's questions: a value's questions stand
 * between a stranger and their free answer, and every one added there is a
 * reason to leave before seeing it (D14: understanding is free). Nor inside
 * the Save my plan form, where each extra field lowers the share of people
 * who finish it, and the name and email are the one thing that cannot be
 * asked for twice. After the save succeeds the lead is already kept, so these
 * can only add; somebody who has just chosen to hand over their details is
 * the most willing to say a little more; and skipping them is simply closing
 * the dialog. Nothing typed here is sent to telemetry (rule 6) and nothing
 * reaches a figure (rule 5).
 */
export function CustomQuestions({ questions, token }: { questions: CustomQuestion[]; token: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const given = Object.values(answers).filter((v) => v.trim()).length;

  const send = async () => {
    if (!given || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/plan/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, answers }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string };
      if (!d.ok) { setError(d.error ?? "That did not go through. Your plan is saved either way."); setState("error"); return; }
      setState("sent");
    } catch {
      setError("That did not go through. Your plan is saved either way; try again.");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p className="t-sm c-2 mt-4 row-t gap-2" role="status">
        <Ico.checkCircle size={15} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
        Sent. Kaleb will see your answers with your plan.
      </p>
    );
  }

  return (
    <section className="mt-4" aria-labelledby="custom-q-h" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 16 }}>
      <h3 id="custom-q-h" className="t-md w6">{questions.length === 1 ? "One question from Kaleb" : "A few questions from Kaleb"}</h3>
      <p className="t-xs c-3 mt-1" style={{ lineHeight: 1.55 }}>Optional. Only Kaleb sees your answers, and they change none of your numbers.</p>
      <div className="col gap-4 mt-3">
        {questions.map((q) => (
          <div key={q.key}>
            {q.type === "choice" ? (
              <div role="radiogroup" aria-labelledby={`${q.key}-t`}>
                <div id={`${q.key}-t`} className="t-sm w55">{q.title}</div>
                {q.why ? <p className="t-xs c-4 mt-1" style={{ lineHeight: 1.5 }}>{q.why}</p> : null}
                <div className="col gap-1 mt-2">
                  {q.options.map((o) => {
                    const on = answers[q.key] === o.value;
                    return (
                      <button key={o.value} type="button" role="radio" aria-checked={on} className="opt" data-on={on}
                        style={{ width: "100%", textAlign: "left", padding: "9px 12px" }}
                        onClick={() => setAnswers((a) => ({ ...a, [q.key]: on ? "" : o.value }))}>
                        <span className="t-sm">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <label className="field">
                <span className="label" style={{ lineHeight: 1.45 }}>{q.title}</span>
                {q.why ? <span className="t-xs c-4" style={{ lineHeight: 1.5 }}>{q.why}</span> : null}
                <input className="input" maxLength={LIMITS.textAnswer} value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
              </label>
            )}
          </div>
        ))}
      </div>
      <LiveRegion kind="alert">
        {error ? (
          <p className="t-sm c-neg mt-3 row-t gap-2"><Ico.alert size={13} style={{ flex: "none", marginTop: 3 }} />{error}</p>
        ) : null}
      </LiveRegion>
      <button type="button" className="btn btn-s mt-3" style={{ width: "100%" }} disabled={!given || state === "sending"} onClick={send}>
        {state === "sending" ? "Sending…" : "Send my answers to Kaleb"}
      </button>
    </section>
  );
}
