"use client";

import { useState } from "react";
import { useRefresh } from "@/components/rift/useRefresh";
import { HomeCard, type HomeCardData } from "@/components/rift/HomeCard";
import { AddHome, type HomeInput } from "@/components/rift/AddHome";
import { REACTION_LABEL, limitingRequirements, type Reaction, type SearchCriterion } from "@/lib/core/search";
import { OFFER_LABEL, type OfferInterest } from "@/lib/core/tour";
import { post } from "../../post";

const REACTIONS: Reaction[] = ["interested", "maybe", "pass", "tour-requested"];

/**
 * The shortlist, for the buyer: react, say why if you like, add a home you
 * found. Each person's reaction is their own and stays visible next to
 * everyone else's (AT14). A reaction is a message to the agent, not a filter.
 */
/** A showing as the buyer may see it: worded on the server (lib/core/tour
 *  `buyerLabel`), so the agent's notes and ShowingTime references never
 *  reach this page. */
export interface BuyerShowing {
  stopId: string;
  homeId: string;
  open: boolean;
  completed: boolean;
  label: string;
  answeredByMe: boolean;
  /** Their own latest answer after it, worded; nobody else's. */
  myAnswer: string | null;
}

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

export function ClientHomes({ journeyId, homes, criteria, me, canRespond, showings, agentFirst }: {
  journeyId: string;
  homes: HomeCardData[];
  criteria: SearchCriterion[];
  me: string;
  canRespond: boolean;
  showings: BuyerShowing[];
  agentFirst: string;
}) {
  const refresh = useRefresh(JSON.stringify(homes) + JSON.stringify(showings));
  const [asking, setAsking] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [req, setReq] = useState(newRequest);
  const [answer, setAnswer] = useState<Record<string, { offer: OfferInterest | null; reason: string; change: string }>>({});
  const [thanks, setThanks] = useState<string | null>(null);
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

  const askToSee = async (homeId: string) => {
    setBusy(homeId);
    const r = await post({ action: "request-tour", journeyId, homeId, availability: when, requestId: req });
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "That did not send."); return; }
    setError(null);
    setReq(newRequest());
    setAsking(null);
    setWhen("");
    setSaved(homeId);
    refresh();
  };

  const sendAnswer = async (stopId: string) => {
    const a = answer[stopId];
    if (!a?.offer) return;
    setBusy(stopId);
    const r = await post({ action: "tour-feedback", journeyId, stopId, offer: a.offer, reason: a.reason, searchChange: a.change });
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "That did not save."); return; }
    setError(null);
    setThanks(stopId);
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
      {(() => {
        /* SEARCH-09: say what limits the search when nothing fits, and never
           widen it on the buyer's behalf. */
        const limit = limitingRequirements(live, criteria);
        if (!limit) return null;
        return (
          <div className="card p-3" role="status" style={{ marginBottom: 10, background: "var(--sunk)" }}>
            <div className="t-sm w6">None of the {limit.total} home{limit.total === 1 ? "" : "s"} here meets every must-have</div>
            <ul className="t-sm" style={{ marginTop: 6, display: "grid", gap: 3 }}>
              {limit.limits.map((l) => <li key={l.text}>{l.text} <span className="c-4">rules out {l.rulesOut} of {limit.total}</span></li>)}
            </ul>
            <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>
              Your search is not widened for you. If one of these could be a nice-to-have instead, change it in your priorities,
              or talk it through with {agentFirst}.
            </p>
          </div>
        );
      })()}
      {live.length === 0 ? (
        <p className="t-sm c-3">No homes here yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {live.map((h) => {
            const mine = h.current.find((r) => r.memberId === me) ?? null;
            const showing = showings.find((x) => x.homeId === h.id && x.open) ?? null;
            // Newest first, so this is the last one that finished. Asking again stays possible.
            const lastShowing = showing ? null : showings.find((x) => x.homeId === h.id) ?? null;
            const toAnswer = showings.find((x) => x.homeId === h.id && x.completed && !x.answeredByMe) ?? null;
            const a = toAnswer ? answer[toAnswer.stopId] ?? { offer: null, reason: "", change: "" } : null;
            return (
              <HomeCard key={h.id} home={h} criteria={criteria}>
                {showing ? (
                  <p role="status" className="t-xs" style={{ marginTop: 10, lineHeight: 1.55 }}>
                    <span className="w6">Showing:</span> {showing.label}
                  </p>
                ) : lastShowing ? (
                  <p className="t-xs c-3" style={{ marginTop: 10, lineHeight: 1.55 }}>
                    <span className="w6">Showing:</span> {lastShowing.label}
                    {lastShowing.myAnswer ? ` You told ${agentFirst}: ${lastShowing.myAnswer.toLowerCase()}.` : ""}
                  </p>
                ) : null}
                {toAnswer && a && canRespond ? (
                  thanks === toAnswer.stopId ? (
                    <p role="status" className="t-xs c-pos" style={{ marginTop: 10 }}>Thank you. {agentFirst} has your answer.</p>
                  ) : (
                    <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
                      <div className="t-sm w6">You saw it. Would you consider an offer?</div>
                      <div className="row gap-2 wrap" style={{ marginTop: 8 }} role="group" aria-label={`Would you consider an offer on ${h.address}`}>
                        {(Object.keys(OFFER_LABEL) as OfferInterest[]).map((o) => (
                          <button key={o} className={`btn btn-sm ${a.offer === o ? "btn-p" : "btn-s"}`} style={{ minHeight: 44 }}
                            aria-pressed={a.offer === o} onClick={() => setAnswer({ ...answer, [toAnswer.stopId]: { ...a, offer: o } })}>
                            {o === "yes" ? "Yes" : o === "maybe" ? "Maybe" : "No"}
                          </button>
                        ))}
                      </div>
                      <input className="input" style={{ marginTop: 8 }} placeholder="Why? (optional)" maxLength={500} value={a.reason}
                        aria-label={`Why, after seeing ${h.address}`} onChange={(e) => setAnswer({ ...answer, [toAnswer.stopId]: { ...a, reason: e.target.value } })} />
                      <input className="input" style={{ marginTop: 6 }} placeholder="Anything that should change in your search? (optional)" maxLength={500}
                        value={a.change} aria-label="What should change in your search"
                        onChange={(e) => setAnswer({ ...answer, [toAnswer.stopId]: { ...a, change: e.target.value } })} />
                      <button className="btn btn-p btn-sm" style={{ marginTop: 8, minHeight: 44 }} disabled={!a.offer || busy === toAnswer.stopId}
                        onClick={() => sendAnswer(toAnswer.stopId)}>
                        {busy === toAnswer.stopId ? "Sending…" : `Send to ${agentFirst}`}
                      </button>
                    </div>
                  )
                ) : null}
                {canRespond ? (
                  <div style={{ marginTop: 10 }}>
                    <input className="input" placeholder="Why? (optional)" maxLength={500} value={reason[h.id] ?? ""}
                      onChange={(e) => setReason({ ...reason, [h.id]: e.target.value })} aria-label={`Why, for ${h.address}`} />
                    <div className="row gap-2 wrap" style={{ marginTop: 8 }} role="group" aria-label={`Your reaction to ${h.address}`}>
                      {REACTIONS.map((r) => (
                        <button key={r} className={`btn btn-sm ${mine?.reaction === r ? "btn-p" : "btn-s"}`}
                          style={{ minHeight: 44 }} aria-pressed={mine?.reaction === r}
                          disabled={busy === h.id || (r === "tour-requested" && showing !== null)}
                          onClick={() => (r === "tour-requested" ? setAsking(asking === h.id ? null : h.id) : react(h.id, r))}>
                          {REACTION_LABEL[r]}
                        </button>
                      ))}
                    </div>
                    {asking === h.id ? (
                      <div style={{ marginTop: 8 }}>
                        <input className="input" placeholder="When could you go? (optional)" maxLength={300} value={when}
                          aria-label={`When could you go to see ${h.address}`} onChange={(e) => setWhen(e.target.value)} />
                        <button className="btn btn-p btn-sm" style={{ marginTop: 8, minHeight: 44 }} disabled={busy === h.id}
                          onClick={() => askToSee(h.id)}>
                          {busy === h.id ? "Sending…" : `Ask ${agentFirst} for a showing`}
                        </button>
                        <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
                          This asks; it does not book. {agentFirst} arranges the time and it shows here once confirmed.
                        </p>
                      </div>
                    ) : null}
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
