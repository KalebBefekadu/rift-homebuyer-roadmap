import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { valuesFor, VALUES } from "./values";
import { ASKS } from "./asks";
import { STATUSES, abroadReturns, ASSUMPTIONS } from "./abroad";

/* Blueprint v5 §5.4: can I buy, what it costs, the return, in that order. */
describe("the abroad values", () => {
  it("are live in D20 order, each on its own page", () => {
    expect(valuesFor("abroad").map((v) => v.id)).toEqual(["eligibility", "abroad-cost", "abroad-return"]);
    for (const v of valuesFor("abroad")) expect(v.href).not.toBe("/abroad/results");
  });

  it("ask the shared status question, whose choices are exactly the lenders' four situations", () => {
    expect(ASKS.status.options!.map((o) => o.value).sort()).toEqual(STATUSES.map((s) => s.id).sort());
  });

  it("never ask the return what the home is for: a return only exists if it is rented", () => {
    expect(VALUES.find((v) => v.id === "abroad-return")!.asks).not.toContain("use");
  });

  it("answer 'can I own it' the same way for every situation: yes, with a down payment below 100%", () => {
    for (const s of STATUSES) for (const u of ["live", "rent"] as const) expect(s.down[u]).toBeLessThan(100);
  });

  it("say the United States, not Georgia, about being allowed to buy (Kaleb, R1)", () => {
    const src = readFileSync("app/(rift)/abroad/can-i-buy/page.tsx", "utf8");
    expect(src).toContain("to own property in the United States");
  });

  it("cost shows no rent: the cash to send and the monthly cost do not depend on the county", () => {
    const at = (county: string) => abroadReturns({ price: 300_000, county, status: "foreign", use: "rent" }, ASSUMPTIONS);
    expect(at("Cobb").cashIn).toBe(at("Clayton").cashIn);
    expect(at("Cobb").monthly.total).toBe(at("Clayton").monthly.total);
  });
});
