/**
 * How old a rate is allowed to be, and what to say when it is older.
 *
 * Pure, so the rule can be tested without a database, and because the rule is
 * the interesting part, not the fetch.
 *
 * The product's whole argument is that every figure carries its assumptions.
 * The rate is the assumption the most figures depend on and the only one that
 * moves weekly, so it is the one where "we did not say when this was true"
 * does the most damage.
 */

import { daysBetween, georgiaDay } from "./day";

export interface RateAssumption {
  pct: number;
  source: string;
  asOf: string;
  /** Days since the rate was true. */
  ageDays: number;
  freshness: "fresh" | "ageing" | "stale";
  /** How it reads beside a figure. Always names the date. */
  label: string;
  note: string;
}

/** A week is a market week. Beyond two, the number is a different number. */
export const RATE_FRESH_DAYS = 7;
export const RATE_STALE_DAYS = 21;

/**
 * The starting assumption, used when nothing has been recorded yet.
 *
 * Deliberately labelled as an assumption with no date rather than dressed up as
 * an observation. It is the same 6.5% the engine has always used; the change is
 * that the product now says so out loud instead of implying a precision it does
 * not have.
 */
export const FALLBACK_RATE = {
  pct: 6.5,
  source: "Starting assumption: no rate has been recorded",
} as const;

/** The calendar day a rate was true: a date as given, a timestamp as its day in Georgia. Null when unreadable. */
function rateDay(asOf: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return asOf;
  const t = Date.parse(asOf);
  return Number.isNaN(t) ? null : georgiaDay(new Date(t));
}

export function describeRate(pct: number, source: string, asOf: string | null, today = new Date()): RateAssumption {
  /* Whole Georgia days, not hours since midnight in London. A rate dated
     today read "yesterday" from eight in the evening, and a week-old one
     turned "ageing" four hours before the week was up. An unreadable date
     is treated as no date, rather than printed as "NaN days ago". */
  const day = asOf ? rateDay(asOf) : null;
  const ageDays = day ? Math.max(0, daysBetween(day, georgiaDay(today))) : Number.POSITIVE_INFINITY;

  const freshness: RateAssumption["freshness"] =
    ageDays <= RATE_FRESH_DAYS ? "fresh" : ageDays <= RATE_STALE_DAYS ? "ageing" : "stale";

  const when = day
    ? ageDays === 0 ? "today" : ageDays === 1 ? "yesterday" : `${ageDays} days ago`
    : "at no recorded date";

  return {
    pct,
    source,
    asOf: day ? asOf! : "",
    ageDays,
    freshness,
    label: `${pct.toFixed(2)}%, ${source}, ${when}`,
    note:
      freshness === "fresh"
        ? "Rates move weekly. Your own rate depends on credit, loan type, and the day you lock."
        : freshness === "ageing"
          ? `This rate is ${when} and rates move weekly. Treat the monthly figures as a guide rather than a quote.`
          : day
            ? `This rate is ${when}, which is old enough that the monthly figures below could be materially wrong. A lender's estimate is the authority.`
            : "No rate has been recorded, so the monthly figures use a starting assumption rather than an observed rate. A lender's estimate is the authority.",
  };
}
