import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  netOf, rankOffers, headlineTrap, gapsIn, anyReleased,
  FIXED_SELLER_COSTS, type Offer, type SellerCosts,
} from "./offers";
import { netProceeds, GA_TRANSFER_TAX_RATE } from "./compute";

/**
 * The one sentence this file exists to make true: the highest offer is often
 * not the best one, and a seller cannot see that from a stack of PDFs.
 */

const costs: SellerCosts = { payoff: 200_000, commissionPct: 5 };

const offer = (over: Partial<Offer> = {}): Offer => ({
  id: "o1", from: "The Webbs", price: 400_000, concessions: 0, repairCredit: 0,
  financing: "conventional", earnest: 5_000, closeOn: "2026-11-01",
  contingencies: ["Financing", "Inspection"], preapproval: true, proofOfFunds: false,
  note: null, releasedAt: null, createdAt: "2026-09-20T00:00:00Z", ...over,
});

describe("what actually reaches the seller", () => {
  it("takes everything the buyer asks back out of the headline", () => {
    const n = netOf(offer({ price: 400_000, concessions: 9_000, repairCredit: 3_500 }), costs);
    expect(n.askedBack).toBe(12_500);
    /* 400,000 − 200,000 payoff − 20,000 commission − 400 transfer tax
       − 12,500 asked back − 2,675 fixed. */
    expect(n.net).toBe(400_000 - 200_000 - 20_000 - 400 - 12_500 - FIXED_SELLER_COSTS);
  });

  it("does not treat earnest money as extra", () => {
    /* It is applied at closing, not paid on top. Adding it would overstate
       every offer that carries a large deposit. */
    const small = netOf(offer({ earnest: 1_000 }), costs);
    const large = netOf(offer({ earnest: 50_000 }), costs);
    expect(large.net).toBe(small.net);
  });

  it("uses the same transfer tax and fixed costs as the seller's own readout", () => {
    /* Two surfaces quoting different closing costs on the same house is the
       fastest way to make a seller stop believing both of them. */
    const price = 400_000;
    const mine = netOf(offer({ price }), costs);
    const readout = netProceeds({
      price, payoff: costs.payoff, commissionPct: costs.commissionPct,
      concessionsPct: 0, repairs: 0, moving: 0,
      county: "Fulton", yearsOwned: 6, assessedValue: price, homesteadFiled: false,
    } as never);

    expect(mine.transferTax).toBe(price * GA_TRANSFER_TAX_RATE);
    /* The readout adds repairs and moving, which an offer does not know about.
       Everything else must agree. */
    expect(mine.net).toBe(readout.net);
  });

  it("says how much the headline hides", () => {
    const n = netOf(offer({ price: 400_000, concessions: 10_000 }), costs);
    expect(n.hiddenFromHeadline).toBe(400_000 - n.net);
    expect(n.hiddenFromHeadline).toBeGreaterThan(0);
  });

  it("shows a net that is negative rather than clamping it", () => {
    /* An underwater seller is told the truth here as everywhere else. A floor
       at zero would say the sale breaks even when it costs them money. */
    const n = netOf(offer({ price: 180_000 }), costs);
    expect(n.net).toBeLessThan(0);
  });
});

describe("ranking", () => {
  it("puts the offer that nets most first, whatever the sticker says", () => {
    const high = offer({ id: "high", price: 415_000, concessions: 18_000 });
    const quiet = offer({ id: "quiet", price: 405_000, concessions: 0 });

    const ranked = rankOffers([high, quiet], costs);
    expect(ranked[0]!.offerId).toBe("quiet");
    expect(ranked[0]!.behindBy).toBe(0);
    expect(ranked[1]!.behindBy).toBeLessThan(0);
  });

  it("reports how far behind each one is, in money", () => {
    const a = offer({ id: "a", price: 410_000 });
    const b = offer({ id: "b", price: 400_000 });
    const ranked = rankOffers([a, b], costs);
    /* 10,000 less price, less 500 commission and 10 transfer tax on it. */
    expect(ranked[1]!.behindBy).toBeCloseTo(-(10_000 - 500 - 10), 6);
  });

  it("keeps a genuine tie in the order it was given", () => {
    /* Breaking a tie on price is the exact substitution this file exists to
       expose: the higher sticker would quietly win on a number that does not
       reach the seller. */
    const first = offer({ id: "first", price: 400_000 });
    /* Built from the rate rather than a literal, so the tie survives the next
       time a statutory rate is corrected: the last literal did not. */
    const second = offer({ id: "second", price: 410_000, concessions: 10_000 - 500 - 10_000 * GA_TRANSFER_TAX_RATE });

    const ranked = rankOffers([first, second], costs);
    expect(ranked[0]!.net).toBeCloseTo(ranked[1]!.net, 6);
    expect(ranked[0]!.offerId).toBe("first");
  });

  it("returns nothing for nothing, rather than a row of zeroes", () => {
    expect(rankOffers([], costs)).toEqual([]);
  });
});

