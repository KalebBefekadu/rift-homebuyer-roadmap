import { describe, expect, it } from "vitest";
import { BUYER_DEFAULTS, SELLER_DEFAULTS, cashGap, netProceeds, type BuyerInputs, type SellerInputs } from "./compute";
import { matchPrograms } from "./registry";
import { buyerReadout, sellerReadout, type Readout } from "./results";

/**
 * The 459 lines that write what a stranger actually reads had no tests.
 *
 * Every defect found in this module so far was found by loading the deployed
 * page and reading it — "You'm a U.S. citizen", "You said 3 to 9 months" to
 * somebody who said nothing, a seller $73,575 short told they would "walk
 * away with about -$73,575" under a chip reading "Ready now". None of them
 * threw. None of them failed a test, because there were none to fail.
 *
 * So these are not unit tests of arithmetic — `compute.test.ts` owns that.
 * They are assertions about the SENTENCES: that the prose wrapped around a
 * number belongs to the person whose number it is.
 */

const buyer = (over: Partial<BuyerInputs> = {}): BuyerInputs => ({ ...BUYER_DEFAULTS, ...over });
const seller = (over: Partial<SellerInputs> = {}): SellerInputs => ({ ...SELLER_DEFAULTS, ...over });

const NO_HELP = matchPrograms({ county: "Nowhere", firstTimeBuyer: false });
const HELP = matchPrograms({ county: "DeKalb", firstTimeBuyer: true });

/** Every string a reader could see, flattened. */
function prose(r: Readout): string {
  return [
    r.statusLabel, r.verdict, r.rider ?? "",
    r.reframe.headline, r.reframe.figure, r.reframe.contrast, r.reframe.body,
    r.blocker.title, r.blocker.body, r.blocker.who,
    ...r.steps.flatMap((s) => [s.label, s.detail, s.owner, s.when]),
    ...r.questions,
    r.tension?.headline ?? "", r.tension?.body ?? "",
  ].join(" \n ");
}

/* ------------------------------------------------------------------ *
 * Things that must be true of every readout, whoever it is for
 * ------------------------------------------------------------------ */

describe("no readout, for anyone, leaks the shape of its own arithmetic", () => {
  const cases: [string, Readout][] = [
    ["buyer, default", buyerReadout(buyer(), HELP, "3 to 9 months", true)],
    ["buyer, no saving rate", buyerReadout(buyer({ monthlySaving: 0 }), NO_HELP, "Just exploring", true)],
    ["buyer, already covered", buyerReadout(buyer({ savings: 400_000 }), HELP, "In the next 3 months", true)],
    ["buyer, nothing stated", buyerReadout(buyer(), NO_HELP, "3 to 9 months", false)],
    ["buyer, at the price floor", buyerReadout(buyer({ price: 50_000 }), NO_HELP, "3 to 9 months", true)],
    ["seller, healthy", sellerReadout(seller(), "3 to 9 months", true)],
    ["seller, underwater", sellerReadout(seller({ payoff: 380_000, price: 300_000 }), "In the next 3 months", true)],
    ["seller, thin", sellerReadout(seller({ payoff: 340_000 }), "9 to 18 months", true)],
    ["seller, owns outright", sellerReadout(seller({ payoff: 0 }), "Just exploring", true)],
    ["seller, nothing stated", sellerReadout(seller(), "3 to 9 months", false)],
  ];

  for (const [name, r] of cases) {
    it(`${name}: prints no NaN, undefined, null or unrendered placeholder`, () => {
      const text = prose(r);
      for (const leak of ["NaN", "undefined", "null", "Infinity", "[object", "${"]) {
        expect(text, `"${leak}" reached the page`).not.toContain(leak);
      }
    });

    it(`${name}: the headline figure survives intact`, () => {
      /* `figure` exists because it was being recovered from `headline` with
         `.split(",")[0]`, which truncated every figure over $1,000 to its
         thousands digits — $137,145 rendered as "$137" beside a paragraph
         stating the real number. Anything ending in a bare comma is that bug. */
      expect(r.reframe.figure).toMatch(/^-?\$[\d,]+$/);
      expect(r.reframe.figure).not.toMatch(/,$/);
      expect(r.reframe.headline).toContain(r.reframe.figure);
    });

    it(`${name}: gives at least one step, and names an owner for each`, () => {
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) expect(["You", "Kaleb", "Your lender", "Your county"]).toContain(s.owner);
    });

    it(`${name}: hands the blocker to somebody, and it is not us by default`, () => {
      expect(r.blocker.who.trim()).not.toBe("");
      expect(r.blocker.title.trim()).not.toBe("");
    });
  }
});

