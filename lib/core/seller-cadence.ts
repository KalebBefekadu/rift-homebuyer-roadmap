/**
 * What a sale owes the agent on a schedule (Blueprint v5 §9: S04, S09).
 *
 * Two promises are made to a seller with a date on them: the pricing
 * opinion names the day it will be reviewed with them, and a live listing
 * gets a weekly review (the week's numbers, and the seller's keep-or-change
 * decision). Both were recorded and neither reminded anybody, so the date
 * on the opinion was a promise only the seller was keeping track of. Today
 * reads this.
 *
 * Only while the sale is being marketed: once it is under contract the
 * contract's own dates take over, and a closed sale owes neither.
 *
 * Pure: no I/O.
 */

import { addDays, daysBetween, georgiaDay } from "./day";
import { listingStatus, type ListingEvent } from "./listing";
import type { Stage } from "./progress";

/** Days between weekly reviews. */
export const REVIEW_EVERY_DAYS = 7;
/** A cadence this late has missed a whole cycle and needs attention, not just doing today. */
export const LATE_DAYS = 7;

const DONE_MARKETING: Stage[] = ["under-contract", "close", "continue"];

export interface SaleCadence {
  journeyId: string;
  person: string;
  label: string;
  /** Null when the stage did not load; treated as still marketing, so nothing is hidden. */
  stage: Stage | null;
  listing: ListingEvent[];
  /** When the last weekly review was recorded, or null. */
  lastReviewAt: string | null;
  latestOpinion: { version: number; reviewOn: string } | null;
  /** The seller's latest answer to the latest pricing version, from their page. */
  answer?: { response: "agree" | "discuss"; note: string | null; by: string; at: string } | null;
}

export interface PricingAnswer {
  journeyId: string;
  person: string;
  label: string;
  version: number;
  response: "agree" | "discuss";
  note: string | null;
  by: string;
  at: string;
}

/**
 * The seller's answers to the current pricing. "Let's discuss" is a request
 * for the agent and stays on Today until a new version answers it (answers
 * belong to a version, so recording one clears it); "agree" is news for
 * recent activity.
 */
export function pricingAnswers(sales: SaleCadence[]): PricingAnswer[] {
  return sales.flatMap((s) => (s.answer && s.latestOpinion
    ? [{ journeyId: s.journeyId, person: s.person, label: s.label, version: s.latestOpinion.version, ...s.answer }]
    : []));
}

export interface CadenceDue {
  journeyId: string;
  person: string;
  label: string;
  kind: "weekly-review" | "pricing-review";
  /** The day it fell due. */
  due: string;
  /** Whole days since it fell due; 0 means today. */
  late: number;
  version?: number;
}

const dayOf = (iso: string) => georgiaDay(new Date(iso));

export function cadenceDue(sales: SaleCadence[], today: string): CadenceDue[] {
  const out: CadenceDue[] = [];
  for (const s of sales) {
    if (s.stage && DONE_MARKETING.includes(s.stage)) continue;
    const base = { journeyId: s.journeyId, person: s.person, label: s.label };

    const l = listingStatus(s.listing);
    if (l.status === "live" && l.live) {
      /* A week from the later of going live and the last review. */
      const live = dayOf(l.live.at);
      const last = s.lastReviewAt ? dayOf(s.lastReviewAt) : null;
      const from = last && last > live ? last : live;
      const due = addDays(from, REVIEW_EVERY_DAYS);
      if (due <= today) out.push({ ...base, kind: "weekly-review", due, late: daysBetween(due, today) });
    }

    if (s.latestOpinion && s.latestOpinion.reviewOn <= today) {
      out.push({ ...base, kind: "pricing-review", due: s.latestOpinion.reviewOn, late: daysBetween(s.latestOpinion.reviewOn, today), version: s.latestOpinion.version });
    }
  }
  return out.sort((a, b) => b.late - a.late);
}
