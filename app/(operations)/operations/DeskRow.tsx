"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/rift/icons";
import type { DeskItem, ItemMark, MarkKind, Tone } from "@/lib/core/desk";
import { markItem } from "./actions";
import { showTime } from "@/lib/core/day";
import { newRequestId } from "@/lib/core/ids";
import { Tag } from "./_business/Tag";
import s from "./today.module.css";

/* Every state is an icon and a word (rule 10). An item with nothing wrong with
   it is the neutral case and carries no tag: a row of identical "Open" tags
   says nothing, and made the ones that were urgent harder to see. */
const TONE: Partial<Record<Tone, { tone: "neg" | "warn" | "pos"; word: string }>> = {
  neg: { tone: "neg", word: "Urgent" },
  warn: { tone: "warn", word: "Soon" },
  pos: { tone: "pos", word: "Set" },
};

const when = (iso: string) => showTime(iso, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A local datetime-local value `days` from now at `hour`:00. */
function at(days: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * One item on Today (§8.4): why it is here, who owns it, what it is about,
 * the evidence, when it is due and the next action, with snooze, pin and
 * delegate (OPS-02). A contract date offers no snooze: the product never
 * hides a date's reminder in a way that could read as moving the date.
 *
 * The person it is about has its own line and is never clamped. The meta line
 * used to be cut to one row, which removed exactly the part that told two
 * "Title" rows apart.
 */
export function DeskRow({ item, agentName, marksReady }: { item: DeskItem & { mark: ItemMark | null }; agentName: string; marksReady: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "snooze" | "pin" | "delegate">(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = TONE[item.tone];

  const send = (kind: MarkKind, extra: { until?: string; person?: string; reason?: string } = {}) => start(async () => {
    setError(null);
    const r = await markItem({
      key: item.key, kind, requestId: newRequestId(),
      until: extra.until ? new Date(extra.until).toISOString() : null, person: extra.person ?? null, reason: extra.reason ?? null,
    });
    if (!r.ok) { setError(r.error); return; }
    setOpen(null);
    setMenu(false);
    router.refresh();
  });

  const onSubmit = (kind: "snooze" | "pin" | "delegate") => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    send(kind, { until: String(f.get("until") ?? "") || undefined, person: String(f.get("person") ?? "") || undefined, reason: String(f.get("reason") ?? "") || undefined });
  };

  const m = item.mark;
  return (
    <li className={s.item}>
      <div className={s.itemTop}>
        {t ? <Tag tone={t.tone}>{t.word}</Tag> : null}
        {m?.kind === "pinned" ? <Tag tone="acc" title={m.reason}>Pinned</Tag> : null}
        {item.href
          ? <Link href={item.href} className={s.itemTitle}>{item.title}</Link>
          : <span className={s.itemTitle}>{item.title}</span>}
      </div>
      <div className={s.itemAbout}>
        {item.about ? <Link href={item.about.href}>{item.about.label}</Link> : null}
        {item.about ? <span className={s.dot} aria-hidden>·</span> : null}
        <span>{item.owner}</span>
        {item.due ? <><span className={s.dot} aria-hidden>·</span><span>{item.due}</span></> : null}
      </div>
      <div className={s.itemWhy}>{item.why}</div>
      {item.evidence ? <div className={s.itemEvidence}>{item.evidence}</div> : null}
      {m?.kind === "pinned" ? <div className={s.itemMark}>Pinned until {when(m.until)}: {m.reason}</div> : null}
      {m?.kind === "snoozed" ? <div className={s.itemMark}>Snoozed until {when(m.until)}; {m.owner} picks it up</div> : null}
      {m?.kind === "delegated" ? (
        <div className={s.itemMark}>
          <Tag tone={m.accepted ? "pos" : "warn"}>{m.accepted ? `Accepted by ${m.to}` : `Delegated to ${m.to}, not accepted yet`}</Tag>
        </div>
      ) : null}
      <div className={s.itemFoot}>
        <span className={s.next}><b>Next:</b> {item.next}</span>
        {marksReady ? (
          <span className={s.marks}>
            {m ? (
              <>
                {m.kind === "delegated" && !m.accepted ? <button type="button" className="btn btn-s btn-sm" disabled={pending} onClick={() => send("accept", { person: m.to })}>{m.to} accepted</button> : null}
                <button type="button" className="btn btn-s btn-sm" disabled={pending} onClick={() => send("clear")}>{m.kind === "pinned" ? "Unpin" : m.kind === "snoozed" ? "Bring back now" : "Take back"}</button>
              </>
            ) : menu ? (
              <>
                {item.snoozable
                  ? <button type="button" className="btn btn-s btn-sm" onClick={() => setOpen(open === "snooze" ? null : "snooze")} aria-expanded={open === "snooze"}>Snooze</button>
                  : <span title="A contract date is never snoozed; record what happened instead" className="t-xs c-4" style={{ alignSelf: "center" }}>Dates are not snoozed</span>}
                <button type="button" className="btn btn-s btn-sm" onClick={() => setOpen(open === "delegate" ? null : "delegate")} aria-expanded={open === "delegate"}>Delegate</button>
                <button type="button" className="btn btn-s btn-sm" onClick={() => setOpen(open === "pin" ? null : "pin")} aria-expanded={open === "pin"}>Pin</button>
              </>
            ) : (
              <button type="button" className="btn btn-s btn-sm" onClick={() => setMenu(true)} aria-label={`Snooze, delegate or pin: ${item.title}`}>Mark</button>
            )}
          </span>
        ) : null}
      </div>

      {open === "snooze" ? (
        <form className={s.form} onSubmit={onSubmit("snooze")}>
          <label>Back on <input className="input input-sm" type="datetime-local" name="until" required defaultValue={at(1, 9)} /></label>
          <label>Who picks it up <input className="input input-sm" name="person" required defaultValue={agentName} maxLength={120} /></label>
          <button className="btn btn-p btn-sm" disabled={pending}>Snooze</button>
        </form>
      ) : null}
      {open === "pin" ? (
        <form className={s.form} onSubmit={onSubmit("pin")}>
          <label>Why <input className="input input-sm" name="reason" required maxLength={300} placeholder="Closing this week" /></label>
          <label>Until <input className="input input-sm" type="datetime-local" name="until" required defaultValue={at(7, 17)} /></label>
          <button className="btn btn-p btn-sm" disabled={pending}>Pin</button>
        </form>
      ) : null}
      {open === "delegate" ? (
        <form className={s.form} onSubmit={onSubmit("delegate")}>
          <label>To <input className="input input-sm" name="person" required maxLength={120} placeholder="Sam, transaction coordinator" /></label>
          <button className="btn btn-p btn-sm" disabled={pending}>Delegate</button>
          <span className="c-4">Shows as not accepted until they say yes.</span>
        </form>
      ) : null}
      {error ? <p role="alert" className={s.error}><Ico.alert size={13} style={{ flex: "none", marginTop: 2 }} />{error}</p> : null}
    </li>
  );
}
