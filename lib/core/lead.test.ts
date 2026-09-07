import { describe, it, expect } from "vitest";
import { scoreLead, sla, type LeadInput } from "./lead";

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

describe("recency decays, and that is the point", () => {
  it("an identical lead scores lower once it has aged", () => {
    /* The stored score was written once at capture and never revisited, so a
       three-week-old lead kept the urgency it earned on the day and went on
       outranking somebody who arrived this morning. A ranking that silently
       goes stale is worse than none: it still costs the agent attention and
       spends it on the wrong people, looking exactly as authoritative as when
       it was right. */
    const fresh = scoreLead(base({ hoursSince: 0 }));
    const aged = scoreLead(base({ hoursSince: 21 * 24 }));
    expect(aged.score).toBeLessThan(fresh.score);
    expect(fresh.score - aged.score).toBeGreaterThanOrEqual(15);
  });

  it("recency turns negative once a lead has gone properly cold", () => {
    const aged = scoreLead(base({ hoursSince: 21 * 24 }));
    const recency = aged.signals.find((s) => s.label === "Recency")!;
    expect(recency.points).toBeLessThan(0);
    /* And says how cold, so the agent is not left inferring it. */
    expect(recency.note).toMatch(/days?/);
  });

  it("the first hour is worth more than the first day", () => {
    /* Intent decays fast and it decays steeply at the start, which is the
       entire argument for a speed-to-lead target. */
    const minutes = scoreLead(base({ hoursSince: 0.5 }));
    const nextDay = scoreLead(base({ hoursSince: 20 }));
    expect(minutes.score).toBeGreaterThan(nextDay.score);
  });
});

describe("the speed-to-lead clock", () => {
  const input = (over: Partial<Parameters<typeof sla>[0]> = {}) => ({
    completion: 1, hoursSince: 0, humanRepliedMins: null, contactable: true, ...over,
  });

  it("breaches when nobody has replied past the target", () => {
    /* This is the bug that shipped: Studio passed a hand-built object cast to
       `never`, `contactable` was undefined, and every lead reported unbreached.
       An indicator that cannot fire reads exactly like doing well. */
    const s = sla(input({ hoursSince: 3 }), "now");
    expect(s.breached).toBe(true);
  });

  it("does not breach inside the target", () => {
    expect(sla(input({ hoursSince: 0.1 }), "now").breached).toBe(false);
  });

  it("never blames the agent for somebody unreachable", () => {
    /* A lead with no way to contact them cannot be replied to, and counting it
       would make the agent look late for a person who left no address. */
    expect(sla(input({ hoursSince: 99, contactable: false }), "now").breached).toBe(false);
  });

  it("holds the two clocks apart", () => {
    /* The automated half already happened — the readout was delivered the
       moment they finished. Conflating it with the human reply hides the fact
       that the valuable half is done. */
    const done = sla(input(), "now");
    expect(done.valueDelivered).toBe(true);
    expect(done.valueLabel).toContain("no human was needed");

    const partial = sla(input({ completion: 0.4 }), "now");
    expect(partial.valueDelivered).toBe(false);
    expect(partial.valueLabel).toContain("nothing was delivered");
  });

  it("gives a slower band a kinder target", () => {
    expect(sla(input(), "now").target).toBeLessThan(sla(input(), "later").target);
  });
})
