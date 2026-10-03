"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { Trust } from "@/components/rift/Trust";
import { nextRung, ceilingNote, type ReviewItem } from "@/lib/core/review";
import { REVIEW_SLA_HOURS } from "@/lib/core/review";
import { advanceReview } from "./actions";
import { Tag } from "./_business/Tag";
import s from "./today.module.css";

/**
 * One item in the review queue, with the control that moves it.
 *
 * The button offered depends on the item's ceiling, and where there is no next
 * rung the reason is stated in words rather than shown as a disabled button. A
 * greyed-out control teaches nobody anything; "this is a judgement, not a fact
 * somebody can certify" teaches the rule.
 */
export function ReviewRow({ item }: {
  item: ReviewItem & {
    figure?: {
      label: string; value_cents: string | number;
      assumptions: { label: string; value: string }[]; could_be_wrong: string;
    } | null;
  };
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
    <div className={s.review}>
      <div className={s.reviewTop}>
        <span className={s.reviewWho}>{item.who}</span>
        <Trust state={item.state} short />
        {item.state === "pending-review" ? <Tag tone={late ? "neg" : "warn"}>{item.waitingHours}h waiting</Tag> : null}
        {item.raisedBy === "client" ? <Tag tone="acc">They asked</Tag> : null}
      </div>

      {/* What they were told, in the words they were told it, then which
          figure it is. This is a sentence from the readout, not a number. */}
      <p className={s.reviewClaim}>{item.claim}</p>
      <p className={s.reviewWhat}>{item.what}</p>
      <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>
        <span className="w6">To advance: </span>{item.toAdvance}
      </p>
      {item.confirmedBy ? (
        <p className={s.note}><Ico.checkCircle size={12} className="c-pos" />Confirmed by {item.confirmedBy}</p>
      ) : null}

      {/* What the figure itself assumes, and where it could be wrong.

          The agent is being asked to stand behind a number. Showing the
          request without these asks them to do it from memory, which is the
          situation contract 4.2 exists to prevent on the customer's side, and
          there is no reason their side should be worse. */}
      {item.figure ? (
        <div className={s.assumes}>
          <div className={s.assumesTitle}>What this figure assumes</div>
          {item.figure.assumptions.map((a) => (
            <div key={a.label} className={s.assumeRow}><span>{a.label}</span><span>{a.value}</span></div>
          ))}
          <p className={s.assumeWrong}><span className="w6">Where it could be wrong: </span>{item.figure.could_be_wrong}</p>
        </div>
      ) : (
        <p className={s.note}>
          <Ico.info size={12} />
          Not linked to a stored figure, so advancing this will not change what they see.
        </p>
      )}

      {error ? (
        <p role="alert" className={s.error}><Ico.alert size={13} style={{ flex: "none", marginTop: 2 }} />{error}</p>
      ) : null}

      {naming ? (
        <div className="row wrap gap-2" style={{ marginTop: 12 }}>
          <input className="input" style={{ maxWidth: 320 }} autoFocus aria-label="Who confirmed it, and when"
            placeholder="Who confirmed it, and when"
            value={who} onChange={(e) => setWho(e.target.value)} />
          <button className="btn btn-p btn-sm" disabled={pending} onClick={() => go(who)}>
            {pending ? "Saving…" : "Mark verified"}
          </button>
          <button className="btn btn-g btn-sm" onClick={() => { setNaming(false); setError(null); }}>Cancel</button>
        </div>
      ) : to ? (
        <div className="row wrap gap-2" style={{ marginTop: 12 }}>
          <button className="btn btn-p btn-sm" disabled={pending}
            onClick={() => (to === "verified" ? setNaming(true) : go())}>
            {to === "reviewed" ? "I have been through it" : to === "verified" ? "A lender confirmed it" : "Send for review"}
          </button>
          {to === "verified" ? (
            <span className="t-xs c-4">Needs a name. An unsigned verification is still an estimate.</span>
          ) : null}
        </div>
      ) : (
        <p className={s.note}><Ico.info size={12} />{cap}</p>
      )}
    </div>
  );
}
