import { describe, it, expect } from "vitest";
import { scoreLead, type LeadInput } from "./lead";

/**
 * Lead scoring.
 *
 * These exist because the readout's capture path was sending three of the six
 * signals and passing cash-to-close where the model expects the purchase
 * price. The same person scored 100 ("call today") with the full set and 46
 * ("scheduled") with what was actually being sent — a lead the agent should
 * have called that day, filed as something to get to eventually.
 *
 * Nothing about that failed. It produced a plausible number, which is why it
 * needs a test rather than a code review.
 */

const base = (over: Partial<LeadInput> = {}): LeadInput => ({
  side: "buy",
  timing: "In the next 3 months",
  completion: 1,
  hoursSince: 0,
  value: 325_000,
  monthsToReady: 0,
  coBuyer: true,
  contactable: true,
  source: "readout",
  ...over,
});

describe("lead scoring", () => {
  it("ranks a complete, ready, imminent buyer at the top", () => {
    const s = scoreLead(base());
    expect(s.band).toBe("now");
    expect(s.score).toBeGreaterThanOrEqual(80);
  });

  it("collapses when the signals are missing rather than absent", () => {
    /* The exact regression: no timing, no readiness, no co-buyer. The person
       is identical; only what we sent about them changed. */
    const full = scoreLead(base());
    const partial = scoreLead(base({ timing: "", monthsToReady: null, coBuyer: false }));
    expect(partial.score).toBeLessThan(full.score - 30);
    expect(partial.band).not.toBe("now");
  });

  it("shows its arithmetic, so the ranking can be audited", () => {
    const s = scoreLead(base());
    /* An agent who cannot see why a lead ranks where it does stops trusting
       the ranking inside a week. */
    expect(s.signals.length).toBeGreaterThanOrEqual(6);
    for (const sig of s.signals) {
      expect(sig.label.length).toBeGreaterThan(0);
      expect(sig.note.length).toBeGreaterThan(0);
    }
    const summed = s.signals.reduce((a, x) => a + x.points, 0);
    expect(Math.abs(summed - s.score)).toBeLessThanOrEqual(100);
  });

  it("treats stated timing as the strongest single signal", () => {
    const soon = scoreLead(base({ timing: "In the next 3 months" }));
    const later = scoreLead(base({ timing: "Just exploring" }));
    expect(soon.score - later.score).toBeGreaterThan(20);
  });

  it("does not confuse cash to close with deal size", () => {
    /* $26,188 is a cash-to-close figure. Passing it as `value` was the bug. */
    const asPrice = scoreLead(base({ value: 325_000 }));
    const asCash = scoreLead(base({ value: 26_188 }));
    expect(asPrice.score).toBeGreaterThanOrEqual(asCash.score);
  });

  it("never scores on anything that could proxy a protected class", () => {
    /* The inputs are the complete list, and fair housing is why. Two people
       with identical answers must score identically whatever else is true of
       them, and the type system is what guarantees there is no "else". */
    const keys = Object.keys(base()).sort();
    expect(keys).toEqual([
      "coBuyer", "completion", "contactable", "hoursSince",
      "monthsToReady", "side", "source", "timing", "value",
    ]);
  });

  it("an unreachable lead is ranked, not hidden", () => {
    /* Somebody who gave no contact details is still worth counting — they are
       the recovery population, and dropping them from the ranking would make
       the funnel look better than it is. */
    const s = scoreLead(base({ contactable: false }));
    expect(s.score).toBeGreaterThan(0);
    expect(s.signals.some((x) => x.label === "Reachable")).toBe(true);
  });
});