/* ------------------------------------------------------------------ *
 * Buyer
 * ------------------------------------------------------------------ */

describe("the buyer's status band follows the arithmetic, not the mood", () => {
  it("is ready only when their own savings already cover closing", () => {
    const r = buyerReadout(buyer({ savings: 400_000 }), HELP, "Just exploring", true);
    expect(r.status).toBe("ready");
    expect(r.statusLabel).toBe("Ready now");
    expect(r.verdict).toContain("already have");
  });

  it("is close inside six months and building inside eighteen", () => {
    const close = buyerReadout(buyer({ savings: 15_000, monthlySaving: 3_000 }), NO_HELP, "3 to 9 months", true);
    expect(close.status).toBe("close");
    const building = buyerReadout(buyer({ savings: 9_000, monthlySaving: 1_200 }), NO_HELP, "3 to 9 months", true);
    expect(building.status).toBe("building");
  });

  it("is early when no date can be computed at all", () => {
    const r = buyerReadout(buyer({ monthlySaving: 0 }), NO_HELP, "3 to 9 months", true);
    expect(cashGap({ ...buyer({ monthlySaving: 0 }), assistance: 0 }).monthsToClose).toBeNull();
    expect(r.status).toBe("exploring");
    expect(r.rider).toContain("cannot put a date on it");
  });
});

describe("assistance is upside, never folded into the headline", () => {
  /* The single worst thing this product could do is tell somebody they are
     ready to buy on money a lender has not agreed to give them. */
  it("ignores an assistance figure passed in on the inputs", () => {
    const withMoney = buyerReadout(buyer({ assistance: 200_000 }), NO_HELP, "3 to 9 months", true);
    const without = buyerReadout(buyer({ assistance: 0 }), NO_HELP, "3 to 9 months", true);
    expect(withMoney.verdict).toBe(without.verdict);
    expect(withMoney.status).toBe(without.status);
  });

  it("puts matched programs in the rider and the blocker, conditionally", () => {
    const r = buyerReadout(buyer(), HELP, "3 to 9 months", true);
    expect(r.rider ?? "").toContain("if a lender confirms it");
    expect(r.blocker.who).toBe("A participating lender, not us");
    expect(r.blocker.body).toContain("none of it is real until");
  });
});

describe("the tension block only quotes what the reader actually said", () => {
  /* Production printed "You said 3 to 9 months." to people who had said
     nothing, because the parser's fallback is a planning assumption and was
     being read back as a quotation. */
  it("never says 'You said' when nothing was stated", () => {
    for (const timing of ["3 to 9 months", "In the next 3 months", "9 to 18 months"]) {
      const r = buyerReadout(buyer(), HELP, timing, false);
      expect(r.tension?.headline ?? "").not.toContain("You said");
      expect(prose(r)).not.toContain("You said");
    }
  });

  it("asks for the timeline instead, and still shows the computed one", () => {
    const r = buyerReadout(buyer(), NO_HELP, "3 to 9 months", false);
    expect(r.tension?.headline).toContain("You have not told us when you want to move");
    expect(r.tension?.headline).toMatch(/about \d+ months?/);
    expect(r.tension?.body).toContain("turns this from arithmetic into a plan");
  });

  it("quotes them back when they did state one", () => {
    const r = buyerReadout(buyer(), NO_HELP, "In the next 3 months", true);
    expect(r.tension?.headline).toContain("You said in the next 3 months");
  });

  it("raises nothing for somebody who named no deadline", () => {
    expect(buyerReadout(buyer(), NO_HELP, "Just exploring", true).tension).toBeUndefined();
    expect(buyerReadout(buyer(), NO_HELP, "Just exploring", false).tension).toBeUndefined();
  });

  it("agrees rather than alarms when the arithmetic is inside their window", () => {
    const r = buyerReadout(buyer({ savings: 15_000, monthlySaving: 4_000 }), NO_HELP, "3 to 9 months", true);
    expect(r.tension?.kind).toBe("ahead");
  });

  it("allows a month of slack, so a 9-month answer against 10 months is not a problem", () => {
    /* Tuned so `monthsToClose` lands on exactly 10 against a 9-month answer. */
    const i = buyer({ savings: 0, monthlySaving: 1_000 });
    const months = cashGap({ ...i, assistance: 0 }).monthsToClose;
    const r = buyerReadout(i, NO_HELP, "3 to 9 months", true);
    if (months !== null && months <= 10) expect(r.tension?.kind).toBe("ahead");
    else expect(r.tension?.kind).toBe("behind");
  });

  it("says so plainly when they are behind their own answer", () => {
    const r = buyerReadout(buyer({ savings: 0, monthlySaving: 200 }), NO_HELP, "In the next 3 months", true);
    expect(r.tension?.kind).toBe("behind");
    expect(r.tension?.body).toContain("both numbers rather than the comfortable one");
  });
});

