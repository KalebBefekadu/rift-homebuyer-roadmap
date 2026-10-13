import { describe, expect, it } from "vitest";
import {
  BUYER_DEFAULTS, cashToClose, georgiaClosing, loanTerms, monthlyCost, monthlyPI, owningDetail, type BuyerInputs,
} from "./compute";

/* V2 (Kaleb, 13 Oct 2026): the money values ask the loan type, and FHA, VA and
   USDA carry their agencies' published fees (lib/core/compute.ts LOAN_FEES). */
const ref: BuyerInputs = { ...BUYER_DEFAULTS, assistance: 0 };
const base = 325_000 * 0.965;

describe("a conventional loan, or one not chosen yet, is exactly what it was", () => {
  it("leaves the reference case untouched", () => {
    for (const loanType of [undefined, "conventional", "unsure"] as const) {
      const i = { ...ref, loanType };
      expect(monthlyCost(i).total).toBeCloseTo(2_547.47, 2);
      expect(cashToClose(i).total).toBeCloseTo(24_787.5, 2);
      expect(loanTerms(i).upfront).toBe(0);
    }
  });
});

describe("FHA", () => {
  const fha = { ...ref, loanType: "fha" as const };

  it("adds the 1.75% upfront premium to the loan, not to the cash", () => {
    const t = loanTerms(fha);
    expect(t.upfront).toBeCloseTo(base * 0.0175, 6);
    expect(t.loan).toBeCloseTo(base * 1.0175, 6);
    expect(cashToClose(fha).total).toBeCloseTo(cashToClose(ref).total, 6);
    expect(monthlyCost(fha).pi).toBeCloseTo(monthlyPI(base * 1.0175, 6.5, 30), 6);
  });

  it("charges 0.55% a year above 95% of the price, 0.50% at or under, on the base loan", () => {
    expect(monthlyCost(fha).pmi).toBeCloseTo((base * 0.0055) / 12, 6);
    const tenDown = { ...fha, downPct: 10 };
    expect(monthlyCost(tenDown).pmi).toBeCloseTo((325_000 * 0.9 * 0.005) / 12, 6);
  });

  it("charges it at 20% down too, and keeps it for life above 90%, eleven years at or under", () => {
    expect(monthlyCost({ ...fha, downPct: 20 }).pmi).toBeGreaterThan(0);
    expect(loanTerms(fha).miEnds).toBe("life");
    expect(loanTerms({ ...fha, downPct: 10 }).miEnds).toBe("11 years");
    expect(owningDetail(fha).pmiEnds).toBeNull();
    expect(owningDetail(fha).miForLife).toBe(true);
    expect(owningDetail({ ...fha, downPct: 10 }).pmiEnds!.month).toBe(132);
  });

  it("says when the down payment is under the minimum", () => {
    expect(loanTerms({ ...fha, downPct: 3 }).belowMinimum).toBe(3.5);
    expect(loanTerms(fha).belowMinimum).toBeNull();
  });
});

describe("VA", () => {
  const va = { ...ref, loanType: "va" as const, downPct: 0 };

  it("charges no monthly mortgage insurance at any down payment", () => {
    expect(monthlyCost(va).pmi).toBe(0);
    expect(loanTerms(va).miEnds).toBeNull();
  });

  it("finances a funding fee of 2.15% under 5% down, 1.5% under 10%, 1.25% from 10%", () => {
    expect(loanTerms(va).upfront).toBeCloseTo(325_000 * 0.0215, 6);
    expect(loanTerms({ ...va, downPct: 5 }).upfront).toBeCloseTo(325_000 * 0.95 * 0.015, 6);
    expect(loanTerms({ ...va, downPct: 10 }).upfront).toBeCloseTo(325_000 * 0.9 * 0.0125, 6);
  });
});

describe("USDA", () => {
  const usda = { ...ref, loanType: "usda" as const, downPct: 0 };

  it("finances a 1% guarantee fee and charges 0.35% a year for the life of the loan", () => {
    expect(loanTerms(usda).upfront).toBeCloseTo(3_250, 6);
    expect(monthlyCost(usda).pmi).toBeCloseTo((325_000 * 0.0035) / 12, 6);
    expect(loanTerms(usda).miEnds).toBe("life");
  });
});

describe("Georgia's intangible tax is on the note, financed fees included", () => {
  it("is charged on the FHA loan with its upfront premium", () => {
    const fha = { ...ref, loanType: "fha" as const };
    expect(georgiaClosing(fha).loan).toBeCloseTo(loanTerms(fha).loan, 6);
    expect(georgiaClosing(fha).intangible).toBeGreaterThan(georgiaClosing(ref).intangible);
  });
});
