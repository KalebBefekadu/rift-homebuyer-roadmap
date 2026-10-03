import { describe, it, expect } from "vitest";
import { leadStrip } from "./lead-strip";

describe("the figures a new lead is holding", () => {
  it("shows a buyer's four figures with the price and timing they gave, keeping a zero gap", () => {
    const s = leadStrip({
      side: "buy",
      figures: { cashToClose: 21450, gap: 0, monthly: 2610, assistance: 10000, verdict: "x" },
      facts: { value: 385000, timing: "In the next 3 months" },
    });
    expect(s.map((x) => [x.label, x.value])).toEqual([
      ["Home price", "$385,000"], ["Cash to close", "$21,450"], ["Still to find", "$0"],
      ["Monthly", "$2,610"], ["Assistance", "$10,000"], ["Timing", "In the next 3 months"],
    ]);
  });

  it("gives a seller a strip too: the price they gave and when, and a net only when one was stored", () => {
    const bare = leadStrip({ side: "sell", figures: { verdict: "At $540,000 you would keep about $214,000." }, facts: { value: 540000, timing: "In the next 3 months" } });
    expect(bare.map((x) => x.label)).toEqual(["Price they gave", "Timing"]);
    const withNet = leadStrip({ side: "sell", figures: { net: 214000 }, facts: { value: 540000, timing: null } });
    expect(withNet.map((x) => [x.label, x.value])).toEqual([["Price they gave", "$540,000"], ["Would keep", "$214,000"]]);
  });

  it("shows nothing for a lead with no figures and no facts rather than an empty frame", () => {
    expect(leadStrip({ side: "buy", figures: null })).toEqual([]);
    expect(leadStrip({ side: "buy", figures: {}, facts: { value: null, timing: null } })).toEqual([]);
  });
});