describe("the headline trap", () => {
  it("names it when the highest offer is not the best one", () => {
    const high = offer({ id: "high", price: 415_000, concessions: 18_000 });
    const quiet = offer({ id: "quiet", price: 405_000 });

    const trap = headlineTrap([high, quiet], costs);
    expect(trap, "the trap was not detected").toBeTruthy();
    expect(trap!.highest.id).toBe("high");
    expect(trap!.bestNet.id).toBe("quiet");
    expect(trap!.difference).toBeGreaterThan(0);
  });

  it("says nothing when the highest offer IS the best one", () => {
    /* A product that announces a trap on every screen is a product nobody
       reads by the third time. */
    const high = offer({ id: "high", price: 415_000 });
    const low = offer({ id: "low", price: 400_000 });
    expect(headlineTrap([high, low], costs)).toBeNull();
  });

  it("says nothing about a single offer", () => {
    expect(headlineTrap([offer()], costs)).toBeNull();
    expect(headlineTrap([], costs)).toBeNull();
  });
});

describe("what is missing from an offer", () => {
  it("asks a cash offer for proof of funds, not a preapproval", () => {
    /* A cash buyer has no lender. Demanding a preapproval letter would flag
       every clean cash offer in the market. */
    expect(gapsIn(offer({ financing: "cash", proofOfFunds: true, preapproval: false })))
      .toEqual([]);
    expect(gapsIn(offer({ financing: "cash", proofOfFunds: false })).join(" "))
      .toMatch(/proof of funds/i);
  });

  it("asks a financed offer for a preapproval", () => {
    expect(gapsIn(offer({ financing: "fha", preapproval: false })).join(" "))
      .toMatch(/preapproval/i);
  });

  it("states facts about the paperwork, never a judgement about the buyer", () => {
    /* "No proof of funds attached" is checkable. "Risky buyer" is an opinion
       this product has no standing to hold, and dressing one as the other is
       how somebody declines a good offer because software implied something. */
    const all = [
      ...gapsIn(offer({ financing: "cash", proofOfFunds: false, closeOn: null, earnest: 0 })),
      ...gapsIn(offer({ preapproval: false })),
    ];
    for (const gap of all) {
      expect(gap, `"${gap}" reads as a judgement`).not.toMatch(/risk|weak|bad|poor|unreliable|suspicious/i);
    }
  });

  it("notices an offer with no closing date and no earnest money", () => {
    const gaps = gapsIn(offer({ closeOn: null, earnest: 0 }));
    expect(gaps.join(" ")).toMatch(/closing date/i);
    expect(gaps.join(" ")).toMatch(/earnest/i);
  });

  it("finds nothing wrong with a complete offer", () => {
    expect(gapsIn(offer({ preapproval: true }))).toEqual([]);
  });
});

describe("release", () => {
  it("reports nothing released until something is", () => {
    /* The seller sees nothing until the agent releases it. A default of
       "visible" would put an unreviewed offer in front of somebody. */
    expect(anyReleased([offer(), offer({ id: "o2" })])).toBe(false);
    expect(anyReleased([offer({ releasedAt: "2026-09-20T00:00:00Z" })])).toBe(true);
  });
});

/**
 * The same facts reach both readers.
 *
 * `gapsIn` was on the agent's screen only. The facts it states: "no
 * preapproval letter attached": are material to the person actually
 * deciding, and keeping them from the seller would be withholding something
 * from the one reader who lives with the answer. That is the opposite of what
 * the rest of this product does.
 *
 * It is only safe to show them because of the test above: they are facts about
 * the paperwork and never judgements about a buyer.
 */
describe("what both pages show", () => {
  const src = readFileSync("app/(rift)/plan/[token]/page.tsx", "utf8");
  const agentSrc = readFileSync("app/(operations)/operations/lead/[id]/Offers.tsx", "utf8");

  it("puts the paperwork gaps on the seller's page too", () => {
    expect(src, "the seller is not told what is missing from an offer").toMatch(/gapsIn\(/);
    expect(agentSrc).toMatch(/gapsIn\(/);
  });

  it("shows the seller only offers the agent released", () => {
    /* The page reads plan.offers, which lib/db/plan.ts fills from
       releasedOffersFor: filtered in the query. Asserted here so a future
       edit cannot reach for the unfiltered list that sits next to it. */
    expect(src).not.toMatch(/offersFor\(/);
  });
});
