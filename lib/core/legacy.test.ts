import { describe, expect, it } from "vitest";
import { legacySellerTarget } from "./legacy";

const from = (qs: string) => {
  const p = new URLSearchParams(qs);
  return legacySellerTarget((k) => p.get(k) ?? undefined);
};

describe("old seller addresses", () => {
  it("send a bare visit to the seller landing", () => {
    expect(from("")).toBe("/sell");
  });

  it("carry price and payoff into what you'd keep, under the new names", () => {
    expect(from("c=Fulton&p=400000&o=200000&y=6&t=3+to+9+months")).toBe("/sell/proceeds?p=400000&po=200000");
  });

  it("drop a figure the new value would refuse, so it is asked rather than carried", () => {
    expect(from("p=12&o=200000")).toBe("/sell/proceeds?po=200000");
  });

  it("keep campaign tags and a referral handle, so first touch is not lost", () => {
    expect(from("utm_source=news&utm_campaign=fall&r=3f9a0c1b2d4e5f6a7b8c9d0e"))
      .toBe("/sell?utm_source=news&utm_campaign=fall&r=3f9a0c1b2d4e5f6a7b8c9d0e");
  });

  it("does not pass a number off as a referral", () => {
    expect(from("r=650")).toBe("/sell");
  });
});
