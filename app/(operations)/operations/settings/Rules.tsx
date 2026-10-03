"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { DEFAULT_RULES, RULE_LABEL, RULE_REACH, type BusinessRules, type StoredRule } from "@/lib/core/settings";
import { decideRule, undecideRule } from "./actions";
import { showDay } from "@/lib/core/day";
import s from "./settings.module.css";

/**
 * Editing a decision, one at a time.
 *
 * No "Save all" button. Each of these is a separate judgement with a separate
 * owner and a separate consequence, and a form that commits six of them at
 * once invites the agent to accept five defaults in order to change one:
 * which is precisely how a default becomes a policy without anybody choosing
 * it.
 *
 * Every row shows what it changes and who owns it before it shows the input.
 * The two the broker owns say so above the field, not in a footnote: the
 * moment to find out that client retention has a legal floor is before typing
 * a number into it, not after.
 *
 * Each row carries an id (`rule-<key>`) so the setup list can point at it.
 */
export function Rules({ rules, undecided, decided }: {
  rules: BusinessRules;
  undecided: (keyof BusinessRules)[];
  decided: StoredRule[];
}) {
  const keys = Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[];
  const by = new Map(decided.map((d) => [d.key, d]));

  return (
    <div className={s.card}>
      {keys.map((k) => (
        <Row
          key={k}
          k={k}
          value={rules[k].value}
          isDefault={undecided.includes(k)}
          provenance={by.get(k) ?? null}
        />
      ))}
    </div>
  );
}

function Row({ k, value, isDefault, provenance }: {
  k: keyof BusinessRules;
  value: number | boolean | string;
  isDefault: boolean;
  provenance: StoredRule | null;
}) {
  const rule = DEFAULT_RULES[k];
  const kind = typeof rule.value;

  const [draft, setDraft] = useState(String(value));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = (v: number | boolean | string) => {
    setError("");
    start(async () => {
      /* The server validates too, and its answer is the one that counts:
         this is a second opinion, not the check. */
      const r = await decideRule(k, v as never);
      if (!r.ok) setError(r.error);
      else setOpen(false);
    });
  };

  const commit = () => {
    if (kind === "number") {
      const n = Number(draft);
      /* Refused here rather than sent, because "" coerces to 0 and a
         commission of zero renders perfectly in every forecast figure. */
      if (!Number.isFinite(n) || draft.trim() === "") { setError("That needs to be a number."); return; }
      save(n);
      return;
    }
    if (draft.trim() === "") { setError("That cannot be empty."); return; }
    save(draft.trim());
  };

  const shown = kind === "number" ? String(value)
    : kind === "boolean" ? (value ? "On" : "Off")
      : String(value);

  return (
    <div className={s.row} id={`rule-${k}`} style={{ scrollMarginTop: 80 }}>
      <div className={s.rowHead}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div className={s.rowTitle}>
            <span>{RULE_LABEL[k]}</span>
            {isDefault
              ? <span className="chip chip-warn t-2xs"><Ico.alert size={10} />Still on the default</span>
              : <span className="chip chip-pos t-2xs"><Ico.check size={10} />Yours</span>}
          </div>
          <p className={s.rowText}>{rule.affects}</p>
          <p className={s.rowNote}><span><strong className="w6">Who decides:</strong> {rule.owner}</span></p>
          {/* Said out loud, per rule. Some of these change nothing a person
              can see yet, and a page of dials that quietly go nowhere is
              exactly the failure this product keeps having: except built
              deliberately. A recorded decision is still worth having;
              pretending it is in force is not. */}
          <p className={`${s.rowNote}${RULE_REACH[k].live ? "" : ` ${s.rowNoteWarn}`}`}>
            {RULE_REACH[k].live ? <Ico.checkCircle size={11} /> : <Ico.alert size={11} />}
            {/* Every dormant rule's text already opens "Recorded only.", so
                a prefix here said it twice. */}
            <span>{RULE_REACH[k].live ? "In force. " : ""}{RULE_REACH[k].where}</span>
          </p>
          {provenance?.decidedBy ? (
            <p className={s.rowNote}>
              Set by {provenance.decidedBy}
              {provenance.decidedAt ? ` on ${showDay(provenance.decidedAt, { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </p>
          ) : null}
        </div>

        <div className={s.rowControl}>
          {kind === "boolean" ? (
            <button
              className={`btn btn-sm ${value ? "btn-p" : "btn-s"}`}
              disabled={pending}
              aria-pressed={Boolean(value)}
              aria-label={`${RULE_LABEL[k]}: ${value ? "on" : "off"}. Switch ${value ? "off" : "on"}`}
              onClick={() => save(!value)}
            >
              {pending ? "Saving…" : value ? "On" : "Off"}
            </button>
          ) : open ? (
            <div className="row gap-2">
              <input
                className="input input-sm"
                style={{ width: 130 }}
                autoFocus
                aria-label={RULE_LABEL[k]}
                inputMode={kind === "number" ? "decimal" : "text"}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setOpen(false); }}
              />
              <button className="btn btn-p btn-sm" disabled={pending} onClick={commit}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button className="btn btn-s btn-sm" aria-label={`Change ${RULE_LABEL[k]}, now ${shown}`} onClick={() => { setDraft(String(value)); setOpen(true); }}>
              {shown}<Ico.chevR size={12} />
            </button>
          )}

          {!isDefault ? (
            <button
              className={s.linkish}
              disabled={pending}
              onClick={() => {
                setError("");
                /* Its answer was dropped, so a reset that failed left "Yours"
                   on screen with nothing to say the default was not back. */
                start(async () => { const r = await undecideRule(k); if (!r.ok) setError(r.error); });
              }}
            >
              Back to the default ({String(rule.value)})
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="t-xs c-neg row-t gap-2" style={{ marginTop: 10 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
