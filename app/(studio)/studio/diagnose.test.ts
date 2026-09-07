import { describe, it, expect } from "vitest";
import { diagnose } from "./diagnose";

/**
 * What a drop-off means.
 *
 * The whole point of this function is that a percentage alone cannot separate
 * two cases that want opposite remedies, and getting it backwards makes the
 * problem worse: rewording a question people understood and declined to answer
 * does not help, and attaching a reason to a question people bounced off does
 * not either.
 *
 * Verified against 26 seeded sessions before these were written — `savings`
 * dropped 54% at 26s and `rate` dropped 50% at 4.2s, and the two came out with
 * different advice. These pin that so it survives a threshold being nudged.
 */
const step = (over: Partial<Parameters<typeof diagnose>[0]> = {}) => ({
  questionKey: "savings", reached: 26, answered: 12, dropPct: 54, medianSec: 26, ...over,
});

describe("drop-off diagnosis", () => {
  it("says nothing when a question is behaving", () => {
    /* Silence is the correct output for a healthy step. A dashboard that
       comments on everything trains people to read none of it. */
    expect(diagnose(step({ dropPct: 6, medianSec: 3 }))).toBeNull();
  });

  it("a long dwell means they read it and declined", () => {
    const d = diagnose(step({ dropPct: 54, medianSec: 26 }))!;
    expect(d.label).toBe("Too personal");
    expect(d.advice).toContain("rewording a question people understood will not help");
  });

  it("a short dwell means they bounced off it", () => {
    const d = diagnose(step({ dropPct: 50, medianSec: 2 }))!;
    expect(d.label).toBe("Bounced off");
    expect(d.advice).toContain("wording or format");
  });

  it("separates the two on dwell alone, at the same drop rate", () => {
    /* This is the entire claim. If it ever stops being true the feature has
       become a percentage with a colour on it. */
    const declined = diagnose(step({ dropPct: 50, medianSec: 26 }))!;
    const bounced = diagnose(step({ dropPct: 50, medianSec: 2 }))!;
    expect(declined.label).not.toBe(bounced.label);
    expect(declined.advice).not.toBe(bounced.advice);
  });

  it("does not guess when the dwell is ordinary", () => {
    /* Between the two, the honest answer is that we do not know — so it says
       to read the question aloud rather than inventing a cause. */
    const d = diagnose(step({ dropPct: 50, medianSec: 6 }))!;
    expect(d.label).toBe("Losing people");
    expect(d.advice).toContain("aloud");
  });
});
