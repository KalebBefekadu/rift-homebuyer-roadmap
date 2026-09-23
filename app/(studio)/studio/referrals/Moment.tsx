"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { STATE_CHIP, type MomentId, type MomentState, type Mood } from "@/lib/core/referral";
import { decideMoment, setMood } from "../actions";

/**
 * The private check, and the decisions that depend on it.
 *
 * Drawn as one component because they are one thought. Splitting the mood
 * buttons away from the moments they gate would let a screen render the ask
 * without the question, and the whole rule is that the question comes first.
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
            In private, and before anything public. Nobody is asked to say something in
            public who has not first been asked, quietly, whether they are happy, and
            somebody who says they are not is never then asked for a rating.
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

          {/* What the answer actually does, said before it is given rather
              than after. An agent choosing between three buttons should know
              which of them stops a review request going out. */}
          {mood === "mixed" || mood === "bad" ? (
            <p className="t-xs c-warn" style={{ marginTop: 10, lineHeight: 1.55 }}>
              {mood === "bad"
                ? "No public ask goes out, now or later, unless they raise it themselves. The job is to fix it."
                : "No public ask while something is unresolved. A review request now is asking them to publish a shrug."}
            </p>
          ) : null}

          {error ? <p className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function MomentRow({
  leadId, momentId, occurrence, label, ask, why, state, blockedBecause, needsCheck, gated,
}: {
  leadId: string;
  momentId: MomentId;
  occurrence: number;
  label: string;
  ask: string;
  why: string;
  state: MomentState;
  blockedBecause: string | null;
  needsCheck: boolean;
  gated: boolean;
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
            {gated ? <span className="chip">Needs the private check</span> : null}
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
          {needsCheck ? (
            <span className="t-xs c-4" style={{ maxWidth: 180 }}>Answer the check above first.</span>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
