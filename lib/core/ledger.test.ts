import { describe, it, expect } from "vitest";
import { BUYER_DEFAULTS, cashToClose } from "./compute";
import { LEDGER_VERSION, currentFacts, factError, ledger, type Fact, type FactKind } from "./ledger";

const ALL = { price: true, downPct: true, savings: true };
const fact = (kind: FactKind, amount: number, at = "2026-09-25T12:00:00Z"): Fact =>
  ({ kind, amount, source: "Loan Estimate from Peach Mortgage", asOf: "2026-09-24", by: "Kaleb", at });

describe("money v2: the ledger (MONEY-03)", () => {
  it("AT30: earnest money is paid before closing and credited at it, counted once", () => {
    const l = ledger(BUYER_DEFAULTS, ALL);
    const earnest = l.before.lines.find((x) => x.label === "Earnest money")!.amount;
    expect(l.table.lines.find((x) => x.label === "Earnest money credited back")?.amount).toBe(earnest);
    /* The total equals the v1 cash to close, which never counted earnest. */
    expect(l.total.amount).toBeCloseTo(cashToClose(BUYER_DEFAULTS).total, 6);
    expect(l.before.amount + l.table.amount).toBeCloseTo(l.total.amount, 6);
  });

  it("AT31: the buckets reconcile, and the reserve and moving are never settlement money", () => {
    const l = ledger(BUYER_DEFAULTS, ALL, currentFacts([fact("moving", 2_400)]));
    expect(l.left.amount).toBeCloseTo(BUYER_DEFAULTS.savings - l.total.amount, 6);
    expect(l.total.amount).not.toBeCloseTo(l.total.amount + l.reserve.amount, 0);
    expect(l.table.lines.some((x) => /reserve|moving/i.test(x.label))).toBe(false);
    expect(l.moving?.amount).toBe(2_400);
    expect(l.reserve.says).toMatch(/not part of the budget/);
  });

  it("AT32: no assistance improves the figures until it is recorded as approved", () => {
    const before = ledger({ ...BUYER_DEFAULTS, assistance: 10_000 }, ALL);
    expect(before.table.lines.some((x) => /assistance/i.test(x.label))).toBe(false);
    expect(before.total.amount).toBeCloseTo(ledger(BUYER_DEFAULTS, ALL).total.amount, 6);
    const approved = ledger(BUYER_DEFAULTS, ALL, currentFacts([fact("assistance-approved", 10_000)]));
    expect(approved.total.amount).toBeCloseTo(before.total.amount - 10_000, 6);
  });

  it("AT33: a negative table amount keeps its meaning, and a shortfall is said, never zero", () => {
    const credits = ledger(BUYER_DEFAULTS, ALL, currentFacts([fact("seller-credit", 40_000)]));
    expect(credits.table.amount).toBeLessThan(0);
    expect(credits.table.says).toMatch(/Money back at closing/);
    const short = ledger({ ...BUYER_DEFAULTS, savings: 1_000 }, ALL);
    expect(short.left.amount).toBeLessThan(0);
    expect(short.left.says).toMatch(/Short by/);
    expect(short.version).toBe(LEDGER_VERSION);
  });

  it("recorded figures win over answers and estimates, and say where they came from", () => {
    const l = ledger(BUYER_DEFAULTS, { price: false, downPct: false, savings: false }, currentFacts([
      fact("price", 340_000), fact("closing-costs", 9_100), fact("closing-costs", 9_400, "2026-09-26T12:00:00Z"),
    ]));
    const closing = l.table.lines.find((x) => x.label === "Closing costs")!;
    expect(closing).toMatchObject({ amount: 9_400, provenance: "recorded", source: "Loan Estimate from Peach Mortgage" });
    const down = l.table.lines.find((x) => x.label === "Down payment")!;
    expect(down.provenance).toBe("recorded");
    expect(down.amount).toBeCloseTo(11_900, 6);
    expect(l.table.lines.find((x) => x.label === "Prepaids and escrow")!.provenance).toBe("estimate");
  });

  it("the official figure stands apart from the estimate and states the difference", () => {
    const l = ledger(BUYER_DEFAULTS, ALL, currentFacts([fact("official-cash-to-close", 21_000)]));
    expect(l.official).toMatchObject({ amount: 21_000 });
    expect(l.official!.difference).toBeCloseTo(21_000 - l.table.amount, 6);
    expect(l.table.lines.some((x) => x.amount === 21_000)).toBe(false);
  });

  it("a fact needs a kind, a positive amount, a source and a past day", () => {
    const ok = { kind: "earnest", amount: 3_000, source: "Smith Law, the holder", asOf: "2026-09-24" };
    expect(factError(ok, "2026-09-28")).toBeNull();
    expect(factError({ ...ok, kind: "tip" }, "2026-09-28")).toMatch(/Choose/);
    expect(factError({ ...ok, amount: -1 }, "2026-09-28")).toMatch(/positive/);
    expect(factError({ ...ok, source: "x" }, "2026-09-28")).toMatch(/where it comes from/);
    expect(factError({ ...ok, asOf: "2026-10-01" }, "2026-09-28")).toMatch(/future/);
  });
});
