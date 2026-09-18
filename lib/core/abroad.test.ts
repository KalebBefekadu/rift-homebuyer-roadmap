import { describe, it, expect } from "vitest";
import { abroadReturns, STATUSES, rentFor, ABROAD_DEFAULTS, statusById } from "./abroad";

describe("buying from abroad", () => {
  it("never credits rent to someone who will live in the house", () => {
    const r = abroadReturns({ ...ABROAD_DEFAULTS, use: "live" });
    expect(r.rent).toBe(0);
    expect(r.cashFlow).toBeLessThan(0);
  });

  it("asks a foreign national for more down than a resident", () => {
    const foreign = abroadReturns({ ...ABROAD_DEFAULTS, status: "foreign" });
    const resident = abroadReturns({ ...ABROAD_DEFAULTS, status: "resident" });
    expect(foreign.down).toBeGreaterThan(resident.down);
    expect(foreign.ratePct).toBeGreaterThan(resident.ratePct);
  });

  it("shows negative cash flow rather than flooring it at zero", () => {
    /* Being underwater on a rental is real, and a page that hid it would be
       selling. The seller funnel makes the same promise about payoff. */
    const r = abroadReturns({ ...ABROAD_DEFAULTS, price: 700_000, county: "Cherokee" });
    expect(r.cashFlow).toBeLessThan(0);
  });

  it("counts principal separately from cash flow", () => {
    const r = abroadReturns(ABROAD_DEFAULTS);
    expect(r.year1.principal).toBeGreaterThan(0);
    expect(r.year1.total).toBeCloseTo(
      r.year1.cashFlow + r.year1.principal + r.year1.appreciation, 6);
  });

  it("prices cash-flow counties above appreciation counties", () => {
    expect(rentFor(300_000, "Clayton")).toBeGreaterThan(rentFor(300_000, "Cherokee"));
  });

  it("gives every status a real down payment and a disclosed ask", () => {
    for (const s of STATUSES) {
      expect(s.down.live).toBeGreaterThan(0);
      expect(s.down.rent).toBeGreaterThanOrEqual(s.down.live);
      expect(s.asks.length).toBeGreaterThan(20);
    }
  });

  it("falls back to the strictest status rather than the loosest", () => {
    expect(statusById("nope" as never).id).toBe("foreign");
  });
});

describe("the down payment lever", () => {
  it("never accepts less than the status minimum", async () => {
    const { abroadReturns: f, statusById: g } = await import("./abroad");
    const r = f({ ...ABROAD_DEFAULTS, downPct: 5 });
    expect(r.downPct).toBe(g("foreign").down.rent);
  });

  it("finds a down payment where the rent covers everything", async () => {
    const { breakEvenDownPct } = await import("./abroad");
    const be = breakEvenDownPct(ABROAD_DEFAULTS);
    expect(be).not.toBeNull();
    expect(be!).toBeGreaterThan(30);
  });

  it("has no break-even for a house nobody is renting", async () => {
    const { breakEvenDownPct } = await import("./abroad");
    expect(breakEvenDownPct({ ...ABROAD_DEFAULTS, use: "live" })).toBeNull();
  });
});
