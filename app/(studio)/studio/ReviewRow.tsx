"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { Trust } from "@/components/rift/Trust";
import { nextRung, ceilingNote, type ReviewItem } from "@/lib/core/review";
import { REVIEW_SLA_HOURS } from "@/lib/core/review";
import { advanceReview } from "./actions";

/**
 * One item in the review queue, with the control that moves it.
 *
 * The button offered depends on the item's ceiling, and where there is no next
 * rung the reason is stated in words rather than shown as a disabled button. A
 * greyed-out control teaches nobody anything; "this is a judgement, not a fact
 * somebody can certify" teaches the rule.
 */
export function ReviewRow({ item, last }: {
  item: ReviewItem & {
    figure?: {
      label: string; value_cents: string | number;
      assumptions: { label: string; value: string }[]; could_be_wrong: string;
    } | null;
  };
  last: boolean;
}) {
  const [naming, setNaming] = useState(false);
  const [who, setWho] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const to = nextRung(item);
  const cap = ceilingNote(item);
  const late = item.state === "pending-review" && item.waitingHours > REVIEW_SLA_HOURS;

  const go = (confirmedBy?: string) =>
    startTransition(async () => {
      const r = await advanceReview(item.id, confirmedBy);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      setNaming(false);
      setWho("");
    });

  return (
    <div style={{ padding: "12px 15px", borderBottom: last ? undefined : "1px solid var(--line-3)" }}>
      <div className="between wrap gap-2">
        <div className="row wrap gap-2">
          <span className="t-sm w6">{item.who}</span>
          <Trust state={item.state} short />
          {item.state === "pending-review" ? (
            <span className={`chip ${late ? "chip-neg" : ""}`}>{item.waitingHours}h waiting</span>
          ) : null}
          {item.raisedBy === "client" ? <span className="chip chip-acc">They asked</span> : null}
        </div>
        <span className="mono t-sm w6">{item.claim}</span>
      </div>

      <p className="t-sm" style={{ marginTop: 4 }}>{item.what}</p>
      <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.55 }}>
        <span className="w6">To advance: </span>{item.toAdvance}
      </p>
      {item.confirmedBy ? (
        <p className="t-xs c-3 row gap-2" style={{ marginTop: 5 }}>
          <Ico.checkCircle size={11} className="c-pos" />Confirmed by {item.confirmedBy}
        </p>
      ) : null}

      {/* What the figure itself assumes, and where it could be wrong.
          
          He is being asked to stand behind a number. Showing the request
          without these asks him to do it from memory — which is the situation
          contract 4.2 exists to prevent on the customer's side, and there is
          no reason his side should be worse. */}
      {item.figure ? (
        <div className="card p-3" style={{ marginTop: 9, background: "var(--sunk)" }}>
          <div className="t-2xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>
            What this figure assumes
          </div>
          <div className="col gap-1" style={{ marginTop: 6 }}>
            {item.figure.assumptions.map((a) => (
              <div key={a.label} className="between t-xs">
                <span className="c-3">{a.label}</span>
                <span className="num">{a.value}</span>
              </div>
            ))}
          </div>
          <p className="t-xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
            <span className="w6">Where it could be wrong: </span>{item.figure.could_be_wrong}
          </p>
        </div>
      ) : (
        <p className="t-xs c-4 row gap-2" style={{ marginTop: 8 }}>
          <Ico.info size={11} style={{ flex: "none", marginTop: 2 }} />
          Not linked to a stored figure, so advancing this will not change what they see.
        </p>
      )}

      {error ? (
        <p className="t-xs c-neg row gap-2" style={{ marginTop: 8 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
        </p>
      ) : null}

      {naming ? (
        <div className="row wrap gap-2" style={{ marginTop: 9 }}>
          <input className="input" style={{ maxWidth: 320 }} autoFocus
            placeholder="Who confirmed it, and when"
            value={who} onChange={(e) => setWho(e.target.value)} />
          <button className="btn btn-p btn-sm" disabled={pending} onClick={() => go(who)}>
            {pending ? "Saving…" : "Mark verified"}
          </button>
          <button className="btn btn-g btn-sm" onClick={() => { setNaming(false); setError(null); }}>Cancel</button>
        </div>
      ) : to ? (
        <div className="row wrap gap-2" style={{ marginTop: 9 }}>
          <button className="btn btn-p btn-sm" disabled={pending}
            onClick={() => (to === "verified" ? setNaming(true) : go())}>
            {to === "reviewed" ? "I have been through it" : to === "verified" ? "A lender confirmed it" : "Send for review"}
          </button>
          {to === "verified" ? (
            <span className="t-2xs c-4">Needs a name — an unsigned verification is still an estimate.</span>
          ) : null}
        </div>
      ) : (
        <p className="t-xs c-4 row gap-2" style={{ marginTop: 8 }}>
          <Ico.info size={11} style={{ flex: "none", marginTop: 2 }} />{cap}
        </p>
      )}
    </div>
  );
}
