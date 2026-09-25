import { describe, expect, it } from "vitest";
import { COMMISSION_BAND, GA_TRANSFER_TAX_RATE, SELLER_PAYOFF_ADMIN, SELLER_PRORATED_TAX, SELLER_SETTLEMENT, sellerNet, sellingCosts } from "./compute";
import { FIXED_SELLER_COSTS, netOf } from "./offers";
import { ASKS, commissionOf, parseAnswers } from "./asks";
import { VALUES, valuesFor } from "./values";

/**
 * The seller values (Blueprint v5 §5.3) and MONEY-06: net is price minus
 * uniquely classified costs and payoff; commission is negotiated, never a
 * standard rate; a negative net is a shortfall, never hidden.
 */

describe("selling costs", () => {
  it("adds commission, transfer tax and the fixed lines, and nothing else", () => {
    const c = sellingCosts(400_000, 5);
    expect(c.total).toBe(20_000 + 400 + SELLER_SETTLEMENT + SELLER_PRORATED_TAX);
    expect(c.totalHigh).toBeNull();
    /* Moving, repairs and concessions are not costs of the sale itself. */
    expect(c.lines.map((l) => l.label).join(" ")).not.toMatch(/moving|repair|concession/i);
  });

  it("never picks a rate when none is agreed: it shows the whole band", () => {
    const c = sellingCosts(400_000, null);
    expect(c.lines[0].amount).toBe((400_000 * COMMISSION_BAND.low) / 100);
    expect(c.totalHigh! - c.total).toBe((400_000 * (COMMISSION_BAND.high - COMMISSION_BAND.low)) / 100);
    expect(c.assumptions.find((a) => a.label === "Commission")!.value).toMatch(/not a standard rate/);
  });

  it("charges payoff wire fees only when there is a loan to pay off", () => {
    expect(sellingCosts(300_000, 5, 0).lines.some((l) => /payoff/i.test(l.label))).toBe(false);
    expect(sellingCosts(300_000, 5, 1).lines.some((l) => /payoff/i.test(l.label))).toBe(true);
  });
});

describe("what you'd keep", () => {
  it("agrees with the offer table on the same house, commission and payoff", () => {
    const r = sellerNet(415_000, 236_000, 5.5);
    const offer = netOf({ id: "a", from: "A", price: 415_000, concessions: 0, repairCredit: 0 } as Parameters<typeof netOf>[0], { payoff: 236_000, commissionPct: 5.5 });
    expect(r.net).toBeCloseTo(offer.net, 6);
    expect(FIXED_SELLER_COSTS).toBe(SELLER_SETTLEMENT + SELLER_PRORATED_TAX + SELLER_PAYOFF_ADMIN);
    expect(r.net).toBeCloseTo(415_000 - 236_000 - 415_000 * 0.055 - 415_000 * GA_TRANSFER_TAX_RATE - FIXED_SELLER_COSTS, 6);
  });

  it("reads low to high when commission is open: the high rate gives the low net", () => {
    const r = sellerNet(415_000, 236_000, null);
    expect(r.netLow!).toBeLessThan(r.net);
  });

  it("returns a sale below the payoff as a negative net, not zero", () => {
    expect(sellerNet(300_000, 320_000, 5).net).toBeLessThan(0);
  });
});

describe("the commission question", () => {
  it("offers 'not agreed yet', and that answer is a null rate, never a default", () => {
    expect(ASKS.commission.options!.some((o) => o.value === "none")).toBe(true);
    expect(commissionOf("none")).toBeNull();
    expect(commissionOf(undefined)).toBeNull();
    expect(commissionOf("5.5")).toBe(5.5);
  });

  it("drops a commission nobody could have chosen", () => {
    expect(parseAnswers((p) => (p === "cm" ? "2.5" : undefined)).commission).toBeUndefined();
    expect(parseAnswers((p) => (p === "cm" ? "none" : undefined)).commission).toBe("none");
  });
});

describe("the seller values", () => {
  it("are all live, in D20 order", () => {
    expect(valuesFor("sell").map((v) => v.id)).toEqual(["proceeds", "unclaimed", "costs", "prepare"]);
  });

  it("ask only what their figure uses: no county, since nothing here varies by county", () => {
    for (const id of ["proceeds", "costs"]) {
      expect(VALUES.find((v) => v.id === id)!.asks).not.toContain("county");
    }
  });

  it("have a distinct address parameter for every answer", () => {
    const params = Object.values(ASKS).map((a) => a.param);
    expect(new Set(params).size).toBe(params.length);
  });
});

describe("money you may be losing", () => {
  it("suggests no assessment appeal when nobody has told us the assessment", async () => {
    const { unclaimedValue, SELLER_DEFAULTS } = await import("./compute");
    const items = unclaimedValue({ ...SELLER_DEFAULTS, price: 350_000, assessedValue: 0 });
    expect(items.some((i) => /assessment/i.test(i.title))).toBe(false);
  });

  it("the page passes zero, not the price, as the assessment", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/(rift)/sell/unclaimed/page.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).toMatch(/assessedValue:\s*0,/);
  });
});
