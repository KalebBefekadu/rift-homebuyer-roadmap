"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STAGE_NAMES, type Stage } from "@/lib/core/pipeline";
import { createLead } from "../actions";

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
  "Met in person — they asked me to follow up",
  "Open house sign-in",
];

export function AddLead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [stage, setStage] = useState<Stage>("Exploring");
  const [basis, setBasis] = useState("");
  const [note, setNote] = useState("");

  const reachable = email.trim() || phone.trim();
  const ready = name.trim() && reachable && basis.trim();

  const submit = () => {
    if (!ready) return;
    setError(null);
    start(async () => {
      const r = await createLead({
        name, email: email.trim() || undefined, phone: phone.trim() || undefined,
        side, stage, contactBasis: basis, note: note.trim() || undefined,
      });
      if (!r.ok) { setError(r.error); return; }
      router.push(`/studio/lead/${r.id}`);
    });
  };

  return (
    <main className="shell-w" style={{ paddingTop: 26, paddingBottom: 80, maxWidth: 620 }}>
      <Link href="/studio" className="t-sm c-3">← Studio</Link>

      <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em", marginTop: 14 }}>
        Add someone
      </h1>
      <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>
        For people you are already working with. They will not be scored — a score explains a set
        of funnel answers, and inventing one for somebody who never answered anything would put a
        made-up number beside a real person.
      </p>

      {error ? (
        <div className="card p-4" style={{ marginTop: 18, borderColor: "var(--neg)" }}>
          <div className="t-sm w6">That did not save.</div>
          <p className="t-sm c-3" style={{ marginTop: 4 }}>{error}</p>
        </div>
      ) : null}

      <div className="card p-5" style={{ marginTop: 20 }}>
        <label className="field">
          <span className="t-sm c-3">Their name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <div className="grid-2 gap-3" style={{ marginTop: 14 }}>
          <label className="field">
            <span className="t-sm c-3">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="t-sm c-3">Phone</span>
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
        {!reachable ? (
          <p className="t-xs c-4" style={{ marginTop: 6 }}>One of the two is enough.</p>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <span className="t-sm c-3">Buying or selling?</span>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            {(["buy", "sell"] as const).map((s) => (
              <button key={s} className={`btn btn-sm ${side === s ? "btn-p" : "btn-s"}`} onClick={() => setSide(s)}>
                {s === "buy" ? "Buying" : "Selling"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <span className="t-sm c-3">Where are they now?</span>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            {STAGE_NAMES.map((s) => (
              <button key={s} className={`btn btn-sm ${stage === s ? "btn-p" : "btn-s"}`} onClick={() => setStage(s as Stage)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <span className="t-sm c-3">Why can you contact them?</span>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            {BASIS.map((b) => (
              <button key={b} className={`btn btn-sm ${basis === b ? "btn-p" : "btn-s"}`} onClick={() => setBasis(b)}>
                {b}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ marginTop: 10 }}
            placeholder="Or write it in your own words"
            value={BASIS.includes(basis) ? "" : basis}
            onChange={(e) => setBasis(e.target.value)}
          />
          <p className="t-xs c-4" style={{ marginTop: 8, lineHeight: 1.55 }}>
            Recorded against the person. When automated follow-up eventually runs against these
            records, this is the line that says a human decided it was allowed.
          </p>
        </div>

        <label className="field" style={{ marginTop: 18 }}>
          <span className="t-sm c-3">What do you already know? (optional)</span>
          <textarea
            className="input"
            rows={4}
            style={{ resize: "vertical", lineHeight: 1.55 }}
            placeholder="Renting in Kirkwood until June. Pre-approved with SunTrust. Two kids, wants Decatur schools."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <button
          className="btn btn-p btn-lg"
          style={{ width: "100%", marginTop: 20 }}
          disabled={!ready || pending}
          onClick={submit}
        >
          {pending ? "Adding…" : "Add them"}
        </button>
      </div>
    </main>
  );
}
