import { describe, expect, it } from "vitest";
import { limitingRequirements, type PropertyFacts, type SearchCriterion } from "./search";

const facts = (over: Partial<PropertyFacts>): { facts: PropertyFacts } => ({
  facts: { price: null, bedrooms: null, bathrooms: null, propertyType: null, city: null, lotAcres: null, hoaMonthly: null, basement: null, garageSpaces: null, ...over },
});
const c = (field: SearchCriterion["field"], operator: SearchCriterion["operator"], value: SearchCriterion["value"], strength: SearchCriterion["strength"] = "hard"): SearchCriterion => ({
  id: `${field}-${operator}`, field, operator, value, strength,
  unit: field === "price" ? "USD" : field === "bedrooms" ? "count" : null,
  statedBy: "Buyer", statedAt: "2026-09-20", sourceRef: "call",
});

/* SEARCH-09 / AT16: show what limits the search; never widen it. */
describe("when nothing fits", () => {
  const brief = [c("price", "atMost", 300_000), c("bedrooms", "atLeast", 3)];

  it("names each must-have with how many homes it rules out, the most limiting first", () => {
    const r = limitingRequirements([
      facts({ price: 320_000, bedrooms: 3 }),
      facts({ price: 340_000, bedrooms: 2 }),
      facts({ price: 280_000, bedrooms: 2 }),
    ], brief)!;
    expect(r.total).toBe(3);
    expect(r.limits).toEqual([
      { text: "Price: At most $300,000", rulesOut: 2 },
      { text: "Bedrooms: At least 3 bedrooms", rulesOut: 2 },
    ]);
  });

  it("says nothing while any home fits, or could, once its unknowns are checked", () => {
    expect(limitingRequirements([facts({ price: 290_000, bedrooms: 3 }), facts({ price: 400_000, bedrooms: 1 })], brief)).toBeNull();
    expect(limitingRequirements([facts({ price: null, bedrooms: null })], brief)).toBeNull();
  });

  it("does not count a preference as a limit, and says nothing with no must-haves or no homes", () => {
    expect(limitingRequirements([facts({ price: 400_000 })], [c("price", "atMost", 300_000, "preference")])).toBeNull();
    expect(limitingRequirements([], brief)).toBeNull();
  });
});
