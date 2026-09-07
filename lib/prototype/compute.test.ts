import { describe, it, expect } from "vitest";
import {
  BUYER_DEFAULTS, monthlyPI, monthlyCost, cashToClose, cashGap,
  type BuyerInputs,
} from "./compute";

/**
 * The executable half of docs/calculations.md.
 *
 * This is the seed test, and it is deliberately the first one in the repo: the
 * handoff prescribes writing acceptance tests before features, and a test suite
 * with nothing in it is an intention rather than a harness. Every rule below is
 * one that fails as a WRONG NUMBER rather than as an error, which is the only
 * class of bug this product cannot survive.
 *
 * Keep this file and docs/calculations.md in the same commit whenever the
 * contract moves.
 */

const buyer = (over: Partial<BuyerInputs> = {}): BuyerInputs => ({ ...BUYER_DEFAULTS, ...over });

describe("the reference case", () => {
  /* Pinned so a refactor that silently changes a customer-facing figure fails
     here rather than in front of somebody planning their life on it. */
  const i = buyer();

  it("produces the documented cash to close", () => {
    expect(cashToClose(i).total).toBeCloseTo(26_187.5, 2);
  });

  it("produces the documented down payment and loan", () => {
    const c = cashToClose(i);
    expect(c.down).toBe(11_375);
    expect(i.price - c.down).toBe(313_625);
  });

  it("produces the documented monthly", () => {
    const m = monthlyCost(i);
    expect(m.pi).toBeCloseTo(1_982.32, 1);
    expect(m.total).toBeCloseTo(2_547.47, 1);
  });

  it("produces the documented gap and timeline", () => {
    const g = cashGap(i);
    expect(g.gap).toBeCloseTo(17_187.5, 2);
    expect(g.fullyCovered).toBe(false);
    expect(g.monthsToClose).toBe(27);
  });
});

describe("cash to close", () => {
  it("credits earnest money back rather than counting it twice", () => {
    const c = cashToClose(buyer());
    const earnest = c.lines.find((l) => l.credited);
    expect(earnest).toBeDefined();
    /* The line is shown to the buyer, and it is NOT in the total. Both halves
       matter: hiding it understates the day; counting it overstates the year. */
    const summed = c.lines.filter((l) => !l.credited).reduce((s, l) => s + l.amount, 0);
    expect(c.total).toBeCloseTo(summed, 6);
    expect(c.total).toBeLessThan(summed + earnest!.amount);
  });

  it("is larger than the down payment, which is the entire point", () => {
    const c = cashToClose(buyer());
    expect(c.total).toBeGreaterThan(c.down * 2);
  });

  it("carries its assumptions and its failure mode", () => {
    const c = cashToClose(buyer());
    expect(c.assumptions.length).toBeGreaterThan(0);
    expect(c.couldBeWrong.length).toBeGreaterThan(20);
  });
});

describe("monthly principal and interest", () => {
  it("uses loan/n at a zero rate instead of dividing by zero", () => {
    const pi = monthlyPI(300_000, 0, 30);
    expect(pi).toBeCloseTo(300_000 / 360, 6);
    expect(Number.isNaN(pi)).toBe(false);
  });

  it("returns zero for a zero loan", () => {
    expect(monthlyPI(0, 6.5, 30)).toBe(0);
  });
});

describe("PMI", () => {
  it("disappears at twenty percent down", () => {
    expect(monthlyCost(buyer({ downPct: 20 })).pmi).toBe(0);
  });

  it("is charged below twenty percent down", () => {
    expect(monthlyCost(buyer({ downPct: 3.5 })).pmi).toBeGreaterThan(0);
  });
});

describe("the gap", () => {
  it("floors at zero and reports fullyCovered rather than a negative", () => {
    const g = cashGap(buyer({ savings: 500_000 }));
    expect(g.gap).toBe(0);
    expect(g.fullyCovered).toBe(true);
    expect(g.monthsToClose).toBe(0);
  });

  it("reports an unknown timeline as null, never as zero", () => {
    /* Zero would read as "ready today" on the readout. It is the opposite. */
    const g = cashGap(buyer({ monthlySaving: 0 }));
    expect(g.gap).toBeGreaterThan(0);
    expect(g.monthsToClose).toBeNull();
  });

  it("counts assistance only when it is passed in", () => {
    const without = cashGap(buyer({ assistance: 0 }));
    const withHelp = cashGap(buyer({ assistance: 10_000 }));
    expect(without.gap - withHelp.gap).toBe(10_000);
  });
});

/* ------------------------------------------------------------------ *
 * The readout's timing tension
 *
 * Guards the thing the assessment was collecting and discarding: the buyer's
 * stated timing was asked, was the strongest signal in the lead score, was
 * passed into `buyerReadout` — and was never read. Somebody could say "in the
 * next 3 months", be told they were 18 months out, and never see the two
 * numbers put next to each other.
 * ------------------------------------------------------------------ */

import { buyerReadout } from "./results";
import { matchPrograms } from "./registry";

const readout = (over: Partial<BuyerInputs>, timing: string) => {
  const i = buyer({ assistance: 0, ...over });
  return buyerReadout(i, matchPrograms({ county: i.county, firstTimeBuyer: true }), timing);
};

describe("timing tension", () => {
  it("names the collision when they are further out than they said", () => {
    const t = readout({ savings: 9_000, monthlySaving: 650 }, "In the next 3 months").tension;
    expect(t?.kind).toBe("behind");
    expect(t?.headline).toContain("in the next 3 months");
  });

  it("stays silent when nobody named a deadline", () => {
    /* "Just exploring" sets no date, so there is no date to be behind. */
    expect(readout({}, "Just exploring").tension).toBeUndefined();
  });

  it("agrees rather than warns when the timelines match", () => {
    /* $17,187.50 gap at $1,000/month is 18 months, against an 18-month answer. */
    const t = readout({ savings: 9_000, monthlySaving: 1_000 }, "9 to 18 months").tension;
    expect(t?.kind).toBe("ahead");
    expect(t?.headline).toContain("the arithmetic agrees");
  });

  it("does not flag a one-month overrun as a problem", () => {
    /* A 9-month answer against 10-month arithmetic is not somebody in trouble,
       and crying wolf here is how the whole panel gets ignored. */
    /* 10 months against a 9-month answer. One month of slack, deliberately. */
    const t = readout({ savings: 9_000, monthlySaving: 1_750 }, "3 to 9 months").tension;
    expect(t?.kind).toBe("ahead");
  });

  it("says the timeline is unknowable rather than guessing, with no saving rate", () => {
    const t = readout({ monthlySaving: 0 }, "In the next 3 months").tension;
    expect(t?.kind).toBe("behind");
    expect(t?.headline).toContain("cannot tell you");
  });

  it("never folds assistance into the headline it compares against", () => {
    /* The comparison is savings-only, like every other headline figure.
       Assistance may appear in the body as conditional upside — never above. */
    const t = readout({ savings: 9_000, monthlySaving: 650 }, "In the next 3 months").tension;
    expect(t?.headline).toContain("On savings alone");
  });
});
