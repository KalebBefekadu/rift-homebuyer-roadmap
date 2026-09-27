import { describe, it, expect } from "vitest";
import { forwardTo, BUY_READOUT_RENAME, SELL_RENAME } from "./forward";
import { ASKS } from "./asks";

describe("forwarding a retired address (Blueprint v5 §5.8)", () => {
  it("keeps the answers under the values' names, and the campaign tags", () => {
    expect(forwardTo("/sell/proceeds", { c: "Cobb", p: "400000", o: "200000", utm_source: "fb", t: "3 to 9 months" }, SELL_RENAME))
      .toBe("/sell/proceeds?c=Cobb&sp=400000&po=200000&utm_source=fb");
  });

  it("drops anything it does not know", () => {
    expect(forwardTo("/buy/cash-to-close", { w: "1", junk: "x" }, BUY_READOUT_RENAME)).toBe("/buy/cash-to-close");
  });

  it("never lands an old monthly saving on the referral handle", () => {
    const to = forwardTo("/buy/cash-to-close", { r: "650" }, BUY_READOUT_RENAME);
    expect(to).toBe("/buy/cash-to-close?ms=650");
    expect(new URL(to, "https://x.test").searchParams.get("r")).toBeNull();
  });

  it("every answer's parameter is its own, and none is one attribution reads", () => {
    const params = Object.values(ASKS).map((a) => a.param);
    expect(new Set(params).size).toBe(params.length);
    for (const reserved of ["r", "utm_source", "utm_medium", "utm_campaign", "ask", "lang"]) expect(params).not.toContain(reserved);
  });

  it("the renames point at real answers", () => {
    const params = new Set(Object.values(ASKS).map((a) => a.param));
    for (const to of [...Object.values(BUY_READOUT_RENAME), ...Object.values(SELL_RENAME)]) expect(params).toContain(to);
  });
});
