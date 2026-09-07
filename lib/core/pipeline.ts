/**
 * Rift prototype — stall detection and the forward view.
 *
 * A board tells an agent where everyone is. It does not tell him who has
 * stopped moving, and stopping is the thing that actually costs money — a
 * relationship does not usually die of a decision, it dies of forty quiet days.
 *
 * Two readings, both computed rather than judged:
 *
 *   STALL   Every stage has a normal dwell. Past it, something is wrong, and
 *           the cause is almost always identifiable from the record — an unsent
 *           agreement, an unanswered lender, a decision nobody made.
 *
 *   FORWARD Expected closings by month, weighted by stage. Weighted, because an
 *           unweighted pipeline forecast is a wish list, and a solo agent who
 *           plans his year on one will hire too early and cut too late.
 *
 * The weights below started as assumptions, which was a stated gap: they were
 * industry-shaped guesses being presented as this agent's odds. They now shrink
 * toward whatever his own closed history actually shows — see `weightFor`. A
 * weight is labelled with its basis everywhere it is displayed, so nobody has
 * to remember which of these numbers has evidence behind it.
 */

import { DEFAULT_RULES } from "./settings";

export interface StageRule {
  stage: string;
  /** Days after which this stage is abnormal. */
  normalDays: number;
  /** Probability a relationship in this stage closes. */
  weight: number;
  /** Typical days from here to closing. */
  toCloseDays: number;
}

export const STAGES: StageRule[] = [
  { stage: "Exploring", normalDays: 45, weight: 0.08, toCloseDays: 210 },
  { stage: "Building readiness", normalDays: 60, weight: 0.22, toCloseDays: 150 },
  { stage: "Preparing the property", normalDays: 30, weight: 0.55, toCloseDays: 90 },
  { stage: "Financing", normalDays: 21, weight: 0.6, toCloseDays: 75 },
  { stage: "Ready to shop", normalDays: 30, weight: 0.5, toCloseDays: 90 },
  { stage: "Searching", normalDays: 60, weight: 0.45, toCloseDays: 75 },
  { stage: "Reviewing offers", normalDays: 10, weight: 0.8, toCloseDays: 40 },
  { stage: "Under contract", normalDays: 35, weight: 0.9, toCloseDays: 25 },
  { stage: "Closing", normalDays: 10, weight: 0.97, toCloseDays: 7 },
];

export const ruleFor = (stage: string) =>
  STAGES.find((s) => s.stage === stage) ?? { stage, normalDays: 45, weight: 0.3, toCloseDays: 120 };

export type StallLevel = "moving" | "slow" | "stalled";

export interface Stall {
  level: StallLevel;
  days: number;
  normal: number;
  /** Why it is stuck, in the agent's own terms. */
  reason: string;
  /** The one action that would unstick it. */
  unstick: string;
}

export const STALL_CHIP: Record<StallLevel, { l: string; c: string }> = {
  moving: { l: "Moving", c: "chip-pos" },
  slow: { l: "Slowing", c: "chip-warn" },
  stalled: { l: "Stalled", c: "chip-neg" },
};

export function stallOf(stage: string, daysInStage: number, flag?: string, nextDue?: string): Stall {
  const r = ruleFor(stage);
  const over = daysInStage / r.normalDays;
  const level: StallLevel = over >= 1 ? "stalled" : over >= 0.7 ? "slow" : "moving";

  const overdue = (nextDue ?? "").toLowerCase().startsWith("overdue");
  const reason =
    level === "moving" ? "Inside the normal window for this stage."
    : flag ? flag
    : overdue ? `The next action is overdue, and nothing behind it can start.`
    : `${daysInStage} days in a stage that normally takes ${r.normalDays}. Nothing is recorded as blocking it, which is usually its own answer.`;

  const unstick =
    level === "moving" ? "Nothing needed."
    : overdue ? "Clear the overdue action first — it is the dependency."
    : flag ? "Resolve the blocker on the record."
    : "One call. A stage that stalls without a recorded cause is nearly always waiting on a conversation.";

  return { level, days: daysInStage, normal: r.normalDays, reason, unstick };
}

/* ------------------------------------------------------------------ *
 * Weights that learn
 * ------------------------------------------------------------------ */

/** One finished relationship: the stage it was in when counted, and whether it closed. */
export interface Outcome { stage: string; closed: boolean }

export type Basis = "assumed" | "blended" | "observed";

export interface Weight {
  weight: number;
  basis: Basis;
  /** How many of this agent's own outcomes sit behind it. */
  n: number;
  note: string;
}

/**
 * Prior strength. A stage needs this many of the agent's own outcomes before
 * his history outweighs the starting assumption, and the two are blended in
 * proportion until then.
 *
 * The alternative — switching to observed the moment there is any history at
 * all — is how a solo agent ends up forecasting from three closings and
 * believing a stage converts at 100%. Small samples do not deserve full
 * confidence, and this is the arithmetic that says so.
 */
const PRIOR = 12;

/** Enough outcomes to say the number is his rather than ours. */
const CONFIDENT = 12;
/** Below this, history is noise and we do not blend at all. */
const MINIMUM = 4;

