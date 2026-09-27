import { describe, it, expect } from "vitest";
import { saleCosts, sellerNet, preparePlan, SELLER_SETTLEMENT, PAYOFF_FEES, proratedTax } from "./seller";
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
