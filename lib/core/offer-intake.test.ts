import { describe, it, expect } from "vitest";
import {
  readSubmission, read, asOffer, ASSUMED_COMMISSION_PCT,
  MIN_PRICE, MAX_PRICE, MAX_COMMISSION_PCT, type Submission,
} from "./offer-intake";
import { GA_TRANSFER_TAX_RATE } from "./compute";

const RAW = {
  address: "119 Peachtree Way, Atlanta, GA 30309",
  price: 410_000,
  concessions: 8_000,
  repairCredit: 0,
  earnest: 5_000,
  financing: "conventional",
  closeOn: "2026-11-14",
  contingencies: ["Inspection", "Appraisal"],
  preapproval: true,
  proofOfFunds: false,
  from: "Dana Whitfield",
  email: "Dana@Example.COM ",
  phone: "404-555-0199",
  firm: "Whitfield & Co",
  note: "Flexible on the closing date.",
  representing: "buyer",
};

const ok = (over: Record<string, unknown> = {}): Submission => {
  const r = readSubmission({ ...RAW, ...over });
  if (!r.ok) throw new Error(`expected a valid submission: ${r.errors.join(", ")}`);
  return r.value;
};

const errs = (over: Record<string, unknown>): string[] => {
  const r = readSubmission({ ...RAW, ...over });
  return r.ok ? [] : r.errors;
};

describe("reading a submission", () => {
  it("normalises what it keeps", () => {
    const s = ok();
    expect(s.email).toBe("dana@example.com");
    expect(s.price).toBe(410_000);
    expect(s.contingencies).toEqual(["Inspection", "Appraisal"]);
  });

  it("refuses rather than repairs", () => {
    expect(errs({ address: "" })).toHaveLength(1);
    expect(errs({ price: 0 }).join()).toMatch(/plausible/);
    expect(errs({ price: MIN_PRICE - 1 })).not.toEqual([]);
    expect(errs({ price: MAX_PRICE + 1 })).not.toEqual([]);
    expect(errs({ from: "" })).not.toEqual([]);
    expect(errs({ email: "not-an-address" })).not.toEqual([]);
    expect(errs({ financing: "barter" })).not.toEqual([]);
  });

  it("collects every reason at once rather than one per attempt", () => {
    expect(errs({ address: "", price: 0, from: "", email: "x" }).length).toBeGreaterThan(3);
  });

  it("treats a blank closing date as absent and a malformed one as wrong", () => {
    expect(ok({ closeOn: "" }).closeOn).toBeNull();
    expect(errs({ closeOn: "next Tuesday" })).not.toEqual([]);
  });

  it("does not let money asked back exceed the price", () => {
    expect(ok({ concessions: 9_999_999 }).concessions).toBe(410_000);
  });

  it("takes only the booleans that were actually sent as true", () => {
    /* "false", 0 and "on" are all things a form can produce. Only `true` is. */
    expect(ok({ preapproval: "false" }).preapproval).toBe(false);
    expect(ok({ preapproval: "on" }).preapproval).toBe(false);
    expect(ok({ preapproval: true }).preapproval).toBe(true);
  });

  it("bounds the contingency list rather than storing whatever arrives", () => {
    const s = ok({ contingencies: Array.from({ length: 40 }, (_, i) => `c${i}`) });
    expect(s.contingencies).toHaveLength(12);
  });
});

