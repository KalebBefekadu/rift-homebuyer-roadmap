"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOT_ACCEPTANCE, CLIENT_NOTE_MAX } from "@/lib/core/offer-room";

/**
 * "This is the one I want."
 *
 * One control below the offers rather than a button on each card, because the
 * cards are the comparison and a button on every one of them invites a tap
 * while still reading. Choosing is two steps — pick, then confirm — and the
 * confirm step carries the sentence that matters most: this is not signing.
 *
 * Every figure shown here was computed on the server and arrives as a string.
 * The action records what the server computes, not what this sends.
 */
export function Choose({ token, agentFirst, options }: {
  token: string;
  agentFirst: string;
  options: { id: string; label: string; detail: string }[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const picked = options.find((o) => o.id === pick) ?? null;

  /* The confirmation is shown from HERE, the moment the server says the
     choice is stored — not left to a refresh arriving. The refresh then
     swaps in the server-rendered record; if it is slow, the seller has
     already been told. A seller who sees nothing taps again. */
  const confirm = async () => {
    if (!pick || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/plan/choose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, offerId: pick, note }),
      });
      const r = (await res.json().catch(() => null)) as { ok?: boolean; stored?: boolean; error?: string } | null;
      if (!r?.ok || r.stored !== true) {
        setError(r?.error ?? "We could not record that just now. Nothing was sent — please try again in a minute.");
        return;
      }
      setError(null);
      setDone(picked!.label);
      router.refresh();
    } catch {
      setError("We could not reach the server. Nothing was sent — check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="card p-4" style={{ marginTop: 14, borderColor: "var(--pos-line)" }}>
        <div className="t-sm w6">You told {agentFirst} you want the offer from {done}</div>
        <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
          Recorded with the figures above. {NOT_ACCEPTANCE}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4" style={{ marginTop: 14 }}>
      <div className="t-sm w6">When you know which one you want</div>
      <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
        Tell {agentFirst} here and it is recorded with the figures above, exactly as you saw them.
      </p>

      <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
        <legend className="sr-only">Which offer</legend>
        <div className="col gap-2">
          {options.map((o) => (
            <label key={o.id} className="card p-3 row gap-3" style={{
              cursor: "pointer", alignItems: "flex-start",
              borderColor: pick === o.id ? "var(--ink)" : undefined,
            }}>
              <input
                type="radio" name="offer" value={o.id}
                checked={pick === o.id}
                onChange={() => { setPick(o.id); setError(null); }}
                /* Sized here: the shared stylesheet gives every input a
                   full width, which on a radio pushed the offer's name off
                   into the right half of the card at phone width. */
                style={{ marginTop: 3, width: 16, height: 16, flex: "none" }}
              />
              <span style={{ minWidth: 0 }}>
                <span className="t-sm w6" style={{ display: "block" }}>{o.label}</span>
                <span className="t-xs c-4" style={{ display: "block", marginTop: 2 }}>{o.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {picked ? (
        <div style={{ marginTop: 14 }}>
          <label className="t-xs c-3" htmlFor="choose-note" style={{ display: "block", marginBottom: 6 }}>
            Anything {agentFirst} should know (optional)
          </label>
          <textarea
            id="choose-note" className="ta" value={note} maxLength={CLIENT_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)} style={{ minHeight: 70 }}
          />
          <p className="t-xs c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>
            <span className="w6">{NOT_ACCEPTANCE}</span>
          </p>
          <button className="btn btn-p" style={{ marginTop: 10, width: "100%" }} disabled={pending} onClick={() => void confirm()}>
            {pending ? "Recording…" : `Tell ${agentFirst} I want the offer from ${picked.label}`}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="t-sm c-neg" style={{ marginTop: 10, lineHeight: 1.5 }}>{error}</p>
      ) : null}
    </div>
  );
}
