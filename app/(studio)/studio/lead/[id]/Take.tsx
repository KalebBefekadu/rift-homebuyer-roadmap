"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { money } from "@/lib/core/compute";
import type { Offer, SellerCosts } from "@/lib/core/offers";
import {
  draftTake, canApprove, takeIsCurrent, wasEdited, RECOMMENDATION_MARKER, TAKE_MAX,
  type OfferRoom,
} from "@/lib/core/offer-room";
import { approveOfferTake, withdrawOfferTake, reopenOfferChoice } from "../../actions";

const AT = (iso: string) => new Date(iso).toLocaleString("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

/**
 * The offer room, from the agent's side: his take, and the seller's choice.
 *
 * Rift drafts what it can compute and stops at the judgement. The bracketed
 * line is his to write and approval is refused while it is still there — see
 * lib/core/offer-room.ts for why a machine's ranking must never reach a seller
 * dressed as their agent's advice.
 *
 * The status line is the point of the panel. "The seller sees this", "the
 * seller does not see this", and "the seller USED to see this but you have
 * released an offer since" are three different states, and the third is the
 * one an agent would not otherwise know he was in.
 */
export function Take({ leadId, offers, costs, room }: {
  leadId: string;
  offers: Offer[];
  costs: SellerCosts | null;
  room: OfferRoom | null;
}) {
  const released = offers.filter((o) => o.releasedAt);
  const draft = draftTake(released, costs);
  const current = room ? takeIsCurrent(room, released) : false;
  const stale = Boolean(room?.take) && !current;
  const edited = room ? wasEdited(room) : null;

  const [text, setText] = useState(current && room?.take ? room.take : draft ?? "");
  const [error, setError] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await fn();
    setError(r.ok ? null : r.error ?? "that did not work");
  });

  const blocked = canApprove(text, released);
  const chosen = room?.chosenSeen ?? null;

  return (
    <section className="card p-4" style={{ marginTop: 18 }}>
      <div className="t-md w6">Offer room</div>
      <div className="t-xs c-4" style={{ marginTop: 2 }}>
        Your take on the released offers, and which one the seller says they want.
      </div>

      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 10 }}>{error}</p> : null}

      {/* The seller's choice first, when there is one — it is the thing with a
          deadline attached. */}
      {room === null ? (
        <p className="t-xs c-4" style={{ marginTop: 12 }}>
          The offer room did not load. That is not the same as the seller not having chosen —
          reload before telling anybody anything.
        </p>
      ) : chosen && room.chosenAt ? (
        <div className="card p-4" style={{ marginTop: 14, borderColor: "var(--pos-line)", background: "var(--pos-wash)" }}>
          <div className="between gap-2 wrap" style={{ alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div className="t-sm w6">They chose {chosen.from} · {AT(room.chosenAt)}</div>
              <p className="t-xs c-2" style={{ marginTop: 4, lineHeight: 1.6 }}>
                Shown {money(chosen.price)} offered
                {chosen.net !== null ? `, about ${money(chosen.net)} to them` : ", no net (payoff not recorded)"}
                {chosen.bestNet === true ? ` — the best net of ${chosen.of}` : chosen.bestNet === false ? ` — not the best net of ${chosen.of}` : ""}.
                {" "}{chosen.take ? "Your take was on the page." : "No take of yours was on the page."}
              </p>
              {room.clientNote ? (
                <p className="t-sm c-2" style={{ marginTop: 6 }}>&ldquo;{room.clientNote}&rdquo;</p>
              ) : null}
              <p className="t-2xs c-4" style={{ marginTop: 6 }}>
                Their choice, not an acceptance. They were told nothing is binding until they sign.
              </p>
            </div>
            <button className="btn btn-s btn-sm" disabled={pending}
              onClick={() => { if (confirm("Reopen their choice? They will be able to choose again.")) run(() => reopenOfferChoice(leadId)); }}>
              Reopen
            </button>
          </div>
        </div>
      ) : released.length ? (
        <p className="t-xs c-4" style={{ marginTop: 12 }}>
          No choice yet. The seller can tell you which offer they want from their plan page.
        </p>
      ) : null}

      {released.length === 0 ? (
        <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6 }}>
          Release an offer and Rift drafts the facts for your take. The recommendation is left for you.
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="row gap-2 wrap" style={{ alignItems: "center" }}>
            <span className="t-sm w6">Your take</span>
            {current ? (
              <span className="chip chip-pos t-2xs"><Ico.check size={10} />Seller sees this · {AT(room!.approvedAt!)}</span>
            ) : stale ? (
              <span className="chip chip-warn t-2xs"><Ico.alert size={10} />Hidden — the offers changed since you approved it</span>
            ) : (
              <span className="chip t-2xs">Not shown to the seller</span>
            )}
            {current && edited !== null ? (
              <span className="t-2xs c-4">{edited ? "You rewrote Rift's draft" : "Rift's facts as drafted, your recommendation"}</span>
            ) : null}
          </div>

          <textarea
            className="ta" value={text} maxLength={TAKE_MAX + 200}
            onChange={(e) => setText(e.target.value)}
            aria-label="Your take on these offers"
            style={{ marginTop: 10, minHeight: 170, fontSize: 14, lineHeight: 1.6 }}
          />
          <div className="between gap-2 wrap" style={{ marginTop: 8 }}>
            <span className="t-2xs c-4">
              {text.includes(RECOMMENDATION_MARKER)
                ? "Replace the bracketed line with what you would do."
                : `${text.trim().length} / ${TAKE_MAX}`}
            </span>
            <div className="row gap-2">
              {draft && text !== draft ? (
                <button className="btn btn-s btn-sm" disabled={pending} onClick={() => setText(draft)}>
                  Start from Rift&apos;s draft
                </button>
              ) : null}
              {room?.take ? (
                <button className="btn btn-s btn-sm" disabled={pending} onClick={() => run(() => withdrawOfferTake(leadId))}>
                  Withdraw
                </button>
              ) : null}
              <button className="btn btn-p btn-sm" disabled={pending || Boolean(blocked)}
                title={blocked ?? undefined}
                onClick={() => run(() => approveOfferTake(leadId, text))}>
                {current ? "Approve changes" : "Approve and show seller"}
              </button>
            </div>
          </div>
          {blocked && !text.includes(RECOMMENDATION_MARKER) ? (
            <p className="t-2xs c-4" style={{ marginTop: 6 }}>{blocked}</p>
          ) : null}

          {room?.prepared ? (
            <div style={{ marginTop: 10 }}>
              <button className="t-2xs c-3 u" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
                onClick={() => setShowDraft(!showDraft)}>
                {showDraft ? "Hide" : "Show"} what Rift drafted when you last approved
              </button>
              {showDraft ? (
                <pre className="t-xs c-3" style={{ whiteSpace: "pre-wrap", marginTop: 6, fontFamily: "inherit", lineHeight: 1.6 }}>
                  {room.prepared}
                </pre>
              ) : null}
            </div>
          ) : null}

          <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
            The seller reads exactly what you approve, above the offers.
            It hides itself if you release or withdraw an offer afterwards, until you approve again.
          </p>
        </div>
      )}
    </section>
  );
}
