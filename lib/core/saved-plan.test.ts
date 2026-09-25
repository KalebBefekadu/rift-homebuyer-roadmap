import { describe, expect, it } from "vitest";
import { cleanPlan, leadSummary, type SavedPlan } from "./saved-plan";

const plan = (over: Partial<SavedPlan> = {}): SavedPlan => ({
  mode: "save", side: "buy", savedOn: "2026-09-25",
  answers: { price: 425_000 },
  values: [{ tool: "cash", label: "Cash to close", figure: "$24,788", href: "/buy/cash-to-close?p=425000" }],
  ...over,
});

describe("the lead summary in Operations (§5.5)", () => {
  it("says what they saved, the price, and whether a call is booked", () => {
    expect(leadSummary(plan(), false)).toBe("Saved a plan on a $425k plan: cash to close $24,788 · no call booked");
    expect(leadSummary(plan({ mode: "review" }), true)).toMatch(/^Asked for a review .* · call booked$/);
  });

  it("says nothing when they did nothing it can name, rather than inventing activity", () => {
    expect(leadSummary(null, false)).toBeNull();
    expect(leadSummary(null, true)).toBe("Booked a call");
  });

  it("is built only from a cleaned plan: a value outside the catalogue never reaches it", () => {
    const p = cleanPlan({ side: "buy", values: [{ tool: "made-up", figure: "$1", href: "/x" }], answers: {} });
    expect(leadSummary(p, false)).toBe("Saved a plan · no call booked");
  });
});

describe("a saved plan as the start of the search brief (LEAD-04)", () => {
  it("gives the price as a ceiling and the county as the area, dated and not decided", async () => {
    const { briefStartFromPlan } = await import("./saved-plan");
    const { criterionError } = await import("./search");
    const start = briefStartFromPlan(plan({ answers: { price: 425_000, county: "DeKalb" } }))!;
    expect(start.from).toBe("saved plan of 2026-09-25");
    expect(start.criteria.map((c) => [c.field, c.operator, c.value, c.strength])).toEqual([
      ["price", "atMost", 425_000, "undecided"],
      ["geography", "oneOf", ["DeKalb County"], "undecided"],
    ]);
    /* Valid criteria, so the editor can save them as they are. */
    for (const c of start.criteria) expect(criterionError(c)).toBeNull();
  });

  it("gives nothing for a seller's plan, or a plan with nothing that describes a home", async () => {
    const { briefStartFromPlan } = await import("./saved-plan");
    expect(briefStartFromPlan(plan({ side: "sell" }))).toBeNull();
    expect(briefStartFromPlan(plan({ answers: { downPct: "3.5" } }))).toBeNull();
  });
});
