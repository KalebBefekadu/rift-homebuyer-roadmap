import { describe, it, expect } from "vitest";
import { cleanPlan, planSummary, planFacts } from "./saved-plan";

describe("a saved plan, as stored (Blueprint v5 §5.5, D14)", () => {
  it("records program alerts only when asked, and only for buyers", () => {
    expect(cleanPlan({ side: "buy", alerts: true }).alerts).toBe(true);
    expect(cleanPlan({ side: "buy" }).alerts).toBe(false);
    expect(cleanPlan({ side: "buy", alerts: "yes" }).alerts).toBe(false);
    expect(cleanPlan({ side: "sell", alerts: true }).alerts).toBe(false);
  });

  it("keeps only values from the catalogue, at their own addresses", () => {
    const p = cleanPlan({ side: "buy", values: [
      { tool: "cash", label: "x", figure: "$24,788", href: "/buy/cash-to-close?p=325000" },
      { tool: "cash", label: "again", figure: "$1", href: "/buy/cash-to-close" },
      { tool: "made-up", label: "x", figure: "$1", href: "/x" },
      { tool: "monthly", label: "x", figure: "$2,400", href: "https://elsewhere.test/buy/monthly-cost" },
    ] });
    expect(p.values.map((v) => v.tool)).toEqual(["cash"]);
    expect(p.values[0].label).toBe("Cash to close");
  });

  it("the agent's one line says what they did, from what they saved", () => {
    const p = cleanPlan({ side: "buy", answers: { price: 425000 }, values: [{ tool: "cash", figure: "$30,100", href: "/buy/cash-to-close" }] });
    expect(planSummary(p)).toBe("Saved a $425k plan: cash to close $30,100");
    expect(planSummary({ ...p, mode: "review", alerts: true })).toBe("Asked for a review of a $425k plan: cash to close $30,100; asked for program alerts");
  });
});

describe("what a follow-up may read from a saved plan", () => {
  it("reads county and first-time status from the answers, as the programs step matches on", () => {
    const p = cleanPlan({ side: "buy", answers: { county: "Cobb", ownership: "primary" }, values: [
      { tool: "cash", label: "x", figure: "$24,788", href: "/buy/cash-to-close?c=Cobb&s=9000" },
    ] });
    expect(planFacts(p)).toEqual({ county: "Cobb", firstTimeBuyer: false, againPath: "/buy/cash-to-close" });
  });

  it("links a value's bare page, never one carrying their answers", () => {
    const p = cleanPlan({ side: "buy", answers: { county: "Cobb", savings: 9000, income: 80000 }, values: [
      { tool: "cash", label: "x", figure: "$1", href: "/buy/cash-to-close?c=Cobb&s=9000&i=80000" },
    ] });
    expect(planFacts(p)!.againPath).toBe("/buy/cash-to-close");
  });

  it("fails towards more help, and towards no county rather than a wrong one", () => {
    /* The column is jsonb from whichever build saved it. */
    expect(planFacts({ side: "buy", answers: { county: "Atlantis", ownership: "castle" }, values: [] }))
      .toEqual({ county: null, firstTimeBuyer: true, againPath: "/buy" });
    expect(planFacts({ side: "sell", values: [{ tool: "nope" }] })).toEqual({ county: null, firstTimeBuyer: true, againPath: "/sell" });
  });

  it("is nothing without a plan", () => {
    expect(planFacts(null)).toBeNull();
    expect(planFacts("plan")).toBeNull();
  });
});
