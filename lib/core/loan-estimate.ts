/**
 * Two Loan Estimates, compared (docs/audit/value-depth-2026-10.md §4.6).
 *
 * The lender-questions value prepares the person for the lender meeting; this
 * helps them judge what comes out of it. Every lender must hand over the same
 * three-page Loan Estimate, so the comparison asks for three figures from
 * each one that the lender controls: the rate, the origination charges
 * (section A, which includes any points) and the lender credits. Third-party
 * fees (sections B and C) are much the same from lender to lender, and asking
 * for fewer figures is how the comparison gets used.
 *
 * Cost to date is what was paid upfront plus the interest paid so far. The
 * principal is left out because it is theirs either way. The question it
 * answers is the one points always raise: when does paying more now for a
 * lower rate pay for itself, and will they keep the loan that long?
 *
 * Every number is typed by the person from a document they hold; nothing is
 * stored or sent (the component keeps it in the page). Pure: no I/O.
 */

import { balanceAfter, monthlyPI } from "./compute";

export interface Estimate {
  ratePct: number;
  /** Section A, origination charges, including points. */
  origination: number;
  /** Lender credits, from section J. */
  credits: number;
}

/** What was paid upfront plus the interest paid over the first `months`. */
export function costBy(loan: number, termYears: number, e: Estimate, months: number): number {
  const paid = monthlyPI(loan, e.ratePct, termYears) * months;
  const principal = loan - balanceAfter(loan, e.ratePct, termYears, months);
  return e.origination - e.credits + (paid - principal);
}

export const HORIZONS = [3, 5, 7];

export function compareEstimates(loan: number, termYears: number, a: Estimate, b: Estimate) {
  const byYears = HORIZONS.map((years) => ({ years, a: costBy(loan, termYears, a, years * 12), b: costBy(loan, termYears, b, years * 12) }));

  /* The one that costs less upfront leads at the start. It loses the lead only
     if the other has a lower rate; the month that happens is the break-even. */
  const upA = a.origination - a.credits;
  const upB = b.origination - b.credits;
  const n = termYears * 12;
  let crossover: { month: number; cheaperAfter: "a" | "b" } | null = null;
  let alwaysCheaper: "a" | "b" | null = null;
  if (upA !== upB || a.ratePct !== b.ratePct) {
    const lead = upA < upB || (upA === upB && a.ratePct < b.ratePct) ? "a" : "b";
    const other = lead === "a" ? "b" : "a";
    const [L, O] = lead === "a" ? [a, b] : [b, a];
    if (O.ratePct < L.ratePct) {
      for (let m = 1; m <= n; m++) {
        if (costBy(loan, termYears, O, m) <= costBy(loan, termYears, L, m)) { crossover = { month: m, cheaperAfter: other }; break; }
      }
      /* Never crossing within the term means the lead holds throughout. */
      if (!crossover) alwaysCheaper = lead;
    } else {
      alwaysCheaper = lead;
    }
  }

  return {
    byYears,
    crossover,
    alwaysCheaper,
    monthly: { a: monthlyPI(loan, a.ratePct, termYears), b: monthlyPI(loan, b.ratePct, termYears) },
  };
}
