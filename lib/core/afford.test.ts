import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { affordability, priceFor, priceForCash, MAX_PRICE } from "./afford";
import { BUYER_DEFAULTS, cashToClose, monthlyCost } from "./compute";

const base = { income: 90_000, debts: 400, comfort: 2_400, downPct: 3.5, ratePct: 6.5 };
const monthlyAt = (price: number, downPct = 3.5, ratePct = 6.5) =>
  monthlyCost({ ...BUYER_DEFAULTS, price, downPct, ratePct, hoaMo: 0 }).total;

describe("how much home fits (Blueprint v5 §5.2, MONEY-05)", () => {
  it("the price it gives keeps the payment at or under the one asked for, and $5,000 more would not", () => {
    for (const comfort of [1_500, 2_400, 3_800, 6_000]) {
      for (const downPct of [3, 3.5, 10, 20]) {
        const p = priceFor(comfort, { ...base, comfort, downPct })!;
        expect(monthlyAt(p, downPct)).toBeLessThanOrEqual(comfort + 0.01);
        expect(monthlyAt(p + 5_000, downPct)).toBeGreaterThan(comfort);
      }
    }
  });

  it("agrees with the monthly-cost value about the same house", () => {
    const p = priceFor(2_400, base)!;
    const r = affordability(base);
    expect(r.comfort.price).toBe(p);
    expect(r.monthlyAt!.total).toBeCloseTo(monthlyAt(p), 6);
  });

  it("a higher rate or a higher payment moves the price the right way", () => {
    expect(priceFor(2_400, { ...base, ratePct: 7.5 })!).toBeLessThan(priceFor(2_400, base)!);
    expect(priceFor(2_800, base)!).toBeGreaterThan(priceFor(2_400, base)!);
  });

  it("a payment that does not cover insurance has no price, and nothing exceeds the ceiling", () => {
    expect(priceFor(100, base)).toBeNull();
    expect(priceFor(0, base)).toBeNull();
    expect(priceFor(10_000_000, base)).toBe(MAX_PRICE);
  });

  it("the guidelines are 28% and 36% of gross income, the second after existing debts", () => {
    const r = affordability(base);
    expect(r.scenarios[1].payment).toBeCloseTo(90_000 / 12 * 0.28, 6);
    expect(r.scenarios[2].payment).toBeCloseTo(90_000 / 12 * 0.36 - 400, 6);
    expect(affordability({ ...base, debts: 5_000 }).scenarios[2].price).toBeNull();
  });

  it("says when the comfortable payment is above both guidelines, rather than hiding it", () => {
    expect(affordability({ ...base, comfort: 4_000 }).stretch).toBe(true);
    expect(affordability({ ...base, comfort: 1_800 }).stretch).toBe(false);
  });

  it("never tells anybody what they can afford or qualify for", () => {
    const src = readFileSync("lib/core/afford.ts", "utf8").split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
    expect(src).not.toMatch(/you can afford|qualif|approved for|pre-?approv/i);
  });

  /* The real ceiling (docs/audit/value-depth-2026-10.md §4.5): a payment can
     reach a price the savings cannot close on. */
  it("the cash a price needs stays at or under the savings, and $5,000 more would not", () => {
    for (const savings of [12_000, 20_000, 60_000, 250_000]) {
      for (const downPct of [3, 3.5, 10, 20]) {
        const p = priceForCash(savings, { ...base, downPct })!;
        const cash = (price: number) => cashToClose({ ...BUYER_DEFAULTS, price, downPct, assistance: 0 }).total;
        expect(cash(p)).toBeLessThanOrEqual(savings + 0.01);
        if (p < MAX_PRICE) expect(cash(p + 5_000)).toBeGreaterThan(savings);
      }
    }
  });

  it("savings that do not cover the fixed costs reach no price", () => {
    expect(priceForCash(1_000, base)).toBeNull();
    expect(priceForCash(0, base)).toBeNull();
  });

  it("the ceiling is the lower of what the payment reaches and what the cash reaches, and says which", () => {
    const short = affordability({ ...base, savings: 20_000 });
    expect(short.ceiling.binds).toBe("cash");
    expect(short.ceiling.price).toBe(priceForCash(20_000, base));
    expect(short.ceiling.price!).toBeLessThan(short.comfort.price!);

    const ample = affordability({ ...base, savings: 200_000 });
    expect(ample.ceiling.binds).toBe("payment");
    expect(ample.ceiling.price).toBe(ample.comfort.price);
  });

  it("with no savings given, the payment alone sets it and nothing claims otherwise", () => {
    const r = affordability(base);
    expect(r.ceiling.binds).toBe("payment");
    expect(r.cash).toBeNull();
  });

  it("says what lifts the ceiling, in the units of the thing that binds", () => {
    const cashBound = affordability({ ...base, savings: 20_000 });
    const lifted = priceForCash(21_000, base)! - priceForCash(20_000, base)!;
    expect(cashBound.ceiling.liftPer).toBe(1_000);
    expect(Math.abs(cashBound.ceiling.lift - lifted)).toBeLessThanOrEqual(5_000);
    const payBound = affordability({ ...base, savings: 200_000 });
    expect(payBound.ceiling.liftPer).toBe(100);
    expect(payBound.ceiling.lift).toBeGreaterThan(0);
  });

  it("solves FHA exactly on both sides of its high-balance premium step", () => {
    const fhaAt = (price: number, downPct: number) => monthlyCost({ ...BUYER_DEFAULTS, price, downPct, ratePct: 6.5, hoaMo: 0, loanType: "fha" }).total;
    for (const comfort of [2_000, 4_800, 5_200, 9_000]) {
      const p = priceFor(comfort, { ...base, comfort, downPct: 3.5, loanType: "fha" })!;
      expect(fhaAt(p, 3.5)).toBeLessThanOrEqual(comfort + 0.01);
      if (p < MAX_PRICE) expect(fhaAt(p + 5_000, 3.5)).toBeGreaterThan(comfort);
    }
  });
});
