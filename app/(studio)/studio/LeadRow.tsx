"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { BAND_LABEL, BAND_TONE, type Band } from "@/lib/core/lead";
import { STOPS } from "@/lib/core/nurture";
import { stopSequence } from "./actions";

/**
 * One lead, with its arithmetic and the control that stops its sequence.
 *
 * "A reply stops the sequence immediately" is contract 4.11, and until this
 * existed nothing in the product could actually do it. A rule with no control
 * behind it is enforceable only by whoever remembers it, which in practice
 * means the first busy week breaks it — and the person on the other end
 * receives a scheduled email two days after a real conversation.
 *
 * Every stop names its reason, because "stopped, and nobody recorded why" is
 * how a cadence quietly dies and nobody can say when.
 */
export function LeadRow({ lead, last }: {
  lead: {
    id: string; name: string | null; email: string | null; side: "buy" | "sell";
    score: number; band: string;
    signals: { label: string; points: number; note: string }[];
    stopped?: string | null;
  };
  last: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const halt = (reason: string) =>
    startTransition(async () => {
      const r = await stopSequence(lead.id, reason as never);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      setOpen(false);
    });

  return (
    <div style={{ padding: "13px 15px", borderBottom: last ? undefined : "1px solid var(--line-3)" }}>
      <div className="between wrap gap-2">
        <div className="row wrap gap-2">
          <span className="t-sm w6">{lead.name || lead.email || "Anonymous"}</span>
          <span className={`chip ${BAND_TONE[lead.band as Band] ?? "chip"}`}>
            {BAND_LABEL[lead.band as Band] ?? lead.band}
          </span>
          <span className="chip">{lead.side === "buy" ? "Buyer" : "Seller"}</span>
          {lead.stopped ? <span className="chip"><Ico.pause size={10} />Sequence stopped</span> : null}
        </div>
        <span className="num t-sm">{lead.score}</span>
      </div>

      {/* The arithmetic, on the row rather than in a tooltip. */}
      <div className="row wrap gap-2" style={{ marginTop: 7 }}>
        {lead.signals.map((s) => (
          <span key={s.label} className="chip t-2xs" title={s.note}>
            {s.label} {s.points > 0 ? "+" : ""}{s.points}
          </span>
        ))}
      </div>

      {error ? (
        <p className="t-xs c-neg row gap-2" style={{ marginTop: 8 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
        </p>
      ) : null}

      {lead.stopped ? null : open ? (
        <div className="col gap-1" style={{ marginTop: 9 }}>
          <span className="t-2xs c-4">Why is it stopping?</span>
          <div className="row wrap gap-2">
            {STOPS.map((s) => (
              <button key={s.id} className="btn btn-g btn-sm" disabled={pending} title={s.why} onClick={() => halt(s.id)}>
                {s.label}
              </button>
            ))}
            <button className="btn btn-g btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-g btn-sm" style={{ marginTop: 9 }} onClick={() => setOpen(true)}>
          <Ico.pause size={12} />Stop the sequence
        </button>
      )}
    </div>
  );
}
