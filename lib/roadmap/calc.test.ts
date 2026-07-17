import { describe, expect, it } from "vitest";
import { computeRoadmap } from "./calc";

describe("computeRoadmap", () => {
  it("seed case 1: 3.5% down with DPA leaves a cash gap", () => {
    const out = computeRoadmap({
      price: 300000,
      downPct: 3.5,
      ratePct: 6.5,
      termYears: 30,
      taxPct: 1.0,
      insuranceYr: 1400,
      hoaMo: 0,
      closingPct: 3,
      pmiPct: 0.6,
      savings: 8000,
      dpaTotal: 10000,
    });

    expect(Math.round(out.down)).toBe(10500);
    expect(Math.round(out.loan)).toBe(289500);
    expect(Math.round(out.monthlyPI)).toBe(1830);
    expect(out.monthlyPMI).toBeGreaterThan(0);
    expect(Math.round(out.cashToClose)).toBe(19500);
    expect(Math.round(out.covered)).toBe(18000);
    expect(Math.round(out.cashGap)).toBe(1500);
    expect(out.fullyCovered).toBe(false);
  });

  it("seed case 2: 20% down disables PMI", () => {
    const out = computeRoadmap({
      price: 300000,
      downPct: 20,
      ratePct: 6.5,
      termYears: 30,
      taxPct: 1.0,
      insuranceYr: 1400,
      hoaMo: 0,
      closingPct: 3,
      pmiPct: 0.6,
      savings: 8000,
      dpaTotal: 10000,
    });

    expect(out.monthlyPMI).toBe(0);
    expect(Math.round(out.down)).toBe(60000);
  });

  it("seed case 3: price 0 yields zeros and fully covered", () => {
    const out = computeRoadmap({
      price: 0,
      downPct: 3.5,
      ratePct: 6.5,
      termYears: 30,
      taxPct: 1.0,
      insuranceYr: 1400,
      hoaMo: 0,
      closingPct: 3,
      pmiPct: 0.6,
      savings: 0,
      dpaTotal: 0,
    });

    expect(out.down).toBe(0);
    expect(out.loan).toBe(0);
    expect(out.monthlyPI).toBe(0);
    expect(Number.isNaN(out.monthlyTotal)).toBe(false);
    expect(out.fullyCovered).toBe(true);
  });

  it("seed case 4: zero rate uses loan / n", () => {
    const out = computeRoadmap({
      price: 300000,
      downPct: 10,
      ratePct: 0,
      termYears: 30,
      taxPct: 0,
      insuranceYr: 0,
      hoaMo: 0,
      closingPct: 0,
      pmiPct: 0,
      savings: 0,
      dpaTotal: 0,
    });

    expect(out.monthlyPI).toBe(out.loan / (30 * 12));
  });
});
