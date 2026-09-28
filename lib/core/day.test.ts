import { describe, it, expect } from "vitest";
import { georgiaDay } from "./day";
import { cleanPlan } from "./saved-plan";

describe("the day in Georgia (DATE-01)", () => {
  it("is still today at nine in the evening, when London is already tomorrow", () => {
    /* 01:00 UTC on 28 Sep is 9pm on 27 Sep in Atlanta (EDT). */
    expect(georgiaDay(new Date("2026-09-28T01:00:00Z"))).toBe("2026-09-27");
    /* And in winter (EST), 11:30pm on 31 Jan. */
    expect(georgiaDay(new Date("2026-02-01T04:30:00Z"))).toBe("2026-01-31");
  });

  it("moves by whole calendar days, across months and the clock change", () => {
    expect(georgiaDay(new Date("2026-09-28T01:00:00Z"), 7)).toBe("2026-10-04");
    expect(georgiaDay(new Date("2026-11-01T15:00:00Z"), 1)).toBe("2026-11-02");
    expect(georgiaDay(new Date("2026-03-01T15:00:00Z"), -1)).toBe("2026-02-28");
  });

  it("dates a plan saved after dinner on the day it was saved", () => {
    const plan = cleanPlan({ side: "buy", values: [], answers: {} }, new Date("2026-09-28T01:30:00Z"));
    expect(plan.savedOn).toBe("2026-09-27");
  });
});
