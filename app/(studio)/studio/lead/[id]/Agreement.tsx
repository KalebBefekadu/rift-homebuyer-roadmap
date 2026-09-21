"use client";

import { useState, useTransition } from "react";
import { recordRepresentation } from "../../actions";
import { STATUSES, STATUS_RULES, GATE, type Status, type Standing } from "@/lib/core/representation";
import { Ico } from "@/components/rift/icons";

/**
 * The representation agreement, as a lifecycle state rather than a side channel.
 *
 * Two things this panel is deliberately not. It is not a signing surface —
 * Rift never signs and never sends for signature, and docs/vision.md lists
 * both among the actions that never become automatic in any mode. And it is
 * not advice: the gate it describes is a rule the product enforces, not an
 * opinion about what the law requires of this particular transaction.
 *
 * It records a paper event that happened somewhere else, and refuses to let
 * the journey advance until that event is on file.
 */
export function Agreement({
  leadId,
  side,
  status,
  signedOn,
  expiresOn,
  standing,
}: {
  leadId: string;
  side: "buy" | "sell";
  status: Status;
  signedOn: string | null;
  expiresOn: string | null;
  standing: Standing;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Status>(status);
  const [from, setFrom] = useState(signedOn ?? "");
  const [until, setUntil] = useState(expiresOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rule = STATUS_RULES[standing.effective];
  const needsDate = pick === "signed";

  const save = () => {
    setError(null);
    start(async () => {
      const r = await recordRepresentation(
        leadId,
        pick,
        needsDate ? from || null : null,
        needsDate ? until || null : null,
      );
      if (!r.ok) setError(r.error);
      else setOpen(false);
    });
  };

  return (
    <section style={{ marginTop: 28 }}>
      <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
        Representation
      </div>

      <div className="card p-4" style={{ marginTop: 10 }}>
        <div className="between gap-3 wrap" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div className="row gap-2 wrap" style={{ alignItems: "center" }}>
              <span className={`chip ${rule.chip}`}>{rule.label}</span>
              {/* The lapse warning is a chip of its own, not a colour change
                  on the one above. A "Signed" chip that turns amber is the
                  no-colour-alone rule being broken in the one place where the
                  difference is a legal one. */}
              {standing.lapsingSoon ? <span className="chip chip-warn">Running out</span> : null}
            </div>
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 520 }}>
              {standing.note}
            </p>
            {!standing.covered ? (
              <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.6, maxWidth: 520 }}>
                Until this is signed, this {side === "buy" ? "buyer" : "seller"} cannot move past{" "}
                <span className="w6">{GATE[side]}</span>. Rift refuses the change rather than
                allowing it quietly.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-s btn-sm"
            style={{ flex: "none" }}
            onClick={() => { setOpen((o) => !o); setError(null); }}
            aria-expanded={open}
          >
            <Ico.set size={13} />{open ? "Cancel" : "Update"}
          </button>
        </div>

        {open ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-3)" }}>
            <div className="t-xs c-3 w6">Where does it stand?</div>
            <div className="row wrap gap-2" style={{ marginTop: 8 }}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${pick === s ? STATUS_RULES[s].chip : ""}`}
                  aria-pressed={pick === s}
                  onClick={() => setPick(s)}
                  title={STATUS_RULES[s].meaning}
                >
                  {STATUS_RULES[s].label}
                </button>
              ))}
            </div>

            <p className="t-xs c-4" style={{ marginTop: 8, lineHeight: 1.55, maxWidth: 520 }}>
              {STATUS_RULES[pick].meaning}
            </p>

            {needsDate ? (
              <div className="row wrap gap-3" style={{ marginTop: 14 }}>
                <label className="col gap-1">
                  <span className="t-2xs c-4 w6">Signed on</span>
                  <input
                    type="date"
                    className="input"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    required
                  />
                </label>
                <label className="col gap-1">
                  <span className="t-2xs c-4 w6">Runs out</span>
                  <input
                    type="date"
                    className="input"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                  <span className="t-2xs c-4">Optional</span>
                </label>
              </div>
            ) : null}

            {error ? (
              <p className="t-sm c-neg" style={{ marginTop: 12, lineHeight: 1.55 }} role="alert">
                {error}
              </p>
            ) : null}

            <div className="row gap-2" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-p btn-sm"
                onClick={save}
                disabled={pending || (needsDate && !from)}
              >
                {pending ? "Saving…" : "Record it"}
              </button>
            </div>

            <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.55, maxWidth: 520 }}>
              Rift does not sign anything and does not send anything for signature. This records
              what has already happened, and every change is written to the history below.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
