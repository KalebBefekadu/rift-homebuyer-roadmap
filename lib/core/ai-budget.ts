/**
 * AI cost controls (AUTO-06, decision D16, Blueprint v5 §10.2).
 *
 * A hard limit of $50 a month across all AI use for the pilot, enforced in
 * code, with a smaller limit per workflow so one job cannot spend the whole
 * month. Every call is priced at its worst case before it is made (the input
 * is counted exactly first, the output at its ceiling) and refused if that
 * would cross either limit. Refused means the page offers manual entry: the
 * budget running out can cost somebody some typing, never a deadline.
 *
 * Prices are per million tokens, in US dollars, from Anthropic's published
 * price list. A call that falls back to another model after a refusal is
 * priced at the most expensive model it could have reached, because the
 * limit has to hold even when the arithmetic is pessimistic.
 *
 * Pure: no I/O.
 */

export const MONTHLY_CAP_CENTS = 5_000;

export type AiWorkflow = "offer-extract";

/** Each workflow's share of the month. The rest is headroom for later jobs. */
export const WORKFLOW_CAP_CENTS: Record<AiWorkflow, number> = {
  "offer-extract": 2_000,
};

/** No single call may cost more than this, however much budget is left. */
export const CALL_CEILING_CENTS = 100;

const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
/* The dearest model a server-side fallback might route to. */
const FALLBACK_WORST = { input: 10, output: 50 };

export function priceOf(model: string) {
  return PRICES[model] ?? FALLBACK_WORST;
}

/** Cents for a call. `fellBack` prices it at the dearest reachable model. */
export function centsFor(model: string, inputTokens: number, outputTokens: number, fellBack = false): number {
  const p = fellBack ? FALLBACK_WORST : priceOf(model);
  return ((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 100;
}

/** The worst this call can cost: exact input, output at its ceiling, and a fallback. */
export function worstCaseCents(model: string, inputTokens: number, maxOutputTokens: number): number {
  return Math.max(
    centsFor(model, inputTokens, maxOutputTokens),
    centsFor(model, inputTokens, maxOutputTokens, true),
  );
}

export type SpendVerdict =
  | { ok: true }
  | { ok: false; reason: "call" | "workflow" | "month"; say: string };

/**
 * May this call go ahead? `spent` sums settled costs and open reservations
 * for the calendar month, all workflows and this one.
 */
export function maySpend(
  workflow: AiWorkflow,
  worstCents: number,
  spent: { month: number; workflow: number },
): SpendVerdict {
  if (worstCents > CALL_CEILING_CENTS) {
    return { ok: false, reason: "call", say: "This document is too long to read automatically." };
  }
  if (spent.workflow + worstCents > WORKFLOW_CAP_CENTS[workflow]) {
    return { ok: false, reason: "workflow", say: "Automatic reading has reached its limit for this month." };
  }
  if (spent.month + worstCents > MONTHLY_CAP_CENTS) {
    return { ok: false, reason: "month", say: "Automatic reading has reached its limit for this month." };
  }
  return { ok: true };
}

/** The first moment of the current calendar month, UTC, as the limit counts it. */
export function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