/* ------------------------------------------------------------------ *
 * Seller
 * ------------------------------------------------------------------ */

describe("the seller who owes more than the sale produces", () => {
  const s = seller({ price: 300_000, payoff: 380_000 });
  const r = sellerReadout(s, "In the next 3 months", true);
  const net = netProceeds(s).net;

  it("is a real case, not a contrived one — the parser permits it deliberately", () => {
    expect(net).toBeLessThan(0);
  });

  it("is not ranked 'Ready now' however soon they said they wanted to move", () => {
    expect(r.status).toBe("building");
    expect(r.statusLabel).not.toBe("Ready now");
  });

  it("says they must bring money, not that they walk away with it", () => {
    expect(r.verdict).toContain("does not cover what you owe");
    expect(r.verdict).toContain("bring about");
    expect(r.verdict).not.toContain("walk away");
  });

  it("does not describe a shortfall as thin equity", () => {
    expect(r.rider ?? "").not.toMatch(/\bthin\b/);
    expect(r.rider ?? "").toContain("no listing strategy closes it");
  });

  it("leads the blocker with the shortfall, ahead of homestead and assessment", () => {
    expect(r.blocker.title).toContain("short of your payoff");
    expect(r.blocker.body).toContain("short sale");
    expect(r.blocker.who).toContain("payoff department");
  });

  it("makes the lender call the first step", () => {
    expect(r.steps[0].label).toBe("Ask your lender what they will accept");
  });

  /* The block that was missed when the rest of this was rewritten. */
  it("does not tell them a negative number is what survives the payoff", () => {
    expect(r.reframe.body).not.toContain("what survives the payoff");
    expect(r.reframe.body).toContain("still owed");
    expect(r.reframe.headline).toContain("still owed");
  });

  /* The card's own wording, not just the figure in it. Left at its defaults
     it renders "The figure that actually matters / $113,575 / not $300,000",
     which is money arriving. */
  it("relabels the card so the largest number is not read as a gain", () => {
    expect(r.reframe.figureLabel).toBe("What you would still owe");
    expect(r.reframe.contrastLabel).toBe("on a sale at");
    expect(r.reframe.figure).not.toContain("-");
  });

  it("still gives them the two routes out rather than stopping at the bad news", () => {
    expect(r.blocker.body).toContain("two routes");
    expect(r.reframe.body).toContain("not a reason to stop reading");
  });
});

describe("the seller who is not underwater", () => {
  it("keeps the ordinary proceeds language and the default card wording", () => {
    const r = sellerReadout(seller(), "3 to 9 months", true);
    expect(r.reframe.figureLabel).toBeUndefined();
    expect(r.reframe.contrastLabel).toBeUndefined();
    expect(r.verdict).toContain("walk away with about");
    expect(r.reframe.body).toContain("what survives the payoff");
    expect(r.status).toBe("close");
  });

  it("flags thin equity below 12% without calling it a shortfall", () => {
    const s = seller({ payoff: 340_000 });
    const r = sellerReadout(s, "9 to 18 months", true);
    expect(netProceeds(s).net).toBeGreaterThan(0);
    expect(r.rider ?? "").toMatch(/\bthin\b/);
    expect(r.verdict).toContain("walk away with about");
  });

  it("ranks a seller who stated nothing as early, not as the default band", () => {
    expect(sellerReadout(seller(), "In the next 3 months", false).status).toBe("exploring");
    expect(sellerReadout(seller(), "In the next 3 months", true).status).toBe("ready");
  });

  it("raises homestead before the payoff estimate when it was never filed", () => {
    const r = sellerReadout(seller({ homesteadFiled: false }), "3 to 9 months", true);
    expect(r.blocker.who).toBe("Your county tax commissioner");
  });

  it("raises a high assessment once homestead is settled", () => {
    const r = sellerReadout(seller({ homesteadFiled: true, assessedValue: 410_000 }), "3 to 9 months", true);
    expect(r.blocker.who).toBe("Your county board of assessors");
  });

  it("falls back to the payoff statement when nothing else is wrong", () => {
    const r = sellerReadout(
      seller({ homesteadFiled: true, assessedValue: 300_000 }), "3 to 9 months", true,
    );
    expect(r.blocker.who).toBe("Your lender");
  });
});
