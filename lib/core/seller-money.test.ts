import { describe, it, expect } from "vitest";
import { pricingError, scenarios, responseLine, type PricingInput, type Opinion } from "./pricing";
import { figureError, proceedsLine, viewFigures, type Figure, type FigureInput } from "./proceeds";
import { sellerNet } from "./seller";

const TODAY = "2026-09-28";
const opinion: PricingInput = {
  listPrice: 425_000, low: 410_000, high: 440_000,
  comps: [{ address: "14 Oak St, Decatur", price: 418_000, status: "sold", on: "2026-08-30", note: "Same street, one fewer bath" }],
  rationale: "Three sales on the street since June, all within two weeks on market.", reviewOn: "2026-10-12",
};

describe("pricing strategy (S04)", () => {
  it("is the agent's: a list price inside a range, chosen comparables with reasons, and a review date", () => {
    expect(pricingError(opinion, TODAY)).toBeNull();
    expect(pricingError({ ...opinion, listPrice: 450_000 }, TODAY)).toMatch(/inside your range/);
    expect(pricingError({ ...opinion, comps: [] }, TODAY)).toMatch(/at least one comparable/);
    expect(pricingError({ ...opinion, comps: [{ ...opinion.comps[0]!, note: "" }] }, TODAY)).toMatch(/why/);
    expect(pricingError({ ...opinion, comps: [{ ...opinion.comps[0]!, on: "2026-12-01" }] }, TODAY)).toMatch(/Give the day/);
    expect(pricingError({ ...opinion, reviewOn: "2026-09-01" }, TODAY)).toMatch(/review/);
  });

  it("shows the net at each end on the seller's terms, and never counts an unagreed commission", () => {
    const s = scenarios(opinion, { owed: 200_000, commissionPct: null, credits: 0 });
    expect(s.map((x) => x.price)).toEqual([410_000, 425_000, 440_000]);
    expect(s[1]!.net).toBe(sellerNet({ price: 425_000, payoff: 200_000, county: "", commissionPct: null }).net);
    const short = scenarios(opinion, { owed: 500_000, commissionPct: 5, credits: 0 });
    expect(short[0]!.text).toMatch(/short at closing/);
  });

  it("says who answered, and that nobody has when nobody has", () => {
    const o: Opinion = { ...opinion, id: "o", version: 1, by: "Kaleb", at: "2026-09-28T12:00:00Z", responses: [] };
    expect(responseLine(o)).toMatch(/Nobody/);
    expect(responseLine({ ...o, responses: [{ memberId: "m", name: "Eleanor", response: "discuss", note: "Can we try 435?", at: "x" }] })).toMatch(/Eleanor wants to talk first: "Can we try 435\?"/);
  });
});

const fig = (f: Partial<FigureInput>, at: string): Figure => ({
  kind: "planning", price: 425_000, owed: 200_000, owedSource: "balance", commissionPct: 5, credits: 0, officialNet: null,
  source: "Seller's answer", asOf: "2026-09-20", note: null, by: "Kaleb", at, ...f,
});

describe("final proceeds (S16)", () => {
  it("an official version needs the payoff statement and the statement's own net", () => {
    const ok: FigureInput = { ...fig({}, "x"), kind: "official", owedSource: "payoff-statement", officialNet: 181_000, source: "Settlement statement, Smith Law" };
    expect(figureError(ok, TODAY)).toBeNull();
    expect(figureError({ ...ok, owedSource: "balance" }, TODAY)).toMatch(/payoff statement, not a balance/);
    expect(figureError({ ...ok, officialNet: null }, TODAY)).toMatch(/settlement statement/);
    expect(figureError({ ...fig({}, "x"), officialNet: 1 }, TODAY)).toMatch(/Only the official/);
  });

  it("each version keeps its figures and says how it moved from the one before", () => {
    const views = viewFigures([
      fig({}, "2026-09-20T12:00:00Z"),
      fig({ kind: "revised", credits: 4_000, source: "Repair amendment" }, "2026-10-05T12:00:00Z"),
    ]);
    expect(views[1]!.change).toBeCloseTo(-4_000, 6);
    expect(views[0]!.lines.some((l) => /loan balance, not a payoff/.test(l.label))).toBe(true);
    expect(proceedsLine(views)).toMatch(/Revised: About \$[\d,]+ to you\. What is owed is a loan balance/);
  });

  it("the official net is what the seller reads, and a gap from the estimate is said", () => {
    const views = viewFigures([fig({ kind: "official", owedSource: "payoff-statement", officialNet: 150_000, source: "Settlement statement" }, "2026-10-30T12:00:00Z")]);
    expect(views[0]!.net).toBe(150_000);
    expect(proceedsLine(views)).toMatch(/differs from the estimate/);
  });
});
