import { describe, expect, it } from "vitest";
import { AFFORD_MAX_PRICE, RATIOS, affordability, priceForMonthly } from "./afford";
import { BUYER_DEFAULTS, monthlyCost } from "./compute";
import { valuesFor } from "./values";

const base = { downPct: 3.5, ratePct: 6.5 };
const costOf = (price: number) => monthlyCost({ ...BUYER_DEFAULTS, ...base, price, hoaMo: 0 }).total;

/* MONEY-05: its own bounds, tests and disclosures before release. */
describe("how much home fits", () => {
  it("solves the price against the same monthly engine, never crossing the budget", () => {
    for (const target of [1_200, 2_000, 2_547, 4_000]) {
      const p = priceForMonthly(target, base)!;
      expect(costOf(p)).toBeLessThanOrEqual(target);
      /* And not leaving much on the table: $1,000 more crosses it or is within rounding. */
      expect(costOf(p + 2_000)).toBeGreaterThan(target);
    }
  });

  it("returns the reference case's price for the reference case's monthly cost", () => {
    const p = priceForMonthly(costOf(325_000) + 0.01, base)!;
    expect(p).toBe(325_000);
  });

  it("is bounded: no price below the fixed costs, nothing above the ceiling", () => {
    expect(priceForMonthly(50, base)).toBeNull();
    expect(priceForMonthly(10_000_000, base)).toBe(AFFORD_MAX_PRICE);
  });

  it("keeps comfortable at or under stretch, and both inside their ratios", () => {
    const r = affordability({ income: 90_000, debts: 400, ...base });
    const gross = 90_000 / 12;
    expect(r.comfortable.price!).toBeLessThanOrEqual(r.stretch.price!);
    expect(r.comfortable.monthly).toBeLessThanOrEqual((gross * RATIOS.comfortHousing) / 100 + 1e-9);
    expect(r.comfortable.monthly + 400).toBeLessThanOrEqual((gross * RATIOS.comfortTotal) / 100 + 1e-9);
    expect(r.stretch.monthly + 400).toBeCloseTo((gross * RATIOS.stretchTotal) / 100, 6);
  });

  it("says no price, rather than a small invented one, when debts use up the share", () => {
    const r = affordability({ income: 40_000, debts: 1_500, ...base });
    expect(r.stretch.price).toBeNull();
    expect(r.comfortable.price).toBeNull();
    expect(affordability({ income: 0, debts: 0, ...base }).stretch.price).toBeNull();
  });

  it("more debt never raises the price; more income never lowers it", () => {
    const at = (income: number, debts: number) => affordability({ income, debts, ...base }).stretch.price ?? 0;
    expect(at(90_000, 800)).toBeLessThanOrEqual(at(90_000, 200));
    expect(at(120_000, 200)).toBeGreaterThanOrEqual(at(90_000, 200));
  });

  it("carries its disclosure: a planning scenario, not a lending decision", () => {
    const r = affordability({ income: 90_000, debts: 0, ...base });
    expect(r.couldBeWrong).toMatch(/planning scenario, not a lending decision/);
    expect(r.assumptions.find((x) => x.label === "Not counted")!.value).toMatch(/cash you need to close/);
    expect(valuesFor("buy").find((v) => v.id === "afford")!.live).toBe(true);
  });
});
