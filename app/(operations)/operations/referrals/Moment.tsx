"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { STATE_CHIP, serviceCheck, type MomentId, type MomentState, type Mood } from "@/lib/core/referral";
import { decideMoment, setMood } from "../actions";

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

  const choose = (m: Mood) =>
    start(async () => {
      setError(null);
      const r = await setMood(leadId, m);
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="card p-4" style={{ background: mood === null ? "var(--accent-wash)" : undefined }}>
      <div className="row gap-2">
        <Ico.alert size={14} className={mood === null ? "c-acc" : "c-4"} style={{ flex: "none", marginTop: 2 }} />
        <div className="grow">
          <div className="t-sm w6">Have you asked {name} how it went?</div>
          <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
            In private. The answer decides whether you owe them a follow-up, never
            whether they are asked for a review: everyone who reaches a review moment
            is asked the same way.
          </p>

          <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
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

          {serviceCheck(mood).followUp ? (
            <p className="t-xs c-warn" style={{ marginTop: 10, lineHeight: 1.55 }}>
              {serviceCheck(mood).note}
            </p>
          ) : null}

          {error ? <p className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function MomentRow({
  leadId, momentId, occurrence, label, ask, why, state, blockedBecause, review,
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
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chip = STATE_CHIP[state];

  const decide = (next: MomentState) =>
    start(async () => {
      setError(null);
      const r = await decideMoment(leadId, momentId, occurrence, next);
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="card p-4">
      <div className="between wrap gap-2">
        <div className="grow" style={{ minWidth: 220 }}>
          <div className="row gap-2 wrap">
            <span className="t-sm w6">{label}</span>
            <span className={`chip ${chip.c}`}>{chip.l}</span>
            {occurrence > 0 ? <span className="chip">Year {occurrence}</span> : null}
            {review ? <span className="chip">Includes a review request</span> : null}
          </div>
          <p className="t-sm" style={{ marginTop: 6, lineHeight: 1.55 }}>{ask}</p>
          <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>{why}</p>
          {blockedBecause ? (
            <p className="t-xs c-warn" style={{ marginTop: 6, lineHeight: 1.55 }}>{blockedBecause}</p>
          ) : null}
          {error ? <p className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}
        </div>

        {/* Nothing here sends anything. Recording what happened is the
            product's job; saying it is Kaleb's, in his own words, through
            whatever he actually uses. A button labelled "Send" on a moment
            this delicate would be a promise about tone that no template
            can keep. */}
        <div className="row gap-2 wrap" style={{ flex: "none" }}>
          <>
              <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("sent")}>
                Asked
              </button>
              <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("acted")}>
                They acted
              </button>
              <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("declined")}>
                Declined
              </button>
              <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => decide("held")}>
                Hold back
              </button>
          </>
        </div>
      </div>
    </div>
  );
}
