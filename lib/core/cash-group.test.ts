import { describe, it, expect } from "vitest";
import { cashToClose, BUYER_DEFAULTS } from "./compute";
import { groupSmallCosts, GROUP_LABEL } from "./cash-group";

describe("groupSmallCosts", () => {
  const cash = cashToClose({ ...BUYER_DEFAULTS, assistance: 0 });
  const g = groupSmallCosts(cash.lines);
  const sum = (ls: { amount: number; credited?: boolean }[]) => ls.filter((l) => !l.credited).reduce((s, l) => s + l.amount, 0);

  it("folds prepaids, inspection and appraisal into one line", () => {
    expect(g.parts.map((p) => p.label)).toEqual(["Prepaids and escrow", "Inspection", "Appraisal"]);
    expect(g.lines.map((l) => l.label)).toContain(GROUP_LABEL);
    expect(g.lines.map((l) => l.label)).not.toContain("Inspection");
  });

  it("never changes the total", () => {
    expect(sum(g.lines)).toBe(sum(cash.lines));
    expect(g.amount).toBe(sum(g.parts));
  });

  it("keeps the order: down payment first, the group where the first small cost was", () => {
    expect(g.lines[0]!.label).toBe("Down payment");
    expect(g.lines[2]!.label).toBe(GROUP_LABEL);
  });
});
