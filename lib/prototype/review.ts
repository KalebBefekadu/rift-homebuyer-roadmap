/**
 * Rift prototype — the review queue, and the thing that finally produces
 * `pending-review`.
 *
 * The gap this closes: the trust ladder had four rungs and only three of them
 * could ever occur. `pending-review` was rendered, explained, and unreachable —
 * which meant the middle of the ladder was decoration, and a person had no way
 * to ask for the one thing the ladder implies they can ask for.
 *
 * A figure moves up this ladder by a specific event, never by time passing:
 *
 *   preliminary     computed from what they told us
 *     ↓  someone asks for it to be checked        ← THIS FILE
 *   pending-review  in Kaleb's queue, still an estimate, and labelled as one
 *     ↓  Kaleb goes through it and stands behind the reasoning
 *   reviewed        a person's judgement, still not a commitment
 *     ↓  the party who actually decides confirms it in writing
 *   verified        no longer an estimate
 *
 * Two constraints keep this honest:
 *
 *   A CEILING PER ITEM. Not everything can reach `verified`. A lender's
 *   pre-approval can. Kaleb's opinion of a repair budget cannot, ever, and the
 *   UI must not offer a button that implies otherwise.
 *
 *   VERIFICATION NAMES A PARTY. Promoting to `verified` requires the name of
 *   who confirmed it and the date. A verification with nobody's name on it is
 *   the exact false confidence this whole ladder exists to prevent.
 */

import type { TrustState } from "@/components/rift/Trust";

export type ReviewKind = "figure" | "document" | "program" | "plan";

export const KIND_LABEL: Record<ReviewKind, string> = {
  figure: "Number",
  document: "Document",
  program: "Programme",
  plan: "Plan",
};

export interface ReviewItem {
  id: string;
  /** Whose figure this is. */
  who: string;
  whoId: string;
  kind: ReviewKind;
  /** What is being checked, in their words. */
  what: string;
  /** The figure as currently stated. */
  claim: string;
  state: TrustState;
  /** The highest state this item can ever reach. See the ceiling rule above. */
  ceiling: TrustState;
  raisedBy: "client" | "agent" | "system";
  raisedAt: string;
  waitingHours: number;
  /** What must actually be true for this to advance. */
  toAdvance: string;
  /** Present once verified: who confirmed it. Required — see the naming rule. */
  confirmedBy?: string;
}

const ORDER: TrustState[] = ["preliminary", "pending-review", "reviewed", "verified"];
export const rungOf = (s: TrustState) => ORDER.indexOf(s);

/** The next rung up, or null when the item has hit its own ceiling. */
export function nextRung(i: ReviewItem): TrustState | null {
  const at = rungOf(i.state);
  const cap = rungOf(i.ceiling);
  return at >= cap ? null : ORDER[at + 1];
}

/**
 * Why this item cannot go higher. Shown instead of a disabled button, because
 * a greyed-out control teaches nobody anything.
 */
export function ceilingNote(i: ReviewItem): string | null {
  if (rungOf(i.state) < rungOf(i.ceiling)) return null;
  if (i.ceiling === "reviewed") {
    return "This is a judgement, not a fact somebody can certify. Reviewed is as high as it goes, and saying otherwise would be a lie with a green chip on it.";
  }
  if (i.ceiling === "verified") return "Confirmed in writing. Nothing above this.";
  return "At its ceiling.";
}

/**
 * Promotion. `verified` requires a named party — the guard is here rather than
 * in the UI so a second surface cannot skip it.
 */
export function promote(i: ReviewItem, to: TrustState, confirmedBy?: string): { ok: true; item: ReviewItem } | { ok: false; why: string } {
  const next = nextRung(i);
  if (!next) return { ok: false, why: ceilingNote(i) ?? "At its ceiling." };
  if (to !== next) return { ok: false, why: `A figure cannot skip a rung. Next is ${to === "verified" ? "review" : next}.` };
  if (to === "verified" && !confirmedBy?.trim()) {
    return { ok: false, why: "Verification needs the name of who confirmed it, in writing. Without a name this is still an estimate." };
  }
  return { ok: true, item: { ...i, state: to, ...(confirmedBy ? { confirmedBy } : {}) } };
}

/* ------------------------------------------------------------------ *
 * The producer
 * ------------------------------------------------------------------ */

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
    raisedAt: new Date().toISOString().slice(0, 10),
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
  } catch { /* storage unavailable — the request still returns for this session */ }
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

/* ------------------------------------------------------------------ *
 * Seeded queue — what the agent's morning actually looks like
 * ------------------------------------------------------------------ */

export const SEEDED: ReviewItem[] = [
  {
    id: "rv1", who: "Maya Ellison", whoId: "maya", kind: "figure",
    what: "Cash to close", claim: "$31,190", state: "pending-review", ceiling: "verified",
    raisedBy: "client", raisedAt: "2026-09-05", waitingHours: 19,
    toAdvance: "Her lender has the pre-approval. Confirm the credit and the assistance are both in the figure.",
  },
  {
    id: "rv2", who: "Maya Ellison", whoId: "maya", kind: "program",
    what: "Georgia Dream eligibility", claim: "Matched — $10,000", state: "pending-review", ceiling: "verified",
    raisedBy: "system", raisedAt: "2026-09-04", waitingHours: 44,
    toAdvance: "Income limit changed on 1 Sep. Re-run her household against the new table.",
  },
  {
    id: "rv3", who: "Harold & Ruth Vance", whoId: "vance", kind: "figure",
    what: "Repair budget before listing", claim: "$8,400", state: "pending-review", ceiling: "reviewed",
    raisedBy: "client", raisedAt: "2026-09-06", waitingHours: 4,
    toAdvance: "Two quotes in, one outstanding. Reviewed is the ceiling — nobody certifies a repair estimate.",
  },
  {
    id: "rv4", who: "Nadia & Chris Okafor", whoId: "okafor", kind: "figure",
    what: "Net proceeds at the higher offer", claim: "$142,800", state: "reviewed", ceiling: "verified",
    raisedBy: "agent", raisedAt: "2026-09-03", waitingHours: 0,
    toAdvance: "Closing attorney's settlement statement will confirm it. Not before.",
  },
  {
    id: "rv5", who: "Danielle Pike", whoId: "pike", kind: "document",
    what: "Pre-approval letter", claim: "$340,000 at 6.4%", state: "verified", ceiling: "verified",
    raisedBy: "client", raisedAt: "2026-09-02", waitingHours: 0,
    toAdvance: "Done.", confirmedBy: "Brookhaven Mortgage, 3 Sep 2026",
  },
];

/** Oldest wait first — a review queue sorted by anything else is a to-do list. */
export const openItems = (rows: ReviewItem[]) =>
  rows.filter((i) => i.state === "pending-review").sort((a, b) => b.waitingHours - a.waitingHours);

/**
 * The promise attached to the ask. A queue with no stated turnaround is a
 * queue people stop trusting, and then stop using.
 */
export const REVIEW_SLA_HOURS = 24;

export function overdue(i: ReviewItem) {
  return i.state === "pending-review" && i.waitingHours > REVIEW_SLA_HOURS;
}
