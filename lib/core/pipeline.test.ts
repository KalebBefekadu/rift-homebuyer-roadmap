import { describe, expect, it } from "vitest";
import {
  BASIS_CHIP, HISTORY, STAGES, STALL_CHIP, evidenceMix, forecast, ruleFor,
  stallOf, weightFor, type Outcome,
} from "./pipeline";

/**
 * Who has stopped moving, and what is actually going to close.
 *
 * A relationship does not usually die of a decision; it dies of forty quiet
 * days. This module decides which client the agent calls today and what he
 * tells himself about his year — so a wrong answer here is not a wrong pixel,
 * it is a call not made and a hire made too early.
 */

describe("stall detection", () => {
  it("is quiet inside the normal window for the stage", () => {
    const s = stallOf("Under contract", 10);
    expect(s.level).toBe("moving");
    expect(s.reason).toBe("Inside the normal window for this stage.");
    expect(s.unstick).toBe("Nothing needed.");
  });

  it("warns at seven tenths of the window and calls it stalled at the whole of it", () => {
    const normal = ruleFor("Financing").normalDays;
    expect(normal).toBe(21);
    expect(stallOf("Financing", 14).level).toBe("moving"); // 0.667
    expect(stallOf("Financing", 15).level).toBe("slow");   // 0.714
    expect(stallOf("Financing", normal - 1).level).toBe("slow");
    expect(stallOf("Financing", normal).level).toBe("stalled");
    expect(stallOf("Financing", normal * 3).level).toBe("stalled");
  });

  it("measures each stage against its own window, not a single number", () => {
    /* 20 days is ordinary in Searching and a stall in Closing. */
    expect(stallOf("Searching", 20).level).toBe("moving");
    expect(stallOf("Closing", 20).level).toBe("stalled");
  });

  it("prefers a recorded blocker to its own guess", () => {
    const s = stallOf("Financing", 40, "Underwriter is waiting on her 2025 return.");
    expect(s.reason).toBe("Underwriter is waiting on her 2025 return.");
    expect(s.unstick).toBe("Resolve the blocker on the record.");
  });

  it("points at an overdue action ahead of anything else", () => {
    const s = stallOf("Financing", 40, undefined, "Overdue by 3 days");
    expect(s.reason).toContain("overdue");
    expect(s.unstick).toContain("it is the dependency");
  });

  it("treats no recorded cause as its own answer", () => {
    const s = stallOf("Financing", 40);
    expect(s.reason).toContain("Nothing is recorded as blocking it");
    expect(s.unstick).toContain("One call");
  });

  it("gives an unknown stage a defensible window rather than dividing by nothing", () => {
    const s = stallOf("Some stage nobody defined", 100);
    expect(Number.isFinite(s.normal)).toBe(true);
    expect(s.normal).toBeGreaterThan(0);
    expect(s.level).toBe("stalled");
  });

  it("has a chip for every level", () => {
    for (const level of ["moving", "slow", "stalled"] as const) {
      expect(STALL_CHIP[level].l).toBeTruthy();
      expect(STALL_CHIP[level].c).toBeTruthy();
    }
  });
});

describe("weights that shrink toward the agent's own history", () => {
  const stage = "Financing";
  const assumed = ruleFor(stage).weight;

  it("stays an assumption with no history at all, and says so", () => {
    const w = weightFor(stage, []);
    expect(w.weight).toBe(assumed);
    expect(w.basis).toBe("assumed");
    expect(w.note).toContain("not his number");
  });

  it("does not move on a handful of outcomes", () => {
    const three: Outcome[] = Array(3).fill({ stage, closed: true });
    const w = weightFor(stage, three);
    expect(w.weight).toBe(assumed);
    expect(w.basis).toBe("assumed");
  });

  /* The failure this exists to prevent: a solo agent forecasting from three
     closings and believing a stage converts at 100%. */
  it("never reports certainty from a small sample", () => {
    const four: Outcome[] = Array(4).fill({ stage, closed: true });
    const w = weightFor(stage, four);
    expect(w.basis).toBe("blended");
    expect(w.weight).toBeLessThan(1);
    expect(w.weight).toBeGreaterThan(assumed);
  });

  it("pulls toward the truth as the sample grows", () => {
    const at = (n: number) => weightFor(stage, Array(n).fill({ stage, closed: true })).weight;
    expect(at(4)).toBeLessThan(at(12));
    expect(at(12)).toBeLessThan(at(40));
    expect(at(200)).toBeGreaterThan(0.9);
  });

  it("moves down as readily as up", () => {
    const losses: Outcome[] = Array(20).fill({ stage, closed: false });
    expect(weightFor(stage, losses).weight).toBeLessThan(assumed);
  });

  it("counts only the stage it was asked about", () => {
    const other: Outcome[] = Array(50).fill({ stage: "Closing", closed: true });
    expect(weightFor(stage, other).basis).toBe("assumed");
    expect(weightFor(stage, other).n).toBe(0);
  });

  it("stays a probability whatever the history says", () => {
    for (const h of [[], Array(50).fill({ stage, closed: true }), Array(50).fill({ stage, closed: false })]) {
      const w = weightFor(stage, h as Outcome[]);
      expect(w.weight).toBeGreaterThanOrEqual(0);
      expect(w.weight).toBeLessThanOrEqual(1);
    }
  });

  it("labels every basis, so nobody has to remember which number has evidence", () => {
    for (const b of ["assumed", "blended", "observed"] as const) {
      expect(BASIS_CHIP[b].l).toBeTruthy();
    }
    expect(weightFor("Under contract", HISTORY).basis).toBe("observed");
    expect(weightFor("Exploring", HISTORY).basis).toBe("assumed");
  });

  it("reports how much of the forward view rests on evidence", () => {
    const mix = evidenceMix(["Under contract", "Exploring", "Searching"], HISTORY);
    expect(mix.total).toBe(3);
    expect(mix.observed + mix.blended + mix.assumed).toBe(3);
    expect(mix.observed).toBeGreaterThan(0);
    expect(mix.assumed).toBeGreaterThan(0);
  });
});

