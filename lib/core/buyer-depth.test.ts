import { describe, expect, it } from "vitest";
import {
  BUYER_DEFAULTS, GA_INTANGIBLE_MAX, PMI_TERMINATION_LTV, balanceAfter, cashToClose, georgiaClosing,
  monthlyCost, monthlyPI, owningDetail, sellerHelp, type BuyerInputs,
} from "./compute";

/**
 * Monthly cost and cash to close, past the total (docs/audit/value-depth-2026-10.md
 * §4.2 and §4.3). The reference buyer: $325,000, 3.5% down, 6.5%: a $313,625 loan.
 */
const ref: BuyerInputs = { ...BUYER_DEFAULTS, assistance: 0 };
const loan = 313_625;

describe("what builds equity, and when mortgage insurance ends", () => {
  it("the balance after every payment matches paying it month by month", () => {
    const pi = monthlyPI(loan, 6.5, 30);
    let bal = loan;
    for (let m = 1; m <= 360; m++) {
      bal -= pi - bal * (0.065 / 12);
      if (m % 60 === 0 || m === 1) expect(balanceAfter(loan, 6.5, 30, m)).toBeCloseTo(bal, 4);
    }
    expect(balanceAfter(loan, 6.5, 30, 360)).toBeCloseTo(0, 4);
    expect(balanceAfter(loan, 0, 30, 180)).toBeCloseTo(loan / 2, 6);
  });

  it("says how much of the first payment and the first year is principal", () => {
    const d = owningDetail(ref);
    expect(d.principalFirst).toBeCloseTo(monthlyPI(loan, 6.5, 30) - loan * 0.065 / 12, 6);
    expect(d.principalYear).toBeCloseTo(loan - balanceAfter(loan, 6.5, 30, 12), 6);
  });

  it("ends mortgage insurance the month the scheduled balance first reaches 78% of the price: month 142 here", () => {
    const d = owningDetail(ref);
    expect(PMI_TERMINATION_LTV).toBe(78);
    expect(d.pmiEnds!.month).toBe(142);
    expect(balanceAfter(loan, 6.5, 30, 142)).toBeLessThanOrEqual(325_000 * 0.78);
    expect(balanceAfter(loan, 6.5, 30, 141)).toBeGreaterThan(325_000 * 0.78);
    expect(d.pmiEnds!.monthly).toBeCloseTo(monthlyCost(ref).pmi, 6);
  });

  it("has no end date when there is no mortgage insurance", () => {
    expect(owningDetail({ ...ref, downPct: 20 }).pmiEnds).toBeNull();
  });

  it("brackets the payment at a half and a whole point either side of the rate, never below zero", () => {
    const d = owningDetail(ref);
    expect(d.byRate.map((r) => r.ratePct)).toEqual([5.5, 6, 6.5, 7, 7.5]);
    expect(d.byRate[2].total).toBeCloseTo(monthlyCost(ref).total, 6);
    for (let k = 1; k < d.byRate.length; k++) expect(d.byRate[k].total).toBeGreaterThan(d.byRate[k - 1].total);
    expect(owningDetail({ ...ref, ratePct: 0.5 }).byRate.map((r) => r.ratePct)).toEqual([0, 0.5, 1, 1.5]);
  });
});

describe("Georgia's lines inside the closing costs", () => {
  it("charges the intangible tax at $1.50 per $500 of the loan or part of $500: $942 here", () => {
    const g = georgiaClosing(ref);
    expect(g.intangible).toBe(942);
    expect(georgiaClosing({ ...ref, price: 100_000, downPct: 0 }).intangible).toBe(300);
    expect(georgiaClosing({ ...ref, price: 100_100, downPct: 0 }).intangible).toBe(301.5);
  });

  it("is capped at the statutory maximum", () => {
    expect(GA_INTANGIBLE_MAX).toBe(25_000);
    expect(georgiaClosing({ ...ref, price: 20_000_000, downPct: 0 }).intangible).toBe(25_000);
  });

  it("is carved out of the closing estimate, so the cash to close does not move", () => {
    const g = georgiaClosing(ref);
    const closing = cashToClose(ref).lines.find((l) => l.label === "Closing costs")!.amount;
    expect(g.intangible + g.other).toBeCloseTo(closing, 6);
    expect(georgiaClosing({ ...ref, closingPct: 0 }).other).toBe(0);
  });
});

describe("what help from the seller does to the cash", () => {
  it("takes the seller's share off the costs, never off the down payment", () => {
    const total = cashToClose(ref).total;
    const h = sellerHelp(ref, 3);
    expect(h.amount).toBe(9_750);
    expect(h.total).toBeCloseTo(total - 9_750, 6);
    const all = sellerHelp(ref, 50);
    const down = 325_000 * 0.035;
    expect(all.total).toBeCloseTo(down, 6);
  });
});