export function weightFor(stage: string, history: Outcome[] = HISTORY): Weight {
  const assumed = ruleFor(stage).weight;
  const mine = history.filter((h) => h.stage === stage);
  const n = mine.length;

  if (n < MINIMUM) {
    return {
      weight: assumed, basis: "assumed", n,
      note: n === 0
        ? "No closed history in this stage yet. This is a starting assumption, not his number."
        : `Only ${n} outcome${n === 1 ? "" : "s"} so far — too few to move the assumption.`,
    };
  }

  const observed = mine.filter((h) => h.closed).length / n;
  /* Shrinkage: his own rate, pulled toward the assumption by the prior. */
  const blended = (n * observed + PRIOR * assumed) / (n + PRIOR);
  const weight = Math.round(blended * 100) / 100;

  return n >= CONFIDENT
    ? { weight, basis: "observed", n, note: `${n} of his own outcomes, ${Math.round(observed * 100)}% closed. This is his rate now, not ours.` }
    : { weight, basis: "blended", n, note: `${n} outcomes at ${Math.round(observed * 100)}%, still pulled toward the ${Math.round(assumed * 100)}% assumption until there are ${CONFIDENT}.` };
}

export const BASIS_CHIP: Record<Basis, { l: string; c: string }> = {
  assumed: { l: "Assumed", c: "chip-warn" },
  blended: { l: "Part observed", c: "chip" },
  observed: { l: "His own history", c: "chip-pos" },
};

/**
 * Seeded history. Deliberately thin and uneven, because a solo agent's is —
 * plenty of contract-stage outcomes, almost nothing at the top of the funnel,
 * which is exactly the shape that makes an unshrunk average dangerous.
 */
export const HISTORY: Outcome[] = [
  ...Array<Outcome>(3).fill({ stage: "Exploring", closed: false }),
  ...Array<Outcome>(7).fill({ stage: "Building readiness", closed: false }),
  ...Array<Outcome>(2).fill({ stage: "Building readiness", closed: true }),
  ...Array<Outcome>(5).fill({ stage: "Searching", closed: true }),
  ...Array<Outcome>(4).fill({ stage: "Searching", closed: false }),
  ...Array<Outcome>(11).fill({ stage: "Under contract", closed: true }),
  ...Array<Outcome>(2).fill({ stage: "Under contract", closed: false }),
  ...Array<Outcome>(6).fill({ stage: "Reviewing offers", closed: true }),
  ...Array<Outcome>(1).fill({ stage: "Reviewing offers", closed: false }),
];

/** How much of the forward view rests on evidence rather than assumption. */
export function evidenceMix(stages: string[], history: Outcome[] = HISTORY) {
  const w = stages.map((s) => weightFor(s, history));
  return {
    observed: w.filter((x) => x.basis === "observed").length,
    blended: w.filter((x) => x.basis === "blended").length,
    assumed: w.filter((x) => x.basis === "assumed").length,
    total: w.length,
  };
}

/* ------------------------------------------------------------------ *
 * Forward view
 * ------------------------------------------------------------------ */

export interface Forecast {
  month: string;
  /** Relationships expected to close, weighted. */
  expected: number;
  /** Unweighted count, for contrast. */
  count: number;
  value: number;
  weightedValue: number;
  names: string[];
  /** Weakest basis behind this bucket, so a month of guesses cannot look solid. */
  basis: Basis;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function forecast(
  rows: { name: string; stage: string; value: number }[],
  from = new Date("2026-09-06T12:00:00Z"),
  months = 4,
  history: Outcome[] = HISTORY,
): Forecast[] {
  const buckets: Forecast[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(from);
    d.setMonth(d.getMonth() + i);
    buckets.push({ month: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, expected: 0, count: 0, value: 0, weightedValue: 0, names: [], basis: "observed" });
  }

  const rank: Record<Basis, number> = { assumed: 0, blended: 1, observed: 2 };

  for (const r of rows) {
    const rule = ruleFor(r.stage);
    const w = weightFor(r.stage, history);
    const close = new Date(from);
    close.setDate(close.getDate() + rule.toCloseDays);
    const idx = (close.getFullYear() - from.getFullYear()) * 12 + (close.getMonth() - from.getMonth());
    if (idx < 0 || idx >= months) continue;
    const b = buckets[idx];
    b.count += 1;
    b.expected += w.weight;
    b.value += r.value;
    b.weightedValue += r.value * w.weight;
    b.names.push(r.name);
    if (rank[w.basis] < rank[b.basis]) b.basis = w.basis;
  }

  return buckets.map((b) => ({ ...b, expected: Math.round(b.expected * 10) / 10 }));
}

/**
 * Gross commission at a stated rate. Stated, because assuming it is how
 * forecasts lie — and now settable, because it was previously a literal in this
 * file pretending to be a business decision somebody had made.
 */
export const COMMISSION_PCT = DEFAULT_RULES.commissionPct.value;
export const commissionOn = (value: number, pct = COMMISSION_PCT) => (value * pct) / 100;
