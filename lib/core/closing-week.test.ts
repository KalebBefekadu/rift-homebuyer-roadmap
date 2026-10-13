import { describe, it, expect } from "vitest";
import { closingWeek, CLOSING_WEEK_DAYS } from "./closing-week";

describe("the week before closing (audit portals-2026-10, item 5)", () => {
  it("shows at Close, or when the closing date is within a week, and leads with the wire warning", () => {
    const atClose = closingWeek({ side: "buy", stage: "close", closingInDays: null, agentFirst: "Kaleb" });
    expect(atClose[0]!.id).toBe("wire");
    expect(atClose[0]!.body).toMatch(/on the number you saved/);
    expect(closingWeek({ side: "buy", stage: "under-contract", closingInDays: CLOSING_WEEK_DAYS, agentFirst: "Kaleb" }).length).toBeGreaterThan(0);
  });

  it("stays away earlier, after closing, and once a date has passed", () => {
    expect(closingWeek({ side: "buy", stage: "under-contract", closingInDays: CLOSING_WEEK_DAYS + 1, agentFirst: "Kaleb" })).toEqual([]);
    expect(closingWeek({ side: "buy", stage: "own", closingInDays: 0, agentFirst: "Kaleb" })).toEqual([]);
    expect(closingWeek({ side: "sell", stage: "continue", closingInDays: 0, agentFirst: "Kaleb" })).toEqual([]);
    expect(closingWeek({ side: "buy", stage: "under-contract", closingInDays: -1, agentFirst: "Kaleb" })).toEqual([]);
  });

  it("gives a seller the seller's list, and never states a figure", () => {
    const sell = closingWeek({ side: "sell", stage: "close", closingInDays: 2, agentFirst: "Kaleb" });
    expect(sell.map((i) => i.id)).toContain("keys");
    expect(sell.map((i) => i.id)).not.toContain("disclosure");
    for (const i of [...sell, ...closingWeek({ side: "buy", stage: "close", closingInDays: 2, agentFirst: "Kaleb" })]) {
      /* ic3.gov, the FBI's reporting site, is the one digit allowed. */
      expect(i.body.replace("ic3.gov", "")).not.toMatch(/\$|\d/);
    }
  });

  it("names the official page behind the wire warning and the disclosure rule", () => {
    const buy = closingWeek({ side: "buy", stage: "close", closingInDays: 1, agentFirst: "Kaleb" });
    expect(buy.find((i) => i.id === "wire")!.source!.url).toMatch(/^https:\/\/www\.consumerfinance\.gov\//);
    expect(buy.find((i) => i.id === "disclosure")!.body).toMatch(/three business days/);
    expect(buy.find((i) => i.id === "disclosure")!.source!.url).toMatch(/consumerfinance\.gov/);
  });
});

