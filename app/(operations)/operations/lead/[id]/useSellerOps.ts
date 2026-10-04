"use client";

import { useRefresh } from "@/components/rift/useRefresh";
import { send } from "../../journey/send";
import type { Owner } from "@/lib/core/plan";
import {
  saveSellerCosts, recordOffer, releaseOffer, deleteOffer,
  approveOfferTake, withdrawOfferTake, reopenOfferChoice,
  addStep, tickStep, dropStep,
} from "./actions";

type Result = { ok: boolean; error?: string };
type OfferInput = Parameters<typeof recordOffer>[1];

/**
 * A sale's offer and preparation writes, from wherever the controls are.
 *
 * On the person's record they are server actions. On the journey's Offers and
 * Preparation tabs they go through /api/operations/journey: a server action
 * there waits on the journey page's whole tree coming back, which sometimes
 * never lands (journey/ops.ts), so the button would sit on its spinner over a
 * write that was stored. `stamp` summarises what the controls show, so the
 * refresh after a write can tell it arrived (components/rift/useRefresh.ts).
 */
export function useSellerOps(leadId: string, journeyId: string | undefined, stamp: string) {
  const refresh = useRefresh(stamp);
  const via = async (body: Record<string, unknown>): Promise<Result> => {
    const r = await send("seller", { journeyId, ...body });
    if (r.ok) refresh();
    return r;
  };

  if (!journeyId) {
    return {
      costs: (payoff: number, commissionPct: number) => saveSellerCosts(leadId, payoff, commissionPct),
      record: (offer: OfferInput) => recordOffer(leadId, offer),
      release: (offerId: string, released: boolean) => releaseOffer(leadId, offerId, released),
      remove: (offerId: string) => deleteOffer(leadId, offerId),
      approveTake: (take: string) => approveOfferTake(leadId, take),
      withdrawTake: () => withdrawOfferTake(leadId),
      reopenChoice: () => reopenOfferChoice(leadId),
      addStep: (title: string, owner: Owner, ownerName: string | null, dueOn: string | null) => addStep(leadId, title, owner, ownerName, dueOn),
      tickStep: (itemId: string, done: boolean) => tickStep(leadId, itemId, done),
      dropStep: (itemId: string) => dropStep(leadId, itemId),
    };
  }
  return {
    costs: (payoff: number, commissionPct: number) => via({ kind: "costs", payoff, commissionPct }),
    record: (offer: OfferInput) => via({ kind: "offer-record", offer }),
    release: (offerId: string, released: boolean) => via({ kind: "offer-release", offerId, released }),
    remove: (offerId: string) => via({ kind: "offer-delete", offerId }),
    approveTake: (take: string) => via({ kind: "take-approve", take }),
    withdrawTake: () => via({ kind: "take-withdraw" }),
    reopenChoice: () => via({ kind: "choice-reopen" }),
    addStep: (title: string, owner: Owner, ownerName: string | null, dueOn: string | null) => via({ kind: "step-add", title, owner, ownerName, dueOn }),
    tickStep: (itemId: string, done: boolean) => via({ kind: "step-tick", itemId, done }),
    dropStep: (itemId: string) => via({ kind: "step-drop", itemId }),
  };
}
