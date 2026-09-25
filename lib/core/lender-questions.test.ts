import { describe, expect, it } from "vitest";
import { lenderQuestions } from "./lender-questions";
import { valuesFor, waysIn } from "./values";

describe("what to ask a lender", () => {
  it("asks about FHA mortgage insurance only for an FHA-sized down payment", () => {
    expect(lenderQuestions({ downPct: "3.5", credit: "700", ownership: "primary" }).some((q) => /FHA/.test(q.q))).toBe(true);
    expect(lenderQuestions({ downPct: "20", credit: "700", ownership: "primary" }).some((q) => /FHA/.test(q.q))).toBe(false);
  });

  it("asks about assistance only for someone who may count as a first-time buyer", () => {
    const has = (o: string) => lenderQuestions({ downPct: "5", credit: "700", ownership: o }).some((q) => /assistance/i.test(q.q));
    expect(has("none")).toBe(true);
    expect(has("primary")).toBe(false);
  });

  it("asks about minimums when credit is under 620, and about the tier when it is unknown", () => {
    expect(lenderQuestions({ downPct: "5", credit: "600", ownership: "none" }).some((q) => /minimum/.test(q.q))).toBe(true);
    expect(lenderQuestions({ downPct: "5", credit: "0", ownership: "none" }).some((q) => /credit tier/.test(q.q))).toBe(true);
  });

  it("supplies questions, never answers: no rate, fee or amount appears", () => {
    for (const q of lenderQuestions({ downPct: "3", credit: "560", ownership: "none" })) {
      expect(q.q + q.why).not.toMatch(/\$\d|\d+(\.\d+)?%(?! down)/);
    }
  });

  it("is offered after an answer, not as a fifth way in that would break the landing grid", () => {
    expect(valuesFor("buy").map((v) => v.id)).toContain("lender");
    expect(waysIn("buy").map((v) => v.id)).toEqual(["assistance", "cash", "monthly", "timeline"]);
  });
});
