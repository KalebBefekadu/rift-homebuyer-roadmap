"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { PROFILE, PROFILE_FIELDS, type AgentProfile, type ProfileField } from "@/lib/core/profile";
import { saveProfile } from "./actions";
import s from "./settings.module.css";

type Draft = Record<ProfileField, string>;
const toDraft = (p: AgentProfile): Draft =>
  Object.fromEntries(PROFILE_FIELDS.map((f) => [f, p[f] ?? ""])) as Draft;

/**
 * The agent's details, as one form.
 *
 * One Save for the five, unlike the rules: these are facts about the same
 * person rather than separate judgements with separate owners, and saving a
 * phone number should not take five clicks.
 *
 * Every field says where it shows before the agent types into it, including
 * the three that show nowhere yet. The page's rule (RULE_REACH) applies here
 * too: recorded is honest, "in use" when it is not would be the failure.
 */
export function ProfileForm({ profile }: { profile: AgentProfile }) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(profile));
  const [draft, setDraft] = useState<Draft>(saved);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; field?: ProfileField } | null>(null);

  const dirty = PROFILE_FIELDS.some((f) => draft[f].trim() !== saved[f].trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const r = await saveProfile(draft);
      if (!r.ok) {
        setResult({ ok: false, text: r.error, field: "field" in r ? r.field : undefined });
        return;
      }
      setSaved(draft);
      setResult({
        ok: true,
        text: r.changed ? `Saved. ${r.changed} change${r.changed === 1 ? "" : "s"} recorded.` : "Nothing had changed, so nothing was recorded.",
      });
    });
  };

  return (
    <form className={s.card} onSubmit={submit} noValidate>
      <div className={s.fields}>
        {PROFILE_FIELDS.map((f) => {
          const spec = PROFILE[f];
          const bad = result && !result.ok && result.field === f;
          return (
            <div key={f} className={s.field}>
              <label htmlFor={`profile-${f}`} className={s.fieldLabel}>
                {spec.label}{spec.required ? null : <span>Optional</span>}
              </label>
              <div>
                <input
                  id={`profile-${f}`}
                  name={f}
                  className={`input ${s.fieldInput}${bad ? ` ${s.fieldInputBad}` : ""}`}
                  value={draft[f]}
                  maxLength={spec.max}
                  type={f === "email" ? "email" : f === "phone" ? "tel" : "text"}
                  autoComplete={f === "name" ? "name" : f === "email" ? "email" : f === "phone" ? "tel" : "off"}
                  aria-invalid={bad ? true : undefined}
                  aria-describedby={`profile-${f}-reach`}
                  onChange={(e) => { setDraft({ ...draft, [f]: e.target.value }); if (result) setResult(null); }}
                />
                <p className="t-xs c-4" style={{ marginTop: 5, lineHeight: 1.5 }}>{spec.hint}</p>
                <p id={`profile-${f}-reach`} className={`${s.rowNote}${spec.reach.live ? "" : ` ${s.rowNoteWarn}`}`}>
                  {spec.reach.live ? <Ico.checkCircle size={11} /> : <Ico.alert size={11} />}
                  <span>{spec.reach.live ? "In use: " : ""}{spec.reach.where}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className={s.formFoot}>
        <span className={`${s.message} ${result ? (result.ok ? "c-pos" : "c-neg") : "c-4"}`} role={result ? "status" : undefined}>
          {result ? (result.ok ? <Ico.checkCircle size={13} /> : <Ico.alert size={13} />) : null}
          {result ? result.text : "Each change is recorded with your name and the time."}
        </span>
        <div className="row gap-2">
          {dirty ? (
            <button type="button" className="btn btn-g btn-sm" disabled={pending} onClick={() => { setDraft(saved); setResult(null); }}>
              Undo
            </button>
          ) : null}
          <button type="submit" className="btn btn-p btn-sm" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
