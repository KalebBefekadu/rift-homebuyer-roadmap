"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { outboxAction } from "./actions";
import type { Notice } from "./notice";

/**
 * One message waiting in the outbox, with what each button did said under it.
 *
 * The words are held here rather than in an uncontrolled form, for two
 * reasons. A form action resets its fields when it finishes, so an edit the
 * server refused came back as the old text with the rewrite gone. And
 * approving sends the prepared words, not what is in the box: with the box
 * changed, "Approve and send" would send something other than what is on the
 * screen, so it waits until the change is saved as a new draft or put back.
 */
export function OutboxItem({ id, state, stateLabel, chip, to, leadId, subject, body, problem }: {
  id: string;
  state: string;
  stateLabel: string;
  chip: string;
  to: string;
  leadId: string | null;
  subject: string;
  body: string;
  /** The last step's detail when it failed or may have sent. */
  problem: string | null;
}) {
  const [s, setS] = useState(subject);
  const [b, setB] = useState(body);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = s !== subject || b !== body;

  const run = (what: string, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setNotice(null);
    setActing(what);
    start(async () => {
      try {
        setNotice(await outboxAction({ id, what, subject: s, body: b }));
      } catch {
        /* No answer is not "nothing happened" for a send: it may have gone. */
        setNotice({
          ok: false,
          text: what === "send"
            ? "Rift did not answer. Reload the page to see whether it was sent before pressing again."
            : "Rift could not be reached. Nothing was changed. Check the connection and try again.",
        });
      }
    });
  };
  const busy = (what: string, label: string, doing: string) => (pending && acting === what ? doing : label);

  return (
    <article className="card p-4">
      <div className="between wrap gap-2">
        <div className="t-sm">To <strong>{to}</strong>{leadId ? <> · <Link className="u" href={`/operations/lead/${leadId}`}>their record</Link></> : null}</div>
        <span className={`chip t-2xs ${chip}`}>{stateLabel}</span>
      </div>
      {problem ? <p className="t-xs c-neg mt-1">{problem}</p> : null}
      {state === "unknown" ? (
        <div className="row gap-2 wrap mt-2">
          <span className="t-xs c-3">Check the Brevo log, then say what happened. It is not sent again on its own.</span>
          <button type="button" className="btn btn-g btn-sm" disabled={pending} onClick={() => run("sent")}>{busy("sent", "It was sent", "Recording…")}</button>
          <button type="button" className="btn btn-g btn-sm" disabled={pending} onClick={() => run("not-sent")}>{busy("not-sent", "It was not sent", "Recording…")}</button>
        </div>
      ) : (
        <div className="col gap-2 mt-3">
          <label className="field"><span className="label">Subject</span>
            <input className="input" value={s} maxLength={200} onChange={(e) => setS(e.target.value)} disabled={pending} /></label>
          <label className="field"><span className="label">Message</span>
            <textarea className="input" rows={9} value={b} maxLength={5000} onChange={(e) => setB(e.target.value)} disabled={pending} /></label>
          <div className="row gap-2 wrap">
            <button type="button" className="btn btn-p btn-sm" disabled={pending || dirty} onClick={() => run("send")}>
              {busy("send", "Approve and send as it was prepared", "Sending…")}
            </button>
            <button type="button" className="btn btn-g btn-sm" disabled={pending || !dirty || !s.trim() || !b.trim()} onClick={() => run("edit")}>
              {busy("edit", "Save my changes as a new draft", "Saving…")}
            </button>
            <button type="button" className="btn btn-g btn-sm" disabled={pending}
              onClick={() => run("discard", "Discard this message? It will not be sent, and it cannot be brought back.")}>
              {busy("discard", "Discard", "Discarding…")}
            </button>
          </div>
          {dirty ? (
            <span className="t-2xs c-warn">
              You changed the words, so approving waits: save them as a new draft and approve that, or{" "}
              <button type="button" className="u" disabled={pending} onClick={() => { setS(subject); setB(body); }}>put back what was prepared</button>.
            </span>
          ) : (
            <span className="t-2xs c-4">Approving sends exactly the words above. Change them and save, and the new draft needs its own approval.</span>
          )}
        </div>
      )}
      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={`t-xs mt-2 ${notice.ok ? "c-pos" : "c-neg"}`}>
          {notice.ok ? "✓" : "✕"} {notice.text}
        </p>
      ) : null}
    </article>
  );
}
