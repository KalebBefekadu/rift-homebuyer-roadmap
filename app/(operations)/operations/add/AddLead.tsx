"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Stage } from "@/lib/core/pipeline";
import { startingStagesFor, sourceLabel } from "@/lib/core/people";
import { Ico } from "@/components/rift/icons";
import { Notice } from "../ui";
import { createLead, type Same } from "./actions";
import css from "./add.module.css";

/**
 * Putting somebody in by hand.
 *
 * The form asks for the least that makes a record useful, and one thing that
 * is easy to resent: why this person can be contacted. It is required because
 * an automated follow-up will eventually run against these records, and the
 * moment it does, "I know them" needs to have been written down by a person
 * rather than assumed by a system.
 */

const BASIS = [
  "Existing client",
  "Past client",
  "They contacted me",
  "Referred by a client",
  "Met in person, they asked me to follow up",
  "Open house sign-in",
];

export function AddLead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [same, setSame] = useState<Same[] | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [stage, setStage] = useState<Stage>("Exploring");
  const [basis, setBasis] = useState("");
  const [note, setNote] = useState("");

  const reachable = email.trim() || phone.trim();
  const ready = Boolean(name.trim() && reachable && basis.trim());

  /* Said next to the button, because a grey button that does not say what is
     missing is a button that looks broken. */
  const missing = [
    !name.trim() ? "their name" : null,
    !reachable ? "an email or a phone number" : null,
    !basis.trim() ? "why you can contact them" : null,
  ].filter(Boolean) as string[];

  const submit = (addAnyway = false) => {
    if (!ready) return;
    setError(null);
    start(async () => {
      const r = await createLead({
        name, email: email.trim() || undefined, phone: phone.trim() || undefined,
        side, stage, contactBasis: basis, note: note.trim() || undefined,
      }, addAnyway);
      if (r.ok) { router.push(`/operations/lead/${r.id}`); return; }
      if ("same" in r && r.same) { setSame(r.same); return; }
      setSame(null);
      setError("error" in r ? r.error : "That did not save.");
    });
  };

  return (
    <div className={css.form}>
      {error ? <Notice tone="neg" title="That did not save.">{error}</Notice> : null}

      {same ? (
        <Notice tone="warn" title={same.length === 1 ? "Somebody with these details is already on record" : "People with these details are already on record"}>
          A second record splits their history, plan and follow-up between two people who are one.
          <div className={css.same}>
            {same.map((p) => (
              <div key={p.id} className={css.sameRow}>
                <Link className="u w6" href={`/operations/lead/${p.id}`} target="_blank">{p.name?.trim() || p.email || "Unnamed"}</Link>
                <span className="c-4">{p.stage ?? "Not picked up"}</span>
                <span className="c-4">{[p.email, p.phone].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </Notice>
      ) : null}

      <div className="card p-5">
        <div className={css.form}>
          <fieldset className={css.group} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className={css.legend}>Who they are</legend>
            <label className="field">
              <span className="label">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
            </label>
            <div className={css.pair}>
              <label className="field">
                <span className="label">Email</span>
                <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSame(null); }} autoComplete="off" />
              </label>
              <label className="field">
                <span className="label">Phone</span>
                <input className="input" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSame(null); }} autoComplete="off" />
              </label>
            </div>
            <p className={css.help}>One of the two is enough.</p>
          </fieldset>

          <fieldset className={css.group} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className={css.legend}>Where they are</legend>
            <div className={css.choices} role="group" aria-label="Buying or selling">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} type="button" className={`btn btn-sm ${side === s ? "btn-p" : "btn-s"}`} aria-pressed={side === s}
                  onClick={() => {
                    setSide(s);
                    /* A stage that does not exist on the other side must not
                       survive the switch: "Searching" on a seller. */
                    if (!startingStagesFor(s).includes(stage)) setStage("Exploring");
                  }}>
                  {side === s ? <Ico.check size={13} /> : null}{s === "buy" ? "Buying" : "Selling"}
                </button>
              ))}
            </div>
            <label className="field" style={{ maxWidth: 280 }}>
              <span className="label">Stage</span>
              <select className="input select" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
                {startingStagesFor(side).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </fieldset>

          <fieldset className={css.group} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className={css.legend}>Why you can contact them</legend>
            <div className={css.choices}>
              {BASIS.map((b) => (
                <button key={b} type="button" className={`btn btn-sm ${basis === b ? "btn-p" : "btn-s"}`} aria-pressed={basis === b} onClick={() => setBasis(b)}>
                  {basis === b ? <Ico.check size={13} /> : null}{b}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Or write it in your own words"
              aria-label="Why you can contact them, in your own words"
              value={BASIS.includes(basis) ? "" : basis}
              onChange={(e) => setBasis(e.target.value)}
            />
            <p className={css.help}>
              Recorded against the person. When automated follow-up eventually runs against these
              records, this is the line that says a human decided it was allowed.
            </p>
          </fieldset>

          <label className={css.group}>
            <span className={css.legend}>What you already know<span className={css.req}>Optional</span></span>
            <textarea
              className="input"
              rows={4}
              style={{ resize: "vertical", lineHeight: 1.55, height: "auto" }}
              placeholder="Renting in Kirkwood until June. Pre-approved with SunTrust. Two kids, wants Decatur schools."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className={css.footer}>
            <div className="row gap-2 wrap">
              <button className="btn btn-p" disabled={!ready || pending} onClick={() => submit(false)}>
                {pending ? "Adding…" : "Add them"}
              </button>
              {same ? (
                <button className="btn btn-s" disabled={!ready || pending} onClick={() => submit(true)}>
                  They are different people, add anyway
                </button>
              ) : null}
            </div>
            {!ready ? <p className={css.missing}>Still needed: {missing.join(", ")}.</p> : null}
            <p className={css.help}>Source is recorded as &ldquo;{sourceLabel("manual")}&rdquo;.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
