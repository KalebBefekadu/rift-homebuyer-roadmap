import { describe, it, expect } from "vitest";
import { describeRate, FALLBACK_RATE, RATE_STALE_DAYS } from "./rate";

/**
 * The rate is the assumption the most figures depend on and the only one that
 * moves weekly. These pin the rule that it must always say when it was true.
 */
const TODAY = new Date("2026-09-07T12:00:00Z");

describe("the rate assumption", () => {
  it("always names its date, however fresh", () => {
    const r = describeRate(6.5, "Freddie Mac PMMS", "2026-09-07", TODAY);
    expect(r.freshness).toBe("fresh");
    expect(r.label).toContain("today");
    expect(r.label).toContain("Freddie Mac");
  });

  it("says a week-old rate is a guide, not a quote", () => {
    const r = describeRate(6.5, "Freddie Mac PMMS", "2026-08-28", TODAY);
    expect(r.freshness).toBe("ageing");
    expect(r.note).toContain("guide rather than a quote");
  });

  it("says outright when a rate is old enough to be wrong", () => {
    /* The failure this whole table exists to prevent: nothing breaks, the
       arithmetic stays correct, and the answer is wrong. */
    const r = describeRate(6.5, "Freddie Mac PMMS", "2026-05-01", TODAY);
    expect(r.freshness).toBe("stale");
    expect(r.ageDays).toBeGreaterThan(RATE_STALE_DAYS);
    expect(r.note).toContain("materially wrong");
  });

  it("does not dress the fallback up as an observation", () => {
    const r = describeRate(FALLBACK_RATE.pct, FALLBACK_RATE.source, null, TODAY);
    expect(r.freshness).toBe("stale");
    expect(r.label).toContain("at no recorded date");
    expect(r.note).toContain("starting assumption");
  });

  it("keeps the fallback at the rate the engine has always used", () => {
    /* Changing this silently would move every monthly figure in the product. */
    expect(FALLBACK_RATE.pct).toBe(6.5);
  });
});
