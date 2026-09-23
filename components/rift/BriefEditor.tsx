"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  approvalBlockers, criterionError, describe, FIELD_ORDER, FIELDS, PROPERTY_TYPES, STRENGTH_LABEL,
  type Field, type Operator, type PropertyType, type SearchCriterion, type Strength,
} from "@/lib/core/search";

export const OPERATOR_LABEL = (field: Field, op: Operator): string => {
  if (op === "atMost") return "At most";
  if (op === "atLeast") return "At least";
  if (op === "oneOf") return field === "geography" ? "In" : "One of";
  if (op === "avoids") return "Avoid";
  return field === "price" ? "Target (about)" : field === "basement" ? "Is" : "Must have";
};

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Draft {
  id: string | null;
  field: Field;
  operator: Operator;
  raw: string;
  types: PropertyType[];
  strength: Strength;
  statedBy: string;
  statedAt: string;
  sourceRef: string;
}

function toCriterion(d: Draft): SearchCriterion {
  const rule = FIELDS[d.field];
  let value: SearchCriterion["value"];
  switch (rule.value) {
    case "money": value = Number(d.raw.replace(/[$,\s]/g, "")); break;
    case "count": case "half": case "acres": value = Number(d.raw); break;
    case "codes": value = d.types; break;
    case "places": value = d.raw.split(",").map((s) => s.trim()).filter(Boolean); break;
    default: value = d.raw.trim();
  }
  return {
    id: d.id ?? newId(), field: d.field, operator: d.operator, value, unit: rule.unit,
    strength: d.strength, statedBy: d.statedBy.trim(), statedAt: d.statedAt, sourceRef: d.sourceRef.trim(),
  };
}

function fromCriterion(c: SearchCriterion): Draft {
  return {
    id: c.id, field: c.field, operator: c.operator,
    raw: Array.isArray(c.value) ? (c.field === "propertyType" ? "" : c.value.join(", ")) : String(c.value),
    types: c.field === "propertyType" ? (c.value as PropertyType[]) : [],
    strength: c.strength, statedBy: c.statedBy, statedAt: c.statedAt.slice(0, 10), sourceRef: c.sourceRef,
  };
}

/**
 * The search brief, edited. The agent's panel and the buyer's page both use it.
 *
 * Every criterion says who stated it, when, and where it came from, because
 * the next time the buyer changes their mind the question is "who said three
 * bedrooms, and when", and a list of filters cannot answer it. Saving makes a
 * new revision; nothing already saved is edited (AT09).
 *
 * For the buyer (`mode="client"`) the who/when/where fields are hidden: the
 * server stamps their name, today, and "client page" on anything they changed,
 * whatever the browser sends (lib/db/client.ts proposeRevision).
 */
