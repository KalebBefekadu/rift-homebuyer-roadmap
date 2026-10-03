"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { outboxAction } from "./actions";
import type { Notice } from "./notice";
import { Tag, type TagTone } from "../_business/Tag";
import s from "./outbox.module.css";

/**
 * One message waiting in the outbox, with what each button did said under it.
 *
 * The words are held here rather than in an uncontrolled form, for two
 * reasons. A form action resets its fields when it finishes, so an edit the
 * server refused came back as the old text with the rewrite gone. And
 * approving sends the prepared words, not what is in the box: with the box
 * changed, "Approve and send" would send something other than what is on the
 * screen, so it waits until the change is saved as a new draft or put back.
 *
 * A stuck message says why in a block of its own, above the words. That is
 * the failure reason, the "may have sent" warning, or the reason the last check
 * held an approved message back: without it an approved message reads as one
 * nobody has got round to sending.
 */
export function OutboxItem({ id, state, stateLabel, tone, to, toName, leadId, subject, body, reason }: {
  id: string;
  state: string;
  stateLabel: string;
  tone: TagTone;
  /** The address, shown with the name when there is one. */
  to: string;
  toName: string | null;
  leadId: string | null;
  subject: string;
  body: string;
  /** Why it is stuck: the last step's detail when it failed or may have sent, or the reason a send was held back. */
  reason: { kind: "failed" | "unknown" | "held"; text: string } | null;
}) {
  const [sub, setSub] = useState(subject);
  const [b, setB] = useState(body);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = sub !== subject || b !== body;

  const run = (what: string, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setNotice(null);
    setActing(what);
    start(async () => {
      try {
        setNotice(await outboxAction({ id, what, subject: sub, body: b }));
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
    <article className={s.item} aria-label={`Message to ${toName ?? to}: ${subject}`}>
      <div className={s.top}>
        <div>
          <div className={s.to}>To <strong>{toName ?? to}</strong>{leadId ? <> · <Link href={`/operations/lead/${leadId}`}>their record</Link></> : null}</div>
          <div className={s.sub}>{toName ? to : null}</div>
        </div>
        <Tag tone={tone}>{stateLabel}</Tag>
      </div>

      {reason ? (
        <div className={`${s.reason} ${reason.kind === "held" ? s.reasonWarn : s.reasonNeg}`} role="note">
          <Ico.alert size={14} />
          <span>
            <b>{reason.kind === "held" ? "Held back at the last check: " : reason.kind === "unknown" ? "Not confirmed: " : "Did not send: "}</b>
            {reason.text}
          </span>
        </div>
      ) : null}

      {state === "unknown" ? (
        <div className={s.form}>
          <p className={s.help}>Check the Brevo log, then say what happened. It is not sent again on its own.</p>
          <div className={s.actions}>
            <button type="button" className="btn btn-s btn-sm" disabled={pending} onClick={() => run("sent")}>{busy("sent", "It was sent", "Recording…")}</button>
            <button type="button" className="btn btn-s btn-sm" disabled={pending} onClick={() => run("not-sent")}>{busy("not-sent", "It was not sent", "Recording…")}</button>
          </div>
        </div>
      ) : (
        <div className={s.form}>
          <label className={s.field}><span className={s.label}>Subject</span>
            <input className="input" value={sub} maxLength={200} onChange={(e) => setSub(e.target.value)} disabled={pending} /></label>
          <label className={s.field}><span className={s.label}>Message</span>
            <textarea className={`input ${s.body}`} rows={9} value={b} maxLength={5000} onChange={(e) => setB(e.target.value)} disabled={pending} /></label>
          <div className={s.actions}>
            <button type="button" className="btn btn-p btn-sm" disabled={pending || dirty} onClick={() => run("send")}>
              {busy("send", reason?.kind === "held" ? "Try sending again" : "Approve and send as it was prepared", "Sending…")}
            </button>
            <button type="button" className="btn btn-s btn-sm" disabled={pending || !dirty || !sub.trim() || !b.trim()} onClick={() => run("edit")}>
              {busy("edit", "Save my changes as a new draft", "Saving…")}
            </button>
            <button type="button" className="btn btn-g btn-sm" disabled={pending}
              onClick={() => run("discard", "Discard this message? It will not be sent, and it cannot be brought back.")}>
              {busy("discard", "Discard", "Discarding…")}
            </button>
          </div>
          {dirty ? (
            <span className={`${s.help} ${s.helpWarn}`}>
              You changed the words, so approving waits: save them as a new draft and approve that, or{" "}
              <button type="button" className="u" disabled={pending} onClick={() => { setSub(subject); setB(body); }}>put back what was prepared</button>.
            </span>
          ) : (
            <span className={s.help}>Approving sends exactly the words above. Change them and save, and the new draft needs its own approval.</span>
          )}
        </div>
      )}
      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={`${s.result} ${notice.ok ? s.resultOk : s.resultBad}`}>
          {notice.ok ? <Ico.checkCircle size={14} /> : <Ico.alert size={14} />}<span>{notice.text}</span>
        </p>
      ) : null}
    </article>
  );
}
