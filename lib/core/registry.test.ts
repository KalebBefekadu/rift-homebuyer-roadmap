import { describe, it, expect } from "vitest";
import { matchPrograms, isStale, PROGRAMS, STALE_AFTER_DAYS, daysSinceVerified } from "./registry";
import { DEFAULT_RULES } from "./settings";

/**
 * The registry's honesty rules.
 *
 * Contract 4.4 drifted from the code without either noticing — the document
 * said suppression was silent to the customer, and the shipped readout told
 * them. The code was right; the contract has been reversed. These pin the
 * behaviour so the next disagreement is a failing test rather than a
 * discrepancy somebody finds by reading.
 */
const TODAY = new Date("2026-09-07T12:00:00Z");

describe("suppression", () => {
  it("reads the window from the business rules, never a constant", () => {
    /* Hard-coding 90 means the setting exists and changes nothing, which is
       worse than not having the setting. */
    expect(STALE_AFTER_DAYS).toBe(DEFAULT_RULES.registryDays.value);
  });

  it("keeps a stale fixture so the rule stays demonstrable", () => {
    /* A rule with no example is a rule nobody can check is working. */
    expect(PROGRAMS.some((p) => isStale(p, TODAY))).toBe(true);
  });

  it("returns suppressed programmes separately rather than dropping them", () => {
    /* Dropped, the customer cannot be told and the agent cannot be prompted.
       Separated, both are possible — and both happen. */
    const m = matchPrograms({ county: "DeKalb", firstTimeBuyer: true, today: TODAY });
    expect(m.suppressed.length).toBeGreaterThan(0);
    for (const p of m.suppressed) expect(daysSinceVerified(p, TODAY)).toBeGreaterThan(STALE_AFTER_DAYS);
    for (const p of m.matched) expect(daysSinceVerified(p, TODAY)).toBeLessThanOrEqual(STALE_AFTER_DAYS);
  });

  it("never counts a suppressed programme toward what somebody may receive", () => {
    const m = matchPrograms({ county: "DeKalb", firstTimeBuyer: true, today: TODAY });
    const suppressedValue = m.suppressed.reduce((a, p) => a + p.max, 0);
    const matchedValue = m.matched.reduce((a, p) => a + p.max, 0);
    expect(suppressedValue).toBeGreaterThan(0);
    expect(m.usableMax).toBe(matchedValue);
  });
});

describe("funding state is shown, never hidden", () => {
  it("a closed programme still appears, with its state", () => {
    /* Somebody planning around money that is not currently available needs to
       know it is not available — removing it silently lets them plan on it. */
    const closed = PROGRAMS.filter((p) => p.funding === "closed");
    expect(closed.length).toBeGreaterThan(0);
    const m = matchPrograms({ county: closed[0].county ?? "DeKalb", firstTimeBuyer: true, today: TODAY });
    const shown = [...m.matched, ...m.suppressed].map((p) => p.id);
    expect(shown).toContain(closed[0].id);
  });

  it("only open funding counts toward the headline range", () => {
    /* The headline is what they could plausibly get. A waitlist is not that. */
    const m = matchPrograms({ county: "Cobb", firstTimeBuyer: true, today: TODAY });
    expect(m.openMax).toBeLessThanOrEqual(m.usableMax);
  });
});

describe("matching is conservative", () => {
  it("a first-time-only programme never reaches somebody who is not", () => {
    const first = matchPrograms({ county: "DeKalb", firstTimeBuyer: true, today: TODAY });
    const repeat = matchPrograms({ county: "DeKalb", firstTimeBuyer: false, today: TODAY });
    const firstOnly = first.matched.filter((p) => p.firstTimeOnly).map((p) => p.id);
    expect(firstOnly.length).toBeGreaterThan(0);
    for (const id of firstOnly) expect(repeat.matched.map((p) => p.id)).not.toContain(id);
  });

  it("a county programme never reaches another county", () => {
    const dekalb = matchPrograms({ county: "DeKalb", firstTimeBuyer: true, today: TODAY });
    for (const p of dekalb.matched) {
      expect(p.county === null || p.county === "DeKalb").toBe(true);
    }
  });
});
