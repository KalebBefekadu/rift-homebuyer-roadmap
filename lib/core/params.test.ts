import { describe, it, expect } from "vitest";
import { parseReadoutParams, BOUNDS } from "./params";
import { BUYER_DEFAULTS, cashToClose, cashGap, monthlyCost } from "./compute";

/**
 * The readout's trust boundary.
 *
 * Every figure on an ungated, URL-addressable page is derived from a query
 * string a stranger can edit. These are the adversarial cases — the ones that
 * produce an arithmetically correct absurdity rather than an error, which is
 * the only failure mode this product genuinely cannot survive.
 */
const from = (q: Record<string, string>) => parseReadoutParams((k) => q[k]);

describe("hostile numbers", () => {
  it("refuses a negative price", () => {
    expect(from({ p: "-500000" }).inputs.price).toBe(BUYER_DEFAULTS.price);
  });

  it("refuses a price nobody in Georgia is paying", () => {
    expect(from({ p: "999999999" }).inputs.price).toBe(BUYER_DEFAULTS.price);
  });

  it("refuses Infinity, which arrives as an innocent-looking string", () => {
    /* Number("1e999") is Infinity, and Infinity through the mortgage formula
       renders as NaN on somebody's screen. */
    expect(from({ p: "1e999" }).inputs.price).toBe(BUYER_DEFAULTS.price);
    expect(from({ s: "1e999" }).inputs.savings).toBe(BUYER_DEFAULTS.savings);
  });

  it("refuses text where a number belongs", () => {
    expect(from({ p: "free", s: "lots", r: "??" }).inputs).toMatchObject({
      price: BUYER_DEFAULTS.price,
      savings: BUYER_DEFAULTS.savings,
      monthlySaving: BUYER_DEFAULTS.monthlySaving,
    });
  });

  it("accepts a legitimate value at the boundary", () => {
    /* Clamping must not quietly reject somebody real. */
    expect(from({ p: String(BOUNDS.price.min) }).inputs.price).toBe(BOUNDS.price.min);
    expect(from({ s: "0" }).inputs.savings).toBe(0);
  });

  it("never produces NaN from anything", () => {
    const hostile = ["", " ", "NaN", "-0", "0x10", "1,000", "٣", "1e309", "null", "undefined"];
    for (const v of hostile) {
      const { inputs } = from({ p: v, s: v, r: v });
      const cash = cashToClose(inputs);
      const gap = cashGap(inputs);
      const monthly = monthlyCost(inputs);
      for (const n of [cash.total, gap.gap, monthly.total]) {
        expect(Number.isFinite(n), `"${v}" produced ${n}`).toBe(true);
      }
    }
  });
});

describe("hostile strings", () => {
  it("falls back for a county we do not serve", () => {
    /* Passing it through would match no programmes and tell somebody there is
       no help for them — a false claim rather than an empty result. */
    const p = from({ c: "Cook" });
    expect(p.inputs.county).toBe(BUYER_DEFAULTS.county);
    expect(p.substituted).toContain("county");
  });

  it("falls back for a timing that is not one of the answers", () => {
    expect(from({ t: "whenever" }).timing).toBe("3 to 9 months");
  });

  it("falls back for an ownership value that is not one of the three", () => {
    expect(from({ o: "landlord" }).ownership).toBe("none");
  });

  it("accepts the real answers unchanged", () => {
    const p = from({ c: "Fulton", t: "In the next 3 months", o: "investment" });
    expect(p.inputs.county).toBe("Fulton");
    expect(p.timing).toBe("In the next 3 months");
    expect(p.ownership).toBe("investment");
    expect(p.substituted).toEqual([]);
  });
});

describe("the rule that outranks the rest", () => {
  it("assistance is zero however the URL is written", () => {
    /* Contract 4.3. No query parameter sets it, and adding one would be the
       most damaging change anybody could make to this file. */
    expect(from({ p: "325000", a: "50000", assistance: "50000" }).inputs.assistance).toBe(0);
  });

  it("says which values it substituted rather than hiding them", () => {
    const p = from({ p: "-1", c: "Cook", t: "soon" });
    expect(p.substituted).toEqual(expect.arrayContaining(["county", "timing", "price"]));
  });

  it("substitutes nothing when nothing was given", () => {
    /* A bare /buy/results is a legitimate visit, not a mangled one. */
    expect(from({}).substituted).toEqual([]);
  });
});
