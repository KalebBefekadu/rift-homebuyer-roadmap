import { describe, expect, it } from "vitest";
import { GEORGIA_PROGRAMS, checkProgram, matchAssistance, opensAt, thresholds, type Profile } from "./assistance";
import { BUYER_DEFAULTS, cashGap, cashToClose } from "./compute";
import { ifApproved } from "./if-approved";

/* docs/audit/value-depth-2026-10.md §4.1, and V3 (Kaleb, 13 Oct 2026). */
const today = new Date("2026-10-01T12:00:00Z");
const opts = { today, windowDays: 36_500, programs: GEORGIA_PROGRAMS };
const dream = GEORGIA_PROGRAMS.find((p) => p.slug === "ga-dream")!;

describe("how close they are to each program's limits", () => {
  it("says how far under the income limit and the price cap they are, in dollars", () => {
    const profile: Profile = { county: "Cobb", firstTime: true, price: 300_000, income: 100_000, household: 3, occupation: "other" };
    const t = thresholds(dream, profile);
    expect(t.income).toEqual({ limit: 158_188, room: 58_188, upTo: true });
    expect(t.price).toEqual({ max: 625_000, room: 325_000, upTo: true });
  });

  it("says nothing about a limit the program does not state or the answers cannot place", () => {
    const t = thresholds(dream, { county: "Cobb", firstTime: true, price: 300_000 });
    expect(t.income).toBeNull();
    const noCap = GEORGIA_PROGRAMS.find((p) => p.price === null)!;
    expect(thresholds(noCap, { county: "Cobb", firstTime: true, price: 300_000 }).price).toBeNull();
  });
});

describe("the price at which another program opens", () => {
  const profile: Profile = { county: "Gwinnett", firstTime: true, price: 450_000, income: 60_000, household: 3, occupation: "other" };

  it("finds programs that fit at a lower price and not at theirs, at the cap itself", () => {
    const opens = opensAt(profile, opts);
    expect(opens.length).toBeGreaterThan(0);
    for (const o of opens) {
      expect(o.price).toBeLessThan(profile.price);
      expect(checkProgram(o.program, { ...profile, price: o.price }).potential).toBe(true);
      expect(checkProgram(o.program, profile).potential).toBe(false);
    }
    expect(opens.map((o) => o.program.slug)).toContain("gwinnett-homestretch");
  });

  it("offers nothing a program fails for any reason other than price", () => {
    expect(opensAt({ ...profile, county: "Chatham" }, opts).map((o) => o.program.slug)).not.toContain("gwinnett-homestretch");
  });
});

describe("if approved: below the answer, never in it (rule 3, MONEY-02)", () => {
  const inputs = { ...BUYER_DEFAULTS, assistance: 0 };
  const r = matchAssistance({ county: "Cobb", firstTime: true, price: inputs.price, income: 70_000, household: 3, occupation: "other" }, opts);

  it("applies the single largest program, never a combination, to the cash and the months", () => {
    const x = ifApproved(inputs, r)!;
    expect(x.amount).toBe(r.best!.amount);
    expect(x.cash).toBeCloseTo(Math.max(cashToClose(inputs).total - x.amount, 0), 6);
    expect(x.months).toBe(cashGap({ ...inputs, assistance: x.amount }).monthsToClose);
    expect(x.monthsWithout).toBe(cashGap(inputs).monthsToClose);
  });

  it("never changes the inputs the headline is computed from", () => {
    ifApproved(inputs, r);
    expect(inputs.assistance).toBe(0);
  });

  it("has nothing to say with no match", () => {
    expect(ifApproved(inputs, { matches: [], best: null, combination: null, withheld: [] })).toBeNull();
  });
});
