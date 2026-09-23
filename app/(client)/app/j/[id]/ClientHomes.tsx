"use client";

import { useState } from "react";
import { useRefresh } from "@/components/rift/useRefresh";
import { HomeCard, type HomeCardData } from "@/components/rift/HomeCard";
import { AddHome, type HomeInput } from "@/components/rift/AddHome";
import { REACTION_LABEL, type Reaction, type SearchCriterion } from "@/lib/core/search";
import { post } from "../../post";

const REACTIONS: Reaction[] = ["interested", "maybe", "pass", "tour-requested"];

/**
 * The shortlist, for the buyer: react, say why if you like, add a home you
 * found. Each person's reaction is their own and stays visible next to
 * everyone else's (AT14). A reaction is a message to the agent, not a filter.
 */
export function ClientHomes({ journeyId, homes, criteria, me, canRespond }: {
  journeyId: string;
  homes: HomeCardData[];
  criteria: SearchCriterion[];
  me: string;
  canRespond: boolean;
}) {
  const refresh = useRefresh(JSON.stringify(homes));
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const live = homes.filter((h) => !h.withdrawnAt);

  const react = async (homeId: string, reaction: Reaction) => {
    setBusy(homeId);
    const r = await post({ action: "react", journeyId, homeId, reaction, reason: reason[homeId] ?? null });
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "That did not save."); return; }
    setError(null);
    setSaved(homeId);
    refresh();
  };

  const add = async (h: HomeInput): Promise<string | null> => {
    setBusy("add");
    const r = await post({ action: "add-home", journeyId, home: h });
    setBusy(null);
    if (!r.ok) return r.error ?? "That did not save.";
    setAdding(false);
    refresh();
    return null;
  };

  return (
    <div style={{ marginTop: 10 }}>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginBottom: 8 }}>{error}</p> : null}
      {live.length === 0 ? (
        <p className="t-sm c-3">No homes here yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {live.map((h) => {
            const mine = h.current.find((r) => r.memberId === me) ?? null;
            return (
              <HomeCard key={h.id} home={h} criteria={criteria}>
                {canRespond ? (
                  <div style={{ marginTop: 10 }}>
                    <input className="input" placeholder="Why? (optional)" maxLength={500} value={reason[h.id] ?? ""}
                      onChange={(e) => setReason({ ...reason, [h.id]: e.target.value })} aria-label={`Why, for ${h.address}`} />
                    <div className="row gap-2 wrap" style={{ marginTop: 8 }} role="group" aria-label={`Your reaction to ${h.address}`}>
                      {REACTIONS.map((r) => (
                        <button key={r} className={`btn btn-sm ${mine?.reaction === r ? "btn-p" : "btn-s"}`}
                          style={{ minHeight: 44 }} aria-pressed={mine?.reaction === r}
                          disabled={busy === h.id} onClick={() => react(h.id, r)}>
                          {REACTION_LABEL[r]}
                        </button>
                      ))}
                    </div>
                    {saved === h.id ? <p role="status" className="t-2xs c-pos" style={{ marginTop: 6 }}>Saved.</p> : null}
                  </div>
                ) : null}
              </HomeCard>
            );
          })}
        </div>
      )}

      {canRespond ? (
        <div style={{ marginTop: 12 }}>
          {adding ? (
            <>
              <AddHome onAdd={add} busy={busy === "add"} sourceDefault="The listing" />
              <button className="btn btn-g btn-sm" style={{ marginTop: 6 }} onClick={() => setAdding(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-s btn-sm" onClick={() => setAdding(true)}>Add a home you found</button>
          )}
        </div>
      ) : null}
    </div>
  );
}
