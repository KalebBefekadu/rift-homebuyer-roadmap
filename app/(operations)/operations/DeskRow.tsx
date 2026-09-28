"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/rift/icons";
import type { DeskItem, ItemMark, MarkKind, Tone } from "@/lib/core/desk";
import { markItem } from "./actions";
import { showTime } from "@/lib/core/day";

const TONE: Record<Tone, { chip: string; word: string }> = {
  neg: { chip: "chip-neg", word: "Urgent" },
  warn: { chip: "chip-warn", word: "Soon" },
  pos: { chip: "chip-pos", word: "Set" },
  none: { chip: "chip-out", word: "Open" },
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
      key: item.key, kind, requestId: crypto.randomUUID(),
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
    <li className="desk-row">
      <div className="row gap-2" style={{ alignItems: "baseline" }}>
        <span className={`chip t-2xs ${t.chip}`} style={{ flex: "none" }}>{t.word}</span>
        <Link href={item.href} className="w6" style={{ minWidth: 0 }}>{item.title}</Link>
        {m?.kind === "pinned" ? <span className="chip t-2xs chip-acc" title={m.reason} style={{ flex: "none" }}><Ico.bolt size={10} />Pinned</span> : null}
      </div>
      <div className="desk-meta">
        {item.why}{item.about ? <> · <Link className="u" href={item.about.href}>{item.about.label}</Link></> : null} · {item.owner}{item.due ? ` · ${item.due}` : ""}
      </div>
      {item.evidence ? <div className="desk-meta" title={item.evidence}>{item.evidence}</div> : null}
      {m?.kind === "pinned" ? <div className="desk-meta">Pinned until {when(m.until)}: {m.reason}</div> : null}
      {m?.kind === "snoozed" ? <div className="desk-meta">Snoozed until {when(m.until)}; {m.owner} picks it up</div> : null}
      {m?.kind === "delegated" ? (
        <div className="desk-meta">
          <span className={`chip t-2xs ${m.accepted ? "chip-pos" : "chip-warn"}`}>{m.accepted ? `Accepted by ${m.to}` : `Delegated to ${m.to}, not accepted yet`}</span>
        </div>
      ) : null}
      <div className="between gap-2" style={{ fontSize: 12, marginTop: 2 }}>
        <span className="trunc" title={item.next}><span className="w6">Next:</span> {item.next}</span>
        {marksReady ? (
          <span className="row gap-2 c-3" style={{ flex: "none" }}>
            {m ? (
              <>
                {m.kind === "delegated" && !m.accepted ? <button type="button" className="u" disabled={pending} onClick={() => send("accept", { person: m.to })}>{m.to} accepted</button> : null}
                <button type="button" className="u" disabled={pending} onClick={() => send("clear")}>{m.kind === "pinned" ? "Unpin" : m.kind === "snoozed" ? "Bring back now" : "Take back"}</button>
              </>
            ) : menu ? (
              <>
                {item.snoozable
                  ? <button type="button" className="u" onClick={() => setOpen(open === "snooze" ? null : "snooze")} aria-expanded={open === "snooze"}>Snooze</button>
                  : <span title="A contract date is never snoozed; record what happened instead" className="c-4">No snooze</span>}
                <button type="button" className="u" onClick={() => setOpen(open === "delegate" ? null : "delegate")} aria-expanded={open === "delegate"}>Delegate</button>
                <button type="button" className="u" onClick={() => setOpen(open === "pin" ? null : "pin")} aria-expanded={open === "pin"}>Pin</button>
              </>
            ) : (
              <button type="button" className="u" onClick={() => setMenu(true)} aria-label={`Snooze, delegate or pin: ${item.title}`}>Mark</button>
            )}
          </span>
        ) : null}
      </div>

      {open === "snooze" ? (
        <form className="desk-form" onSubmit={onSubmit("snooze")}>
          <label>Back on <input className="input input-sm" type="datetime-local" name="until" required defaultValue={at(1, 9)} /></label>
          <label>Who picks it up <input className="input input-sm" name="person" required defaultValue={agentName} maxLength={120} /></label>
          <button className="btn btn-p btn-sm" disabled={pending}>Snooze</button>
        </form>
      ) : null}
      {open === "pin" ? (
        <form className="desk-form" onSubmit={onSubmit("pin")}>
          <label>Why <input className="input input-sm" name="reason" required maxLength={300} placeholder="Closing this week" /></label>
          <label>Until <input className="input input-sm" type="datetime-local" name="until" required defaultValue={at(7, 17)} /></label>
          <button className="btn btn-p btn-sm" disabled={pending}>Pin</button>
        </form>
      ) : null}
      {open === "delegate" ? (
        <form className="desk-form" onSubmit={onSubmit("delegate")}>
          <label>To <input className="input input-sm" name="person" required maxLength={120} placeholder="Sam, transaction coordinator" /></label>
          <button className="btn btn-p btn-sm" disabled={pending}>Delegate</button>
          <span className="c-4">Shows as not accepted until they say yes.</span>
        </form>
      ) : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 4 }}>{error}</p> : null}
    </li>
  );
}