describe("what the offer is worth to a seller", () => {
  it("makes a dollar asked back cost more than a dollar of price", () => {
    const r = read(ok());
    expect(r.costPerDollarBack).toBeGreaterThan(1);
    /* At a 6% commission plus 0.1% transfer tax: 1/(1 − 0.061). */
    expect(r.costPerDollarBack).toBeCloseTo(1 / (1 - (6 / 100 + GA_TRANSFER_TAX_RATE)), 3);
  });

  it("restates the offer as the clean price that leaves the seller the same", () => {
    const s = ok();
    const r = read(s);
    expect(r.equivalentCleanPrice).toBeLessThan(s.price);
    expect(r.headlineOverstatesBy).toBe(s.price - r.equivalentCleanPrice);

    /* The property that defines it: both routes leave the seller identical
       after the proportional costs come off. */
    const k = ASSUMED_COMMISSION_PCT / 100 + GA_TRANSFER_TAX_RATE;
    const viaConcession = s.price * (1 - k) - r.askedBack;
    const viaCleanPrice = r.equivalentCleanPrice * (1 - k);
    expect(Math.abs(viaConcession - viaCleanPrice)).toBeLessThan(1);
  });

  it("says nothing is hidden when nothing is asked back", () => {
    const r = read(ok({ concessions: 0, repairCredit: 0 }));
    expect(r.askedBack).toBe(0);
    expect(r.equivalentCleanPrice).toBe(410_000);
    expect(r.headlineOverstatesBy).toBe(0);
  });

  it("counts a repair credit the same as a concession, because the seller does", () => {
    const a = read(ok({ concessions: 8_000, repairCredit: 0 }));
    const b = read(ok({ concessions: 0, repairCredit: 8_000 }));
    const c = read(ok({ concessions: 4_000, repairCredit: 4_000 }));
    expect(a.equivalentCleanPrice).toBe(b.equivalentCleanPrice);
    expect(c.equivalentCleanPrice).toBe(a.equivalentCleanPrice);
  });

  it("carries the commission as an assumption that can be changed", () => {
    const low = read(ok(), 3);
    const high = read(ok(), 6);
    expect(low.commissionPct).toBe(3);
    /* A lower commission means less is skimmed off a price cut, so asking for
       money back costs relatively less in price terms. */
    expect(low.costPerDollarBack).toBeLessThan(high.costPerDollarBack);
    expect(low.equivalentCleanPrice).toBeGreaterThan(high.equivalentCleanPrice);
  });

  it("cannot be driven into a division by zero however the assumption is set", () => {
    for (const pct of [-50, 0, 6, MAX_COMMISSION_PCT, 500, Number.MAX_SAFE_INTEGER]) {
      const r = read(ok(), pct);
      expect(Number.isFinite(r.equivalentCleanPrice)).toBe(true);
      expect(Number.isFinite(r.costPerDollarBack)).toBe(true);
      expect(r.costPerDollarBack).toBeGreaterThan(0);
    }
  });
});

describe("the paperwork, stated as fact", () => {
  it("names what is missing from a financed offer", () => {
    expect(read(ok({ preapproval: false })).gaps).toContain("No preapproval letter attached");
  });

  it("asks a cash offer for proof of funds rather than a preapproval", () => {
    const g = read(ok({ financing: "cash", proofOfFunds: false, preapproval: false })).gaps;
    expect(g).toContain("No proof of funds attached to a cash offer");
    expect(g).not.toContain("No preapproval letter attached");
  });

  it("finds nothing to say about a complete one", () => {
    expect(read(ok({ preapproval: true, earnest: 5_000, closeOn: "2026-11-14" })).gaps).toEqual([]);
  });

  it("never grades the offer", () => {
    /* Facts about paperwork, never a judgement. A page that told a buyer's
       agent their offer was "weak" would be this product taking a side in
       somebody else's negotiation. */
    const g = read(ok({ preapproval: false, earnest: 0, closeOn: "" })).gaps;
    for (const word of ["weak", "strong", "poor", "bad", "good", "low", "unlikely", "competitive"]) {
      expect(g.join(" ").toLowerCase()).not.toContain(word);
    }
  });
});

describe("the shape the rest of the product already speaks", () => {
  it("hands the offer engine an Offer rather than a second shape", () => {
    const o = asOffer(ok());
    expect(o.price).toBe(410_000);
    expect(o.releasedAt).toBeNull();
  });
});
