"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { BAND_LABEL, type Band } from "@/lib/core/lead";
import { STOPS, type StopId } from "@/lib/core/nurture";
import { leadStrip } from "@/lib/core/lead-strip";
import { showDay } from "@/lib/core/day";
import { stopSequence, markRepliedTo } from "./actions";
import { Tag } from "./_business/Tag";
import s from "./today.module.css";

/**
 * One new lead on Today, with its figures and the control that stops its
 * sequence.
 *
 * "A reply stops the sequence immediately" is contract 4.11, and until this
 * existed nothing in the product could actually do it. A rule with no control
 * behind it is enforceable only by whoever remembers it, which in practice
 * means the first busy week breaks it, and the person on the other end
 * receives a scheduled email two days after a real conversation.
 *
 * Every stop names its reason, because "stopped, and nobody recorded why" is
 * how a cadence quietly dies and nobody can say when.
 *
 * The figures and the sentence they were told are on the row, not behind
 * Details: the agent opens this to pick up the phone, and "who is it and what
 * are they holding" is what they need first. Details holds the arithmetic and
 * the rarely used controls.
 */
export function LeadRow({ lead }: {
  lead: {
    id: string; name: string | null; email: string | null; side: "buy" | "sell";
    score: number; band: string;
    signals: { label: string; points: number; note: string }[];
    stopped?: string | null;
    figures?: Record<string, string | number> | null;
    facts?: { value: number | null; timing: string | null } | null;
    shareToken?: string | null;
    saved?: { savedAt: string; values: { label: string; figure: string }[] } | null;
    capturedScore?: number;
    humanRepliedAt?: string | null;
    /** How the speed-to-lead clock currently reads for this lead. */
    slaLabel?: string;
    breached?: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* Typed rather than cast. The last `as never` in this codebase hid a missing
     field and left an indicator permanently unable to fire, so a cast on a
     value flowing into a function that validates it is worth removing on
     sight. STOPS is the source of the ids, so this cannot drift. */
  const replied = () =>
    startTransition(async () => {
      const r = await markRepliedTo(lead.id);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
    });

  const halt = (reason: StopId) =>
    startTransition(async () => {
      const r = await stopSequence(lead.id, reason);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      setOpen(false);
    });

  const strip = leadStrip({ side: lead.side, figures: lead.figures ?? null, facts: lead.facts ?? null });
  const verdict = lead.figures?.verdict ? String(lead.figures.verdict) : null;
  const band = lead.band as Band;

  return (
    <div className={s.lead}>
      <div className={s.leadTop}>
        <div className={s.leadWho}>
          <Link href={`/operations/lead/${lead.id}`} className={s.leadName}>{lead.name || lead.email || "Anonymous"}</Link>
          <span className="chip">{lead.side === "buy" ? "Buyer" : "Seller"}</span>
          {band === "now" ? <Tag tone="neg">{BAND_LABEL[band]}</Tag> : band === "soon" ? <Tag tone="acc">{BAND_LABEL[band]}</Tag> : <span className="chip">{BAND_LABEL[band] ?? lead.band}</span>}
          {lead.humanRepliedAt
            ? <Tag tone="pos">Replied</Tag>
            : lead.slaLabel
              ? <Tag tone={lead.breached ? "neg" : "warn"}>{lead.slaLabel}</Tag>
              : null}
          {lead.stopped ? <Tag>Sequence stopped</Tag> : null}
        </div>
        <div className={s.leadAct}>
          <span className={s.score} title="How strongly their answers say to call">
            {/* The decay, shown when it is material. A lead that arrived urgent
                and has been sitting is a different situation from one that was
                never urgent, and the number alone cannot say which. */}
            {typeof lead.capturedScore === "number" && lead.capturedScore - lead.score >= 8 ? <span className={s.scoreWas} title="What it scored on arrival">was {lead.capturedScore}</span> : null}
            {lead.score}
          </span>
          {!lead.humanRepliedAt ? (
            <button className="btn btn-p btn-sm" disabled={pending} onClick={replied}><Ico.check size={12} />I have replied</button>
          ) : null}
          <button className="btn btn-g btn-sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Less" : "Details"}</button>
        </div>
      </div>

      {strip.length ? (
        <dl className={s.strip}>
          {strip.map((f) => <div key={f.label} className={s.fact}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
        </dl>
      ) : null}
      {verdict ? <p className={s.told}><b>They were told:</b> &ldquo;{verdict}&rdquo;</p> : null}

      {/* A saved plan, for everybody who arrived after the values replaced
          the questionnaire (D31). Its figures are what their browser showed
          them that day, so the row says whose figures they are and when. */}
      {!lead.figures && lead.saved?.values.length ? (
        <>
          <dl className={s.strip}>
            {lead.saved.values.map((v) => <div key={v.label} className={s.fact}><dt>{v.label}</dt><dd>{v.figure}</dd></div>)}
          </dl>
          <p className={s.told}>As their saved plan showed them on {showDay(lead.saved.savedAt, { month: "short", day: "numeric" })}.</p>
        </>
      ) : null}

      {error ? (
        <p role="alert" className={s.error}><Ico.alert size={13} style={{ flex: "none", marginTop: 2 }} /><span>{error}</span></p>
      ) : null}

      {expanded ? (
        <>
          {/* The arithmetic, on the row rather than in a tooltip. */}
          <div className={s.signals}>
            {lead.signals.map((x) => (
              <span key={x.label} className="chip" title={x.note}>{x.label} {x.points > 0 ? "+" : ""}{x.points}</span>
            ))}
          </div>
          <div className={s.leadFoot}>
            {lead.shareToken ? (
              <a className="btn btn-g btn-sm" href={`/r/${lead.shareToken}`} target="_blank" rel="noreferrer">Open their readout<Ico.arrowUpR size={12} /></a>
            ) : null}
            {lead.stopped ? null : open ? (
              <div className={s.why}>
                <span>Why is it stopping?</span>
                <div className={s.whyRow}>
                  {STOPS.map((x) => (
                    <button key={x.id} className="btn btn-g btn-sm" disabled={pending} title={x.why} onClick={() => halt(x.id)}>{x.label}</button>
                  ))}
                  <button className="btn btn-g btn-sm" onClick={() => setOpen(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-g btn-sm" onClick={() => setOpen(true)}><Ico.pause size={12} />Stop the sequence</button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
