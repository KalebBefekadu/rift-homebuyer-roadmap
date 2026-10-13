import { describe, expect, it } from "vitest";
import { BUYER_DEFAULTS, PRICE_GROWTH_PCT, cashGap, type BuyerInputs } from "./compute";
import { ASSUMPTIONS } from "./abroad";
import { DOWN_OPTIONS, SELLER_HELP_MAX, timelinePlan } from "./timeline";

/* docs/audit/value-depth-2026-10.md §4.4. The reference buyer: $325,000 at
   3.5% down, $9,000 saved, $650 a month: 25 months on savings alone. */
const base: BuyerInputs = { ...BUYER_DEFAULTS, assistance: 0 };
const months = (i: BuyerInputs) => cashGap(i).monthsToClose;

describe("a stated date against the computed one (rule 11, handoff §4.15)", () => {
  it("compares only when they named a date: 'just exploring' asserts nothing", () => {
    expect(timelinePlan(base, "exploring").stated).toBeNull();
    const p = timelinePlan(base, 6);
    expect(p.stated).toEqual({ months: 6, computed: 25, late: 19, onTrack: false });
  });

  it("a one-month overrun is not a collision", () => {
    expect(timelinePlan(base, 24).stated!.onTrack).toBe(true);
    expect(timelinePlan(base, 23).stated!.onTrack).toBe(false);
  });

  it("with nothing set aside each month there is no computed date, and it is not on track", () => {
    const p = timelinePlan({ ...base, monthlySaving: 0 }, 12);
    expect(p.stated).toEqual({ months: 12, computed: null, late: null, onTrack: false });
  });
});

describe("the smallest change that meets their date, on each lever", () => {
  const target = 12;
  const plan = timelinePlan(base, target);
  const lever = (id: string) => plan.forTarget.find((l) => l.id === id);

  it("solves a monthly saving that meets the date, and $10 less would not", () => {
    const l = lever("saving")!;
    expect(months({ ...base, monthlySaving: l.to })!).toBeLessThanOrEqual(target);
    expect(months({ ...base, monthlySaving: l.to - 10 })!).toBeGreaterThan(target);
  });

  it("solves a price that meets the date, and $5,000 more would not", () => {
    const l = lever("price")!;
    expect(months({ ...base, price: l.to })!).toBeLessThanOrEqual(target);
    expect(months({ ...base, price: l.to + 5_000 })!).toBeGreaterThan(target);
  });

  it("picks the down payment closest to theirs that meets the date, and only a smaller one", () => {
    const tenDown = { ...base, downPct: 10 };
    const l = timelinePlan(tenDown, 30).forTarget.find((x) => x.id === "down")!;
    expect(DOWN_OPTIONS).toContain(l.to);
    expect(l.to).toBeLessThan(10);
    expect(l.to).toBe(3.5);
    expect(months({ ...tenDown, downPct: l.to })!).toBeLessThanOrEqual(30);
    const closer = DOWN_OPTIONS.filter((d) => d > l.to && d < 10);
    expect(closer).toEqual([5]);
    for (const d of closer) expect(months({ ...tenDown, downPct: d })!).toBeGreaterThan(30);
  });

  it("asks for seller help in half points, never above the cap, and half a point less would not do", () => {
    const p = timelinePlan(base, 20);
    const l = p.forTarget.find((x) => x.id === "seller")!;
    expect(l.to).toBeLessThanOrEqual(SELLER_HELP_MAX);
    expect(months({ ...base, closingPct: base.closingPct - l.to })!).toBeLessThanOrEqual(20);
    expect(months({ ...base, closingPct: base.closingPct - (l.to - 0.5) })!).toBeGreaterThan(20);
    expect(timelinePlan(base, 3).forTarget.find((x) => x.id === "seller")).toBeUndefined();
  });

  it("offers no levers for a date they already meet, or when they are exploring", () => {
    expect(timelinePlan(base, 24).forTarget).toEqual([]);
    expect(timelinePlan(base, "exploring").forTarget).toEqual([]);
  });
});

describe("the moving target", () => {
  it("uses the same planning growth rate as the abroad return", () => {
    expect(ASSUMPTIONS.appreciationPct).toBe(PRICE_GROWTH_PCT);
  });

  it("is 28 months on the reference case, against 25 with prices standing still", () => {
    const p = timelinePlan(base, "exploring");
    expect(p.moving).not.toBeNull();
    expect(p.moving!.months).toBe(28);
    expect(p.moving!.price).toBeGreaterThan(base.price);
  });

  it("is never shorter than the standing-still figure", () => {
    for (const monthlySaving of [200, 650, 1_500, 4_000]) {
      for (const price of [180_000, 325_000, 700_000]) {
        const i = { ...base, monthlySaving, price };
        const p = timelinePlan(i, "exploring");
        if (p.moving) expect(p.moving.months).toBeGreaterThanOrEqual(months(i)!);
      }
    }
  });

  it("has nothing to say when they are covered or set nothing aside", () => {
    expect(timelinePlan({ ...base, savings: 100_000 }, "exploring").moving).toBeNull();
    expect(timelinePlan({ ...base, monthlySaving: 0 }, "exploring").moving).toBeNull();
  });
});
