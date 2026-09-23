import { describe, it, expect } from "vitest";
import { abroadReturns, STATUSES, rentFor, ABROAD_DEFAULTS, statusById, RENT_RATIO_SOURCE } from "./abroad";
import { dictFor } from "./i18n";

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

describe("parsing an abroad link", () => {
  it("falls back to the strictest status for an unknown one", async () => {
    const { parseAbroadParams } = await import("./abroad");
    const r = parseAbroadParams((k) => ({ s: "citizen-ish" }[k]), ["DeKalb"]);
    expect(r.status).toBe("foreign");
  });

  it("refuses a county we do not serve", async () => {
    const { parseAbroadParams } = await import("./abroad");
    expect(parseAbroadParams((k) => ({ c: "Maricopa" }[k]), ["DeKalb"]).county).toBe("DeKalb");
  });

  it("clamps a down payment below the lender's floor", async () => {
    const { parseAbroadParams } = await import("./abroad");
    const r = parseAbroadParams((k) => ({ s: "foreign", u: "rent", d: "3" }[k]), ["DeKalb"]);
    expect(r.downPct).toBe(30);
  });

  it("clamps an absurd price instead of rendering it", async () => {
    const { parseAbroadParams } = await import("./abroad");
    expect(parseAbroadParams((k) => ({ p: "-9999" }[k]), ["DeKalb"]).price).toBe(60_000);
  });
});

/**
 * What the page is allowed to claim about where the rent figure came from.
 *
 * The rent ratios are engineering's own guesses. The page said "rent is
 * estimated from county averages", which named a source that does not exist:
 * and a guessed figure renders exactly like a measured one, so nothing about
 * the screen could have told anybody.
 *
 * This is the product's central promise, not a copy nit: every figure carries
 * what it assumes. Claiming a stronger provenance than you have is the one
 * failure it cannot survive, because the whole argument for trusting the free
 * readout is that its numbers are honest about themselves.
 */
describe("what the rent figure claims about itself", () => {
  /* Phrases that assert somebody measured something. */
  const OBSERVED = [
    /county averages?/i, /market data/i, /based on actual/i,
    /observed/i, /from comparable/i, /published rents?/i,
  ];

  it("does not claim a source while the ratios are assumed", () => {
    expect(RENT_RATIO_SOURCE.basis, "this test needs rewriting the day real ratios land")
      .toBe("assumed");

    /* Every English string on this funnel, not just the one that was wrong.
       The last time a claim like this was corrected in one place it survived
       in four others. */
    for (const [key, value] of Object.entries(dictFor("en"))) {
      if (typeof value !== "string" || !/rent/i.test(value)) continue;
      for (const claim of OBSERVED) {
        expect(value, `${key} claims the rent figure is measured, and it is not`)
          .not.toMatch(claim);
      }
    }
  });

  it("says outright that it is an assumption, somewhere the reader will see it", () => {
    const all = Object.values(dictFor("en")).filter((v): v is string => typeof v === "string");
    expect(
      all.some((v) => /rent/i.test(v) && /(assumption|assumed|estimate)/i.test(v)),
      "nothing on this funnel tells the reader the rent figure is an assumption",
    ).toBe(true);
  });

  it("names a source when there is one to name", () => {
    /* The other half. Once somebody supplies real ratios, `basis` becomes
       "published" and a source has to be named with them: otherwise the
       upgrade is just as unverifiable as the guess it replaced. */
    if (RENT_RATIO_SOURCE.basis === "published") {
      expect(RENT_RATIO_SOURCE.name, "published ratios must name their source").toBeTruthy();
    }
  });
});
