import { describe, it, expect } from "vitest";
import { matchAssistance } from "./assistance";
import { lenderQuestions } from "./lender-questions";

const today = new Date("2026-10-01T12:00:00Z");
const all = (g: ReturnType<typeof lenderQuestions>) => g.flatMap((x) => x.questions.map((q) => q.q)).join("\n");

describe("what to ask a lender (Blueprint v5 §5.2)", () => {
  it("asks about mortgage insurance only below 20% down", () => {
    expect(all(lenderQuestions({ price: 325_000, downPct: 3.5, firstTime: true, matches: [], combination: null }))).toMatch(/mortgage insurance/);
    expect(all(lenderQuestions({ price: 325_000, downPct: 20, firstTime: true, matches: [], combination: null }))).not.toMatch(/mortgage insurance/);
  });

  it("names the programs they may fit, and asks about combining only when the rules allow it", () => {
    const r = matchAssistance({ county: "DeKalb", firstTime: true, price: 325_000, income: 70_000, household: 2, occupation: "other" }, { today, windowDays: 90 });
    const text = all(lenderQuestions({ price: 325_000, downPct: 3.5, firstTime: true, matches: r.matches, combination: null }));
    expect(text).toContain(r.matches[0].program.name);
    expect(text).not.toMatch(/used together/);
  });

  it("with no programs checked, asks nothing about programs", () => {
    const g = lenderQuestions({ price: 325_000, downPct: 3.5, firstTime: false, matches: [], combination: null });
    expect(g.map((x) => x.title)).not.toContain("The programs you may fit");
    expect(all(g)).not.toMatch(/first-time/);
  });

  it("every question says why it matters", () => {
    for (const g of lenderQuestions({ price: 400_000, downPct: 5, firstTime: true, matches: [], combination: null }))
      for (const q of g.questions) expect(q.why.length, q.q).toBeGreaterThan(10);
  });
});
