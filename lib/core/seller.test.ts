import { describe, it, expect } from "vitest";
import { saleCosts, sellerNet, preparePlan, breakEvenPrice, netSensitivity, SELLER_SETTLEMENT, PAYOFF_FEES, proratedTax } from "./seller";
import { GA_TRANSFER_TAX_RATE } from "./compute";

const base = { price: 400_000, payoff: 200_000, county: "Cobb", commissionPct: 5 as number | null };

describe("what you would keep (Blueprint v5 §5.3, MONEY-06)", () => {
  it("is the price less the payoff and each cost, each counted once", () => {
    const r = sellerNet(base);
    const costs = 20_000 + 400_000 * GA_TRANSFER_TAX_RATE + SELLER_SETTLEMENT + proratedTax(400_000) + PAYOFF_FEES;
    expect(r.costs.total).toBe(costs);
    expect(r.net).toBe(400_000 - 200_000 - costs);
    expect(new Set(r.costs.lines.map((l) => l.label)).size).toBe(r.costs.lines.length);
  });

  it("never assumes a commission: not agreed leaves it out and says what each percent is", () => {
    const r = sellerNet({ ...base, commissionPct: null });
    expect(r.costs.lines.map((l) => l.label)).not.toContain("Commission");
    expect(r.costs.commissionKnown).toBe(false);
    expect(r.costs.perPoint).toBe(4_000);
    expect(r.assumptions.find((a) => a.label === "Commission")!.value).toMatch(/not agreed/i);
  });

  it("does not count moving or a concession nobody has agreed", () => {
    const labels = sellerNet(base).costs.lines.map((l) => l.label.toLowerCase()).join(" ");
    expect(labels).not.toMatch(/moving|concession|repair/);
  });

  it("a sale below what is owed is a shortfall, not a negative amount reaching them", () => {
    const r = sellerNet({ ...base, payoff: 420_000 });
    expect(r.net).toBeLessThan(0);
    expect(r.shortfall).toBe(-r.net);
  });

  it("with nothing owed there is no payoff fee", () => {
    expect(saleCosts({ ...base, payoff: 0 }).lines.map((l) => l.label)).not.toContain("Payoff statement and wire fees");
  });
});

describe("what to fix first", () => {
  it("something broken is worth addressing; an old roof is a question, not a replacement", () => {
    const p = preparePlan({ roof: "over20", systems: "broken", finish: "fresh" });
    expect(p.address[0].item).toMatch(/not working/);
    expect(p.maybe.map((i) => i.item).join(" ")).toMatch(/roof inspection/i);
    expect(p.notYet.map((i) => i.item).join(" ")).not.toMatch(/roof/i);
  });

  it("never prints a cost or a return (MONEY-06: no generated repair ROI)", () => {
    for (const roof of ["under10", "10to20", "over20", "unsure"] as const)
      for (const systems of ["working", "broken", "unsure"] as const)
        for (const finish of ["fresh", "lived", "worn"] as const) {
          const p = preparePlan({ roof, systems, finish });
          const text = [...p.address, ...p.maybe, ...p.notYet].map((i) => `${i.item} ${i.why}`).join(" ");
          expect(text).not.toMatch(/\$|%|pays? back|return on|roi/i);
        }
  });
});

/* Break-even and sensitivity (docs/audit/value-depth-2026-10.md §4.7): the
   seller's own costs, solved, never a value for the house (MONEY-06). */
describe("the price below which selling costs money", () => {
  it("leaves nothing at the break-even price, and a dollar less is a shortfall", () => {
    for (const payoff of [50_000, 200_000, 480_000]) {
      for (const commissionPct of [null, 2, 5, 6]) {
        const p = breakEvenPrice({ ...base, payoff, commissionPct })!;
        expect(sellerNet({ ...base, price: p, payoff, commissionPct }).net).toBeGreaterThanOrEqual(0);
        expect(sellerNet({ ...base, price: p - 1, payoff, commissionPct }).net).toBeLessThan(0);
      }
    }
  });

  it("is $213,162 on the audit's case: $200,000 owed and 5% commission", () => {
    expect(breakEvenPrice(base)).toBe(213_162);
  });

  it("has nothing to say when nothing is owed", () => {
    expect(breakEvenPrice({ ...base, payoff: 0 })).toBeNull();
  });
});

describe("what moves what they keep", () => {
  it("prices five percent either side of theirs, with theirs in the middle", () => {
    const s = netSensitivity(base);
    expect(s.byPrice.map((r) => r.price)).toEqual([380_000, 400_000, 420_000]);
    expect(s.byPrice[1].net).toBe(sellerNet(base).net);
    expect(s.byPrice[0].net).toBeLessThan(s.byPrice[1].net);
    expect(s.byPrice[2].net).toBeGreaterThan(s.byPrice[1].net);
  });

  it("moves commission a point either way when one is agreed, never below zero, and not at all when none is", () => {
    const s = netSensitivity(base);
    expect(s.byCommission.map((r) => r.pct)).toEqual([4, 5, 6]);
    expect(s.byCommission[0].net - s.byCommission[1].net).toBe(4_000);
    expect(netSensitivity({ ...base, commissionPct: 0.5 }).byCommission.map((r) => r.pct)).toEqual([0, 0.5, 1.5]);
    expect(netSensitivity({ ...base, commissionPct: null }).byCommission).toEqual([]);
  });
});
