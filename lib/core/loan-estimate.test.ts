import { describe, expect, it } from "vitest";
import { compareEstimates, costBy, type Estimate } from "./loan-estimate";

/* docs/audit/value-depth-2026-10.md §4.6: two Loan Estimates, typed in by the
   person, compared over the years they expect to keep the loan. */
const loan = 313_625;
const plain: Estimate = { ratePct: 6.5, origination: 1_200, credits: 0 };
const points: Estimate = { ratePct: 6.125, origination: 1_200 + 6_273, credits: 0 };

describe("comparing two Loan Estimates", () => {
  it("two identical estimates cost the same at every horizon, and never cross", () => {
    const c = compareEstimates(loan, 30, plain, { ...plain });
    for (const h of c.byYears) expect(h.a).toBeCloseTo(h.b, 6);
    expect(c.crossover).toBeNull();
    expect(c.alwaysCheaper).toBeNull();
  });

  it("finds the month the lower rate's interest savings first repay its higher upfront cost", () => {
    const c = compareEstimates(loan, 30, plain, points);
    const m = c.crossover!.month;
    expect(c.crossover!.cheaperAfter).toBe("b");
    expect(costBy(loan, 30, points, m)).toBeLessThanOrEqual(costBy(loan, 30, plain, m));
    expect(costBy(loan, 30, points, m - 1)).toBeGreaterThan(costBy(loan, 30, plain, m - 1));
  });

  it("says which is cheaper throughout when one has both the lower rate and the lower upfront cost", () => {
    const c = compareEstimates(loan, 30, plain, { ratePct: 6.25, origination: 900, credits: 0 });
    expect(c.crossover).toBeNull();
    expect(c.alwaysCheaper).toBe("b");
  });

  it("counts lender credits against the upfront cost", () => {
    expect(costBy(loan, 30, { ratePct: 7, origination: 1_200, credits: 3_000 }, 0)).toBe(-1_800);
  });

  it("is cost to date: what was paid upfront plus the interest paid, not the principal, which is theirs", () => {
    const year = costBy(loan, 30, plain, 12);
    const r = 0.065 / 12;
    let bal = loan, interest = 0;
    const pi = (loan * r * Math.pow(1 + r, 360)) / (Math.pow(1 + r, 360) - 1);
    for (let k = 0; k < 12; k++) { const i = bal * r; interest += i; bal -= pi - i; }
    expect(year).toBeCloseTo(1_200 + interest, 4);
  });

  it("gives the three horizons people keep a loan for", () => {
    expect(compareEstimates(loan, 30, plain, points).byYears.map((h) => h.years)).toEqual([3, 5, 7]);
  });
});
