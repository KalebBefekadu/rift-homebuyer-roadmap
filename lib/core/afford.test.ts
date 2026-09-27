import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { affordability, priceFor, MAX_PRICE } from "./afford";
import { BUYER_DEFAULTS, monthlyCost } from "./compute";

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
});