export function BriefEditor({ latest, start, person, disagreement, onSave, mode = "agent", saveLabel }: {
  latest: { revision: number; criteria: SearchCriterion[]; questions: string[] } | null;
  start: { criteria: SearchCriterion[]; from: string } | null;
  person: string;
  disagreement: string[];
  onSave: (brief: { criteria: SearchCriterion[]; questions: string[] }, expectedLatest: number, note: string | null) => Promise<{ ok: boolean; error?: string; revision?: unknown }>;
  mode?: "agent" | "client";
  saveLabel?: string;
}) {
  const client = mode === "client";
  const today = new Date().toISOString().slice(0, 10);
  const blank = (): Draft => ({
    id: null, field: "price", operator: "atMost", raw: "", types: [], strength: "hard",
    statedBy: `${person.split(/\s+/)[0] ?? person} (buyer)`, statedAt: today, sourceRef: `call on ${today}`,
  });

  const [criteria, setCriteria] = useState<SearchCriterion[]>(latest?.criteria ?? []);
  const [questions, setQuestions] = useState<string[]>(latest?.questions ?? []);
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /* Saved, but the page has not yet brought the new revision back. Until it
     does, the editor still differs from the page's copy, so without this the
     save button would come back and invite a second, conflicting save. */
  const arriving = saved !== null && (latest?.revision ?? 0) < saved;
  const pending = busy || arriving;

  /* A newer revision arriving (this save, or somebody else's) resets the
     editor to it. Done here rather than by re-keying the component: a key that
     changes with the revision unmounts the component whose transition is
     waiting for that very update, and the save sat on "Saving…" with the
     revision already stored (local walk-through, 23 Sep 2026). */
  const seen = useRef(latest?.revision ?? 0);
  useEffect(() => {
    const now = latest?.revision ?? 0;
    if (now === seen.current) return;
    seen.current = now;
    setCriteria(latest?.criteria ?? []);
    setQuestions(latest?.questions ?? []);
    setDraft(null);
  }, [latest]);

  const dirty = JSON.stringify({ criteria, questions }) !== JSON.stringify({ criteria: latest?.criteria ?? [], questions: latest?.questions ?? [] });
  const blockers = useMemo(() => approvalBlockers({ criteria, questions }, disagreement), [criteria, questions, disagreement]);
  const draftCriterion = draft ? toCriterion(draft) : null;
  const draftError = draftCriterion ? criterionError(draftCriterion) : null;

  const commitDraft = () => {
    if (!draft || !draftCriterion || draftError) return;
    setCriteria((list) => draft.id ? list.map((c) => (c.id === draft.id ? draftCriterion : c)) : [...list, draftCriterion]);
    setDraft(null);
  };

  /* A plain busy flag, not a transition: the button's state follows the
     save's own answer, never a page update arriving (journey/ops.ts). */
  const save = async () => {
    if (pending) return;
    setBusy(true);
    try {
      const r = await onSave({ criteria, questions }, latest?.revision ?? 0, note || null);
      if (!r.ok) { setError(r.error ?? "That did not save"); return; }
      setError(null);
      setNote("");
      setSaved(typeof r.revision === "number" ? r.revision : (latest?.revision ?? 0) + 1);
    } finally {
      setBusy(false);
    }
  };

  const setField = (field: Field) => {
    if (!draft) return;
    setDraft({ ...draft, field, operator: FIELDS[field].operators[0]!, raw: field === "basement" ? "yes" : "", types: [] });
  };

  return (
    <div>
      {criteria.length === 0 && !draft ? (
        <div className="card p-3" style={{ background: "var(--sunk)" }}>
          <p className="t-sm c-2" style={{ lineHeight: 1.6 }}>No brief yet.</p>
          {start && !client ? (
            <>
              <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Their {start.from} has {start.criteria.map((c) => `${FIELDS[c.field].label.toLowerCase()} (${describe(c)})`).join(" and ")}.
                Starting from it saves asking again. Each item comes in as <em>not decided</em>, because a price
                used in a cost calculation is not yet a search limit: confirm each with them.
              </p>
              <button className="btn btn-s btn-sm" style={{ marginTop: 10 }} onClick={() => setCriteria(start.criteria)}>
                Start from their readout
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {criteria.length ? (
        <ul style={{ display: "grid", gap: 6 }}>
          {[...criteria].sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field)).map((c) => (
            <li key={c.id} className="card p-3 between gap-2 wrap" style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                <div className="row gap-2 wrap">
                  <span className="t-sm w6">{FIELDS[c.field].label}: {describe(c)}</span>
                  <span className={`chip t-2xs ${c.strength === "hard" ? "chip-pos" : c.strength === "undecided" ? "chip-warn" : ""}`}>
                    {STRENGTH_LABEL[c.strength]}
                  </span>
                </div>
                <div className="t-2xs c-4" style={{ marginTop: 3 }}>
                  {client ? `${c.statedBy}, ${c.statedAt.slice(0, 10)}` : `${c.statedBy}, ${c.statedAt.slice(0, 10)}, from ${c.sourceRef}`}
                </div>
              </div>
              <div className="row gap-1">
                <button className="btn btn-g btn-sm" onClick={() => setDraft(fromCriterion(c))}>Edit</button>
                <button className="btn btn-g btn-sm" aria-label={`Remove ${FIELDS[c.field].label}`}
                  onClick={() => setCriteria((l) => l.filter((x) => x.id !== c.id))}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {draft ? (
        <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "1 1 150px" }}>
              <span className="label">What</span>
              <select className="input" value={draft.field} onChange={(e) => setField(e.target.value as Field)}>
                {FIELD_ORDER.map((f) => <option key={f} value={f}>{FIELDS[f].label}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: "1 1 130px" }}>
              <span className="label">Rule</span>
              <select className="input" value={draft.operator} onChange={(e) => setDraft({ ...draft, operator: e.target.value as Operator })}>
                {FIELDS[draft.field].operators.map((o) => <option key={o} value={o}>{OPERATOR_LABEL(draft.field, o)}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: "2 1 200px" }}>
              <span className="label">
                {FIELDS[draft.field].value === "places" ? "Places, separated by commas"
                  : FIELDS[draft.field].value === "money" ? `Amount${FIELDS[draft.field].unit === "USD/month" ? " a month" : ""}`
                  : FIELDS[draft.field].value === "text" ? "Describe the feature" : "Value"}
              </span>
              {FIELDS[draft.field].value === "codes" ? (
                <span className="row gap-2 wrap" style={{ paddingTop: 6 }}>
                  {(Object.keys(PROPERTY_TYPES) as PropertyType[]).map((t) => (
                    <label key={t} className="row gap-1 t-xs">
                      <input type="checkbox" style={{ width: 16, height: 16, flex: "none" }} checked={draft.types.includes(t)}
                        onChange={(e) => setDraft({ ...draft, types: e.target.checked ? [...draft.types, t] : draft.types.filter((x) => x !== t) })} />
                      {PROPERTY_TYPES[t]}
                    </label>
                  ))}
                </span>
              ) : FIELDS[draft.field].value === "yesno" ? (
                <select className="input" value={draft.raw} onChange={(e) => setDraft({ ...draft, raw: e.target.value })}>
                  <option value="yes">Has one</option>
                  <option value="no">Does not have one</option>
                </select>
              ) : (
                <input className="input" value={draft.raw}
                  inputMode={["money", "count", "half", "acres"].includes(FIELDS[draft.field].value) ? "decimal" : "text"}
                  onChange={(e) => setDraft({ ...draft, raw: e.target.value })} />
              )}
            </label>
          </div>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            <label className="field" style={{ flex: "1 1 150px" }}>
              <span className="label">Requirement or preference</span>
              <select className="input" value={draft.strength} onChange={(e) => setDraft({ ...draft, strength: e.target.value as Strength })}>
                <option value="hard">Requirement: exclude homes without it</option>
                <option value="preference">Preference: nice to have</option>
                <option value="undecided">Not decided yet</option>
              </select>
            </label>
            {client ? null : <>
            <label className="field" style={{ flex: "1 1 140px" }}>
              <span className="label">Who said it</span>
              <input className="input" value={draft.statedBy} maxLength={80} onChange={(e) => setDraft({ ...draft, statedBy: e.target.value })} />
            </label>
            <label className="field" style={{ flex: "0 1 150px" }}>
              <span className="label">When</span>
              <input className="input" type="date" value={draft.statedAt} onChange={(e) => setDraft({ ...draft, statedAt: e.target.value })} />
            </label>
            <label className="field" style={{ flex: "1 1 160px" }}>
              <span className="label">Where it came from</span>
              <input className="input" value={draft.sourceRef} maxLength={120} onChange={(e) => setDraft({ ...draft, sourceRef: e.target.value })} />
            </label>
            </>}
          </div>
          {draftError && (draft.raw || draft.types.length) ? <p className="t-xs c-neg" style={{ marginTop: 8 }}>{draftError}</p> : null}
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={Boolean(draftError)} onClick={commitDraft}>
              {draft.id ? "Update" : "Add"}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-s btn-sm" style={{ marginTop: 10 }} onClick={() => setDraft(blank())}>Add a criterion</button>
      )}

      <div style={{ marginTop: 16 }}>
        <div className="t-sm w6">Open questions</div>
        <p className="t-2xs c-4" style={{ marginTop: 2 }}>Anything not settled yet. Each one blocks approval until it is answered and removed.</p>
        {questions.length ? (
          <ul style={{ marginTop: 6, display: "grid", gap: 4 }}>
            {questions.map((q) => (
              <li key={q} className="between gap-2 t-sm">
                <span>{q}</span>
                <button className="btn btn-g btn-sm" onClick={() => setQuestions((l) => l.filter((x) => x !== q))}>Answered</button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="row gap-2" style={{ marginTop: 6 }}>
          <input className="input" placeholder="Is Lilburn a real option, or a maybe?" value={question} maxLength={300}
            onChange={(e) => setQuestion(e.target.value)} aria-label="New open question" />
          <button className="btn btn-s btn-sm" disabled={!question.trim()}
            onClick={() => { setQuestions((l) => [...new Set([...l, question.trim()])]); setQuestion(""); }}>Add question</button>
        </div>
      </div>

      {dirty && !arriving ? (
        <div className="card p-3" style={{ marginTop: 16 }}>
          <label className="field">
            <span className="label">{client ? "Tell your agent why (optional)" : "What changed, for the history (optional)"}</span>
            <input className="input" value={note} maxLength={2000} placeholder="Raised the maximum after the lender call"
              onChange={(e) => setNote(e.target.value)} />
          </label>
          {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : saveLabel ?? `Save as revision ${(latest?.revision ?? 0) + 1}`}
            </button>
            <button className="btn btn-g btn-sm" disabled={pending}
              onClick={() => { setCriteria(latest?.criteria ?? []); setQuestions(latest?.questions ?? []); setError(null); }}>
              Discard changes
            </button>
          </div>
        </div>
      ) : saved ? (
        <p role="status" className="t-xs c-pos" style={{ marginTop: 12 }}>
          Saved as revision {saved}.{arriving ? " Updating the page…" : ""}
        </p>
      ) : null}

      {!client && criteria.length && blockers.length ? (
        <div style={{ marginTop: 14 }}>
          <div className="t-xs w6">Before this can be approved as a search</div>
          <ul className="t-xs c-3" style={{ marginTop: 4, display: "grid", gap: 3, lineHeight: 1.5 }}>
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
