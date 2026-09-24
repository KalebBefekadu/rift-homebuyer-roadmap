"use client";

import { useState } from "react";
import { HomeCard, type HomeCardData } from "@/components/rift/HomeCard";
import { AddHome, type HomeInput } from "@/components/rift/AddHome";
import type { SearchCriterion } from "@/lib/core/search";
import { useWrite } from "./useWrite";

/**
 * The shortlist, from the agent's side: add a home by link and facts, see
 * everyone's reactions, take a home off the list with a reason. Reactions
 * never change the brief; if they point at a new preference, that is a new
 * revision he saves and approves (REQ-SEARCH-06).
 */
export function Homes({ journeyId, homes, criteria, against }: {
  journeyId: string;
  homes: HomeCardData[];
  criteria: SearchCriterion[];
  against: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [showOff, setShowOff] = useState(false);
  const { busy, error, setError, write } = useWrite(homes.map((h) => `${h.id}:${h.withdrawnAt}`).join("|"));
  const live = homes.filter((h) => !h.withdrawnAt);
  const off = homes.filter((h) => h.withdrawnAt);

  const add = async (h: HomeInput): Promise<string | null> => {
    const r = await write("add-home", { journeyId, home: h });
    /* The form shows its own refusal; not twice. */
    if (!r.ok) { setError(null); return r.error ?? "That did not work"; }
    setAdding(false);
    return null;
  };

  return (
    <div>
      <p className="t-2xs c-4">
        {against ? `Compared with ${against}.` : "Nothing approved yet, so homes are not compared against requirements."}
      </p>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}

      {live.length === 0 ? (
        <p className="t-xs c-4" style={{ marginTop: 8 }}>No homes on the list yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {live.map((h) => (
            <HomeCard key={h.id} home={h} criteria={criteria}>
              <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} disabled={busy}
                onClick={() => {
                  const why = prompt("Why is it coming off the list? (sold, they passed, withdrawn)");
                  if (!why?.trim()) return;
                  void write("take-off", { journeyId, homeId: h.id, reason: why });
                }}>
                Take off the list
              </button>
            </HomeCard>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {adding ? (
          <>
            <AddHome onAdd={add} busy={busy} sourceDefault="Matrix listing" />
            <button className="btn btn-g btn-sm" style={{ marginTop: 6 }} onClick={() => setAdding(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn-s btn-sm" onClick={() => setAdding(true)}>Add a home</button>
        )}
      </div>

      {off.length ? (
        <div style={{ marginTop: 12 }}>
          <button className="t-2xs c-3 u" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
            onClick={() => setShowOff(!showOff)}>
            {showOff ? "Hide" : "Show"} homes taken off the list ({off.length})
          </button>
          {showOff ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {off.map((h) => <HomeCard key={h.id} home={h} criteria={criteria} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
