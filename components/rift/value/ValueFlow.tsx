"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/rift/icons";
import { ASKS, answersToQuery, type Answers } from "@/lib/core/asks";
import type { InputKey } from "@/lib/core/values";
import { readAnswers, writeAnswers } from "@/lib/rift/answers";
import { track, useCaptureTouch } from "@/lib/rift/track";
import { MoneyField } from "./MoneyField";

/**
 * Asks a value's questions, only the ones not already answered, one at a
 * time, centred (Blueprint v5 §5.6).
 *
 * A single choice moves on when it is clicked: there is no Next button to
 * press after answering (Kaleb, R2). A typed or slider amount keeps an
 * explicit Continue, because the page cannot know when somebody has finished
 * typing.
 *
 * When everything is known it replaces the address with the answers, and the
 * server computes the answer page. Answers already given anywhere on the site
 * (this device, the last 30 days) are never asked again.
 */
export function ValueFlow({ tool, side, href, asks, given, only }: {
  tool: string;
  side: "buy" | "sell" | "abroad";
  href: string;
  asks: InputKey[];
  given: Answers;
  /** Re-ask just this one, from "Change" on the answer page. */
  only?: InputKey;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(given);
  const [queue, setQueue] = useState<InputKey[] | null>(null);
  const [i, setI] = useState(0);
  const shownAt = useRef(Date.now());
  const done = useRef(false);
  const trackSide = side === "abroad" ? undefined : side;

  useCaptureTouch();

  const finish = (a: Answers) => {
    if (done.current) return;
    done.current = true;
    writeAnswers(a);
    router.replace(`${href}?${answersToQuery(a, asks)}`, { scroll: true });
  };

  useEffect(() => {
    const merged = { ...readAnswers(), ...given };
    const q = only ? [only] : asks.filter((k) => merged[k] === undefined);
    setAnswers(merged);
    track({ name: "value_view", side: trackSide, meta: { tool, answered: asks.length - q.length, of: asks.length } });
    if (q.length === 0) { finish(merged); return; }
    setQueue(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = queue?.[i];
  useEffect(() => {
    if (!key) return;
    shownAt.current = Date.now();
    track({ name: "question_view", side: trackSide, questionKey: key, meta: { tool, step: i + 1, of: queue!.length } });
  }, [key, i, queue, tool, trackSide]);

  if (!queue || !key) {
    return (
      <div className="narrow sec" aria-busy="true">
        <p className="t-sm c-4 ctr">Working out your answer…</p>
      </div>
    );
  }

  const def = ASKS[key];
  const value = answers[key];

  const answer = (v: string | number, advance: boolean) => {
    const next = { ...answers, [key]: v };
    setAnswers(next);
    if (!advance) return;
    track({ name: "question_answer", side: trackSide, questionKey: key, dwellMs: Date.now() - shownAt.current, meta: { tool, step: i + 1 } });
    writeAnswers({ [key]: v });
    if (i < queue.length - 1) setI(i + 1);
    else finish(next);
  };

  return (
    <div className="narrow sec-sm" style={{ paddingBottom: 24 }}>
      <div className="between" style={{ minHeight: 30 }}>
        {i > 0 ? (
          <button className="btn btn-g btn-sm" onClick={() => setI(i - 1)}><Ico.chevL size={13} />Back</button>
        ) : <span />}
        {queue.length > 1 ? <span className="t-xs c-4">Question {i + 1} of {queue.length}</span> : null}
      </div>

      <div key={key} className="fade-in" style={{ marginTop: 18 }}>
        <h1 className="serif ctr" style={{ fontSize: "clamp(26px,3.6vw,38px)", lineHeight: 1.12, letterSpacing: "-0.022em" }}>
          {def.title}
        </h1>
        {def.why ? <p className="t-md c-3 ctr measure" style={{ marginTop: 12, lineHeight: 1.6 }}>{def.why}</p> : null}

        <div style={{ marginTop: 28 }}>
          {def.type === "choice" ? (
            <div
              role="radiogroup"
              aria-label={def.title}
              className={def.options!.length > 5 ? "g2 gap-2" : "col gap-2"}
            >
              {def.options!.map((o) => (
                <button
                  key={o.value}
                  role="radio"
                  aria-checked={String(value) === o.value}
                  className="opt"
                  data-on={String(value) === o.value}
                  style={{ width: "100%", textAlign: "left", alignItems: "center" }}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [key]: o.value }));
                    /* Long enough for the choice to register visually. */
                    setTimeout(() => answer(o.value, true), 170);
                  }}
                >
                  <span className="grow">
                    <span className="t-md w55">{o.label}</span>
                    {o.hint ? <span className="t-xs c-4" style={{ display: "block", marginTop: 1 }}>{o.hint}</span> : null}
                  </span>
                  <Ico.chevR size={14} className="c-4" />
                </button>
              ))}
            </div>
          ) : (
            <MoneyField
              def={def}
              value={typeof value === "number" ? value : Number(def.fallback)}
              onDone={(n) => answer(n, true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
