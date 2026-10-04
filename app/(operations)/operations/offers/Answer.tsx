"use client";

import { useId, useState, useTransition } from "react";
import { setOfferAnswer } from "./actions";
import k from "../_business/kit.module.css";
import s from "./offers.module.css";

/**
 * Answered or not, and the sender's deadline, recorded on the offer itself.
 *
 * Without this the page could only guess "replied" from the lead's email
 * reply, which an offer answered by phone never has.
 */
export function Answer({ offerId, answered, respondBy, inferred, by }: {
  offerId: string;
  answered: boolean;
  respondBy: string | null;
  /** True when `answered` is the lead-reply guess rather than something recorded. */
  inferred: boolean;
  by: string | null;
}) {
  const [pending, start] = useTransition();
  const [date, setDate] = useState(respondBy ?? "");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const save = (next: boolean, day: string) => start(async () => {
    setError(null);
    const r = await setOfferAnswer(offerId, next, day || null);
    if (!r.ok) setError(r.error);
  });

  return (
    <div className={s.well}>
      <div className={s.wellRow}>
        <span className={k.strong}>
          {answered ? "Answered" : "Not answered yet"}
          {inferred ? <span className={k.muted}>{answered ? " (they have had a reply from you since it arrived)" : ""}</span> : by ? <span className={k.muted}> (recorded by {by})</span> : null}
        </span>
        <button type="button" className="btn btn-s btn-sm" disabled={pending} onClick={() => save(!answered, date)}>
          {answered ? "Mark not answered" : "Mark answered"}
        </button>
      </div>
      <div className={s.wellRow} style={{ marginTop: 8 }}>
        <label htmlFor={id} className={k.muted}>They need an answer by</label>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <input id={id} type="date" className="input input-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="btn btn-g btn-sm" disabled={pending || date === (respondBy ?? "")} onClick={() => save(answered, date)}>
            {!date && respondBy ? "Clear date" : "Save date"}
          </button>
        </span>
      </div>
      {error ? <p className="t-2xs c-neg" role="alert" style={{ marginTop: 6 }}>{error}</p> : null}
    </div>
  );
}
