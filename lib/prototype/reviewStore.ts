"use client";

/**
 * Prototype persistence for "Ask Kaleb to check this" (the trust ladder's
 * producer). localStorage stands in for the queue, so the prototype's Studio
 * queue shows what the prototype's readout raised.
 *
 * Here rather than in lib/core/review.ts, which is the domain layer and does
 * no I/O (AGENTS.md; lib/core/layers.test.ts). In the product a review
 * request is a plan saved in review mode (/api/plan/save).
 */

import { georgiaDay } from "@/lib/core/day";
import type { ReviewItem, ReviewKind, TrustState } from "@/lib/core/review";

const KEY = "rift.review";

/**
 * A client asking for a number to be checked. This is the event that was
 * missing: the readout now has a control that calls this, so `pending-review`
 * has a real origin rather than being a state we described but never entered.
 */
export function askReview(input: { who: string; whoId: string; kind: ReviewKind; what: string; claim: string; ceiling: TrustState }): ReviewItem {
  const item: ReviewItem = {
    id: `r${Date.now().toString(36)}`,
    ...input,
    state: "pending-review",
    raisedBy: "client",
    raisedAt: georgiaDay(),
    waitingHours: 0,
    toAdvance:
      input.kind === "document" ? "Read it and confirm the figure it supports."
      : input.kind === "program" ? "Re-check eligibility against the current programme terms."
      : "Go through the inputs and confirm the arithmetic holds for their situation.",
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    const all: ReviewItem[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(KEY, JSON.stringify([item, ...all].slice(0, 40)));
    window.dispatchEvent(new CustomEvent("rift:review"));
  } catch { /* storage unavailable: the request still returns for this session */ }
  return item;
}

export function readAsked(): ReviewItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReviewItem[]) : [];
  } catch { return []; }
}

export function clearAsked() {
  try { window.localStorage.removeItem(KEY); window.dispatchEvent(new CustomEvent("rift:review")); } catch { /* ignore */ }
}
