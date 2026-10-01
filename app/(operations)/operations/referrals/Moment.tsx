"use client";

import { useState, useTransition } from "react";
import { serviceCheck, type MomentId, type MomentState, type Mood } from "@/lib/core/referral";
import { Tag, type TagTone } from "../_business/Tag";
import { decideMoment, setMood } from "./actions";
import s from "./moment.module.css";

/**
 * The private service check, and the moments.
 *
 * Two separate things. The check asks whether somebody needs a follow-up; the
 * moments say what is due. The check has no say over the moments: a review
 * invitation is the same for everyone (lib/core/referral.ts, rule 2).
 */

const MOOD_LABEL: Record<"good" | "mixed" | "bad", string> = {
  good: "It went well",
  mixed: "Something is unresolved",
  bad: "They are unhappy",
};

export function MoodCheck({ leadId, mood, name }: { leadId: string; mood: Mood; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const check = serviceCheck(mood);

  const choose = (m: Mood) =>
    start(async () => {
      setError(null);
      const r = await setMood(leadId, m);
      if (!r.ok) setError(r.error);
    });

  return (
    <div className={`${s.check} ${mood === null ? "" : s.checkQuiet}`}>
      <div className={s.checkTitle}>
        {mood === null ? `Have you asked ${name} how it went?` : check.followUp ? `Follow-up owed to ${name}` : `${name}: ${MOOD_LABEL.good.toLowerCase()}`}
      </div>
      {mood === null ? (
        <p className={s.checkText}>
          In private. The answer decides whether you owe them a follow-up, never whether they are asked for a
          review: everyone who reaches a review moment is asked the same way.
        </p>
      ) : null}
      {check.followUp ? <p className={s.checkNote}>{check.note}</p> : null}

      <div className={s.buttons}>
        {(["good", "mixed", "bad"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`btn btn-sm ${mood === m ? "btn-p" : "btn-g"}`}
            aria-pressed={mood === m}
            disabled={pending}
            onClick={() => choose(m)}
          >
            {MOOD_LABEL[m]}
          </button>
        ))}
        {mood !== null ? (
          <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => choose(null)}>
            Not asked yet
          </button>
        ) : null}
      </div>
      {error ? <p className={s.error} role="alert">{error}</p> : null}
    </div>
  );
}

const STATE_TAG: Partial<Record<MomentState, { word: string; tone: TagTone }>> = {
  due: { word: "Ask now", tone: "acc" },
  held: { word: "Held back", tone: "warn" },
  passed: { word: "Window passed", tone: "none" },
};

export function MomentRow({
  leadId, momentId, occurrence, label, ask, why, state, blockedBecause, review, timing, closing,
}: {
  leadId: string;
  momentId: MomentId;
  occurrence: number;
  label: string;
  ask: string;
  why: string;
  state: MomentState;
  blockedBecause: string | null;
  review: boolean;
  /** "Closed 4 days ago", said on the server so the clock is Georgia's. */
  timing: string | null;
  /** "Ask within 9 days": how long the ask stays reasonable. */
  closing: { text: string; urgent: boolean } | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tag = STATE_TAG[state] ?? { word: state, tone: "none" as TagTone };

  const decide = (next: MomentState) =>
    start(async () => {
      setError(null);
      const r = await decideMoment(leadId, momentId, occurrence, next);
      if (!r.ok) setError(r.error);
    });

  return (
    <div className={s.moment}>
      <div className={s.momentTop}>
        <span className={s.momentLabel}>{label}{occurrence > 0 ? `, year ${occurrence}` : ""}</span>
        <Tag tone={tag.tone}>{tag.word}</Tag>
        {review ? <Tag tone="info">Includes a review request</Tag> : null}
        {closing ? <Tag tone={closing.urgent ? "warn" : "none"}>{closing.text}</Tag> : null}
      </div>
      {timing ? <div className={s.timing}>{timing}</div> : null}
      <p className={s.ask}>{ask}</p>
      <details className={s.why}>
        <summary>Why now</summary>
        <p>{why}</p>
      </details>
      {blockedBecause ? <p className={s.blocked}>{blockedBecause}</p> : null}
      {error ? <p className={s.error} role="alert">{error}</p> : null}

      {/* Nothing here sends anything. Recording what happened is the
          product's job; saying it is Kaleb's, in his own words, through
          whatever he actually uses. A button labelled "Send" on a moment
          this delicate would be a promise about tone that no template
          can keep. */}
      <div className={s.buttons}>
        <button type="button" className="btn btn-sm btn-p" disabled={pending} onClick={() => decide("sent")}>
          I asked
        </button>
        <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("acted")}>
          They acted
        </button>
        <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("declined")}>
          They declined
        </button>
        {state === "held" ? null : (
          <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("held")}>
            Hold back
          </button>
        )}
      </div>
    </div>
  );
}
