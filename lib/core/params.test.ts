import { describe, it, expect } from "vitest";
import { parseReadoutParams, parseSellerParams, BOUNDS } from "./params";
import { BUYER_DEFAULTS, SELLER_DEFAULTS, cashToClose, cashGap, monthlyCost } from "./compute";
import { buyerReadout, sellerReadout } from "./results";
import { matchPrograms } from "./registry";

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

describe("whether the visitor actually named a timeline", () => {
  /**
   * The readout's tension block is the only sentence on the page written in
   * the second person about something the reader told us — "You said 3 to 9
   * months." It has to be true that they said it.
   *
   * It was not. The default is applied both when the parameter is absent and
   * when it is unusable, and `substituted` only records the second — so a
   * readout with no `t` at all asserted a statement nobody had made, with no
   * disclosure attached. A truncated share link, which is the case params.ts
   * was written for, produces exactly that.
   */
  const parse = (q: Record<string, string>) =>
    parseReadoutParams((k) => q[k]);

  it("is false when nothing was supplied, and the default is still applied", () => {
    const r = parse({ c: "DeKalb" });
    expect(r.timingStated).toBe(false);
    /* The assumption stays — it is a defensible planning figure. What it must
       not do is get quoted back to them. */
    expect(r.timing).toBe("3 to 9 months");
    /* Nothing was substituted, because nothing was supplied. This is precisely
       why the flag has to exist separately. */
    expect(r.substituted).not.toContain("timing");
  });

  it("is false when something unusable was supplied, and that IS disclosed", () => {
    const r = parse({ t: "3 to 6 months" });
    expect(r.timingStated).toBe(false);
    expect(r.substituted).toContain("timing");
  });

  it("is true for each of the timings the product actually offers", () => {
    for (const t of ["In the next 3 months", "3 to 9 months", "9 to 18 months", "Just exploring"]) {
      const r = parse({ t });
      expect(r.timingStated, `${t} is one of ours`).toBe(true);
      expect(r.timing).toBe(t);
    }
  });

  it("is not fooled by whitespace or by a near miss", () => {
    expect(parse({ t: "  9 to 18 months  " }).timingStated).toBe(true);
    expect(parse({ t: "9 to 18 Months" }).timingStated).toBe(false);
  });

  it("the seller boundary reports it too", () => {
    expect(parseSellerParams((k) => ({ t: "Just exploring" } as Record<string, string>)[k]).timingStated).toBe(true);
    expect(parseSellerParams(() => undefined).timingStated).toBe(false);
  });
});

describe("the readout does not quote a timeline nobody gave", () => {
  const inputs = { ...BUYER_DEFAULTS, savings: 9_000, monthlySaving: 650, assistance: 0 };
  const match = matchPrograms({ county: inputs.county, firstTimeBuyer: true });

  it("says so, and asks, instead of asserting", () => {
    const r = buyerReadout(inputs, match, "3 to 9 months", false);
    expect(r.tension?.headline).not.toMatch(/You said/);
    expect(r.tension?.headline).toMatch(/not told us/);
  });

  it("still quotes one that was given", () => {
    const r = buyerReadout(inputs, match, "3 to 9 months", true);
    expect(r.tension?.headline).toMatch(/^You said 3 to 9 months/);
  });

  it("a seller who named no timeline is 'exploring', not whatever the default spells", () => {
    /* The status chip is the first thing the agent sorts by. Somebody who said
       nothing must not outrank somebody who said "9 to 18 months". */
    expect(sellerReadout(SELLER_DEFAULTS, "3 to 9 months", false).status).toBe("exploring");
    expect(sellerReadout(SELLER_DEFAULTS, "3 to 9 months", true).status).toBe("close");
  });
});