describe("the forward view", () => {
  const rows = [
    { name: "Maya", stage: "Under contract", value: 340_000 },
    { name: "Okafor", stage: "Reviewing offers", value: 415_000 },
    { name: "Pike", stage: "Searching", value: 300_000 },
  ];

  it("weights the count rather than listing wishes", () => {
    const bs = forecast(rows, new Date(2026, 8, 6), 6);
    const sum = (f: (b: (typeof bs)[number]) => number) => bs.reduce((n, b) => n + f(b), 0);
    expect(sum((b) => b.count)).toBe(rows.length);
    /* An unweighted pipeline forecast is a wish list, and a solo agent who
       plans his year on one hires too early and cuts too late. */
    expect(sum((b) => b.expected)).toBeLessThan(sum((b) => b.count));
    expect(sum((b) => b.weightedValue)).toBeLessThan(sum((b) => b.value));
  });

  it("drops anything closing outside the window", () => {
    const far = [{ name: "Early", stage: "Exploring", value: 1 }];
    const total = forecast(far, new Date(2026, 8, 6), 2).reduce((n, b) => n + b.count, 0);
    expect(total).toBe(0);
  });

  /**
   * Run on the last day of a month, `setMonth` rolled over: the four buckets
   * came out "Jan, Mar, Mar, May" — February and April gone, March twice —
   * while `idx` stayed correct, so February's deals were filed under the first
   * "Mar" and March's under the second.
   */
  it("produces consecutive months from any starting day", () => {
    for (const day of [1, 15, 28, 29, 30, 31]) {
      const months = forecast([], new Date(2026, 0, day), 4).map((b) => b.month);
      expect(months, `starting on ${day} January`).toEqual(["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026"]);
    }
  });

  it("crosses a year boundary without losing a month", () => {
    expect(forecast([], new Date(2026, 11, 31), 3).map((b) => b.month))
      .toEqual(["Dec 2026", "Jan 2027", "Feb 2027"]);
  });

  it("never repeats a month heading", () => {
    for (const day of [1, 30, 31]) {
      const months = forecast([], new Date(2026, 0, day), 6).map((b) => b.month);
      expect(new Set(months).size).toBe(months.length);
    }
  });

  it("files a deal under the month it is actually expected to close", () => {
    /* Under contract is 25 days to close; from 6 Sep that is 1 October. */
    const [sep, oct] = forecast([rows[0]], new Date(2026, 8, 6), 4);
    expect(sep.count).toBe(0);
    expect(oct.count).toBe(1);
    expect(oct.names).toEqual(["Maya"]);
  });

  it("takes the weakest basis in a bucket, so a month of guesses cannot look solid", () => {
    const from = new Date(2026, 8, 6);
    /* Both close in October: Under contract at 25 days, Reviewing offers at
       40. Alone, the first reports "his own history". */
    const strong = { name: "Strong", stage: "Under contract", value: 1 };
    const weaker = { name: "Weaker", stage: "Reviewing offers", value: 1 };

    const alone = forecast([strong], from, 4).find((b) => b.count > 0)!;
    expect(alone.basis).toBe("observed");

    const together = forecast([strong, weaker], from, 4).find((b) => b.count === 2)!;
    expect(together.basis).toBe(weightFor("Reviewing offers", HISTORY).basis);
    expect(together.basis).not.toBe("observed");
  });

  /* An empty bucket started at "observed" and was never pulled down, so a
     month with nothing in it rendered as "His own history". */
  it("claims no evidence for a month that holds nothing", () => {
    for (const b of forecast([], new Date(2026, 8, 6), 4)) {
      expect(b.count).toBe(0);
      expect(b.basis).toBe("assumed");
    }
  });

  it("asks for as many months as it was given", () => {
    expect(forecast(rows, new Date(2026, 8, 6), 7)).toHaveLength(7);
    expect(forecast(rows, new Date(2026, 8, 6), 1)).toHaveLength(1);
  });
});

describe("the stage table", () => {
  it("names each stage once", () => {
    const names = STAGES.map((s) => s.stage);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps every weight a probability and every window positive", () => {
    for (const s of STAGES) {
      expect(s.weight).toBeGreaterThan(0);
      expect(s.weight).toBeLessThanOrEqual(1);
      expect(s.normalDays).toBeGreaterThan(0);
      expect(s.toCloseDays).toBeGreaterThan(0);
    }
  });

  it("gets more likely and closer as it goes", () => {
    const contract = ruleFor("Under contract");
    const exploring = ruleFor("Exploring");
    expect(contract.weight).toBeGreaterThan(exploring.weight);
    expect(contract.toCloseDays).toBeLessThan(exploring.toCloseDays);
  });
});
