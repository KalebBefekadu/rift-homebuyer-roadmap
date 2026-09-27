import { describe, it, expect } from "vitest";
import { BUYER_DEFAULTS, cashToClose } from "./compute";
import { compareHomes, MAX_COMPARED, type CompareHome } from "./compare";
import type { PropertyFacts, SearchCriterion } from "./search";

const facts = (f: Partial<PropertyFacts>): PropertyFacts => ({
  price: null, bedrooms: null, bathrooms: null, propertyType: null, city: null, lotAcres: null, hoaMonthly: null, basement: null, garageSpaces: null, ...f,
});
const homes: CompareHome[] = [
  { id: "a", address: "1 Oak St", facts: facts({ price: 300_000, bedrooms: 3, hoaMonthly: 0 }) },
  { id: "b", address: "2 Elm St", facts: facts({ price: 360_000, bedrooms: 2 }) },
  { id: "c", address: "3 Ash St", facts: facts({ bedrooms: 4 }) },
];
const base = { strength: "hard" as const, statedBy: "Dana", statedAt: "2026-09-20", sourceRef: "call" };
const criteria: SearchCriterion[] = [
  { id: "c1", field: "bedrooms", operator: "atLeast", value: 3, unit: null, ...base },
  { id: "c2", field: "price", operator: "atMost", value: 350_000, unit: "USD", ...base },
];
const plan = { inputs: { ...BUYER_DEFAULTS, savings: 20_000 }, savingsKnown: true };
const row = (rows: ReturnType<typeof compareHomes>, label: string) => rows.find((r) => r.label === label);

describe("homes side by side (SEARCH-05)", () => {
  it("gives every home the same rows, and says unknown where a fact is missing", () => {
    const rows = compareHomes(homes, criteria, plan);
    for (const r of rows) expect(r.cells).toHaveLength(3);
    expect(row(rows, "Price")!.cells[2]).toMatchObject({ text: "Not known", unknown: true });
    expect(row(rows, "Cash to buy it")!.cells[2]!.unknown).toBe(true);
  });

  it("works the money on the buyer's own terms, and names an HOA left out", () => {
    const rows = compareHomes(homes, criteria, plan);
    expect(row(rows, "Cash to buy it")!.cells[0]!.text).toBe(cashToClose({ ...plan.inputs, price: 300_000 }).total.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
    expect(row(rows, "Monthly, as a scenario")!.cells[1]!.text).toMatch(/HOA not known, not included/);
    expect(row(rows, "Monthly, as a scenario")!.cells[0]!.text).not.toMatch(/HOA/);
    expect(row(rows, "Against your savings")!.cells[1]!.text).toMatch(/short/);
  });

  it("says each requirement per home, never a score", () => {
    const rows = compareHomes(homes, criteria, plan);
    expect(row(rows, "Bedrooms")!.cells.map((c) => c.text)).toEqual(["3", "2", "4"]);
    const bedFit = rows.filter((r) => r.group === "fit" && r.label === "Bedrooms")[0]!;
    expect(bedFit.cells.map((c) => c.fit)).toEqual(["meets", "misses", "meets"]);
    expect(rows.some((r) => /score|%\s*match/i.test(r.label))).toBe(false);
  });

  it("without price and fees, no money row and no price requirement appear", () => {
    const rows = compareHomes(homes, criteria, null);
    expect(rows.some((r) => r.group === "money")).toBe(false);
    expect(rows.some((r) => r.group === "fit" && r.label === "Price")).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/\$/);
  });

  it("unknown savings leave out the savings row rather than guessing", () => {
    const rows = compareHomes(homes, criteria, { ...plan, savingsKnown: false });
    expect(row(rows, "Against your savings")).toBeUndefined();
  });

  it("compares at most four", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: String(i), address: `${i} St`, facts: facts({ bedrooms: i }) }));
    expect(compareHomes(many, [], null)[0]!.cells).toHaveLength(MAX_COMPARED);
  });
});
