import { describe, expect, it } from "vitest";
import {
  approvalBlockers, briefErrors, buildPackage, canonicalPackage, criterionError, describe as say,
  diffBriefs, disagreementOn, fitOf, packageChanges, packageText, refusedWording, safeListingUrl,
  statusOf, EMPTY_FACTS, type SearchBrief, type SearchCriterion,
} from "./search";

const at = "2026-09-20";
const c = (over: Partial<SearchCriterion> & Pick<SearchCriterion, "id" | "field" | "operator" | "value">): SearchCriterion => ({
  unit: null, strength: "hard", statedBy: "Devon (buyer)", statedAt: at, sourceRef: "call on 20 Sep", ...over,
} as SearchCriterion);

/* The specimen from implementation-plan §3.2: "Around $400k, maybe $430k for
   the right house. Three bedrooms minimum. Snellville, Lilburn or
   Lawrenceville. Basement strongly preferred. I do not want to be on a major
   road." Synthetic, not a real buyer. */
const specimen = (): SearchBrief => ({
  criteria: [
    c({ id: "target", field: "price", operator: "equals", value: 400_000, unit: "USD", strength: "preference" }),
    c({ id: "max", field: "price", operator: "atMost", value: 430_000, unit: "USD", strength: "undecided" }),
    c({ id: "beds", field: "bedrooms", operator: "atLeast", value: 3, unit: "count" }),
    c({ id: "areas", field: "geography", operator: "oneOf", value: ["Snellville", "Lilburn", "Lawrenceville"] }),
    c({ id: "basement", field: "basement", operator: "equals", value: "yes", strength: "preference" }),
    c({ id: "road", field: "otherPropertyAttribute", operator: "avoids", value: "On a major road" }),
  ],
  questions: [],
});

describe("a criterion", () => {
  it("accepts the specimen", () => {
    expect(briefErrors(specimen())).toEqual([]);
  });

  it("refuses an operator its field cannot use, and a unit that does not match", () => {
    expect(criterionError(c({ id: "x", field: "bedrooms", operator: "atMost", value: 3, unit: "count" }))).toMatch(/cannot/);
    expect(criterionError(c({ id: "x", field: "price", operator: "atMost", value: 3, unit: "count" }))).toMatch(/measured/);
  });

  it("refuses money that is not finite, negative or zero", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
      expect(criterionError(c({ id: "p", field: "price", operator: "atMost", value, unit: "USD" }))).not.toBeNull();
    }
  });

  it("allows half bathrooms and refuses half bedrooms", () => {
    expect(criterionError(c({ id: "b", field: "bathrooms", operator: "atLeast", value: 2.5, unit: "count" }))).toBeNull();
    expect(criterionError(c({ id: "b", field: "bedrooms", operator: "atLeast", value: 2.5, unit: "count" }))).not.toBeNull();
  });

  it("needs a source, a speaker and a date", () => {
    expect(criterionError(c({ id: "b", field: "bedrooms", operator: "atLeast", value: 3, unit: "count", sourceRef: " " }))).toMatch(/where/);
    expect(criterionError(c({ id: "b", field: "bedrooms", operator: "atLeast", value: 3, unit: "count", statedBy: "" }))).toMatch(/who/);
    expect(criterionError(c({ id: "b", field: "bedrooms", operator: "atLeast", value: 3, unit: "count", statedAt: "soon" }))).toMatch(/when/);
  });
});

describe("places and property, not people (AT10)", () => {
  it("refuses wording about who lives nearby, school rankings and crime", () => {
    for (const bad of [
      "Low crime", "a safe neighborhood", "good schools", "top rated schools", "school ratings above 8",
      "family-friendly", "no section 8", "diverse area", "white neighborhood", "neighbors who are Hispanic",
    ]) {
      expect(refusedWording(bad), bad).not.toBeNull();
    }
  });

  it("does not refuse ordinary property words that share a term", () => {
    for (const ok of ["White kitchen cabinets", "Near my church", "Black granite counters", "Wheelchair accessible", "Fenced yard for a dog"]) {
      expect(refusedWording(ok), ok).toBeNull();
    }
  });

  it("applies to free text and to place names, so neither is a way around it", () => {
    expect(criterionError(c({ id: "o", field: "otherPropertyAttribute", operator: "equals", value: "In a safe area" }))).toMatch(/Rift records features/);
    expect(criterionError(c({ id: "g", field: "geography", operator: "oneOf", value: ["Anywhere with good schools"] }))).toMatch(/Rift records features/);
  });

  it("applies to open questions too", () => {
    expect(briefErrors({ criteria: [], questions: ["Which areas have the least crime?"] })[0]).toMatch(/Rift records features/);
  });
});

describe("approval", () => {
  it("is blocked while the maximum price is undecided (AT08)", () => {
    const blockers = approvalBlockers(specimen());
    expect(blockers.some((b) => b.includes("At most $430,000"))).toBe(true);
  });

  it("goes through once the buyer decides, and the basement stays a preference (AT07)", () => {
    const b = specimen();
    b.criteria.find((x) => x.id === "max")!.strength = "hard";
    const built = buildPackage(b, 2, "daily");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.pkg.filters.map((l) => l.criterionId)).not.toContain("basement");
    expect(built.pkg.preferences.map((l) => l.criterionId)).toEqual(expect.arrayContaining(["basement", "target"]));
    expect(built.pkg.manualChecks.map((l) => l.criterionId)).toEqual(["road"]);
    expect(built.pkg.filters.find((l) => l.criterionId === "areas")?.enforcement).toBe("approximate");
    expect(built.pkg.filters.find((l) => l.criterionId === "beds")?.enforcement).toBe("exact");
  });

  it("refuses to build a package rather than dropping the undecided item", () => {
    const built = buildPackage(specimen(), 1, "daily");
    expect(built.ok).toBe(false);
  });

  it("blocks on open questions, contradictions and nothing required", () => {
    expect(approvalBlockers({ criteria: [], questions: [] })).toEqual(expect.arrayContaining([
      "There is nothing to search on yet",
    ]));
    const lo = c({ id: "lo", field: "price", operator: "atLeast", value: 500_000, unit: "USD" });
    const hi = c({ id: "hi", field: "price", operator: "atMost", value: 400_000, unit: "USD" });
    expect(approvalBlockers({ criteria: [lo, hi], questions: [] })).toContain("The minimum price is above the maximum");
    expect(approvalBlockers({ criteria: [hi], questions: ["Is Lilburn really in?"] })).toContain("Open question: Is Lilburn really in?");
    const pref = c({ id: "p", field: "bedrooms", operator: "atLeast", value: 3, unit: "count", strength: "preference" });
    expect(approvalBlockers({ criteria: [pref], questions: [] })[0]).toMatch(/every listing/);
  });

  it("blocks on a household that disagrees, and does not pick a side (AT08)", () => {
    const d = disagreementOn([
      { name: "Devon", response: "confirmed", note: null },
      { name: "Sam", response: "changes-requested", note: "We said 4 bedrooms" },
    ]);
    expect(d[0]).toMatch(/disagrees/);
    const b = specimen();
    b.criteria.find((x) => x.id === "max")!.strength = "hard";
    expect(buildPackage(b, 3, "daily", d).ok).toBe(false);
  });

  it("uses each person's latest answer", () => {
    expect(disagreementOn([
      { name: "Sam", response: "changes-requested", note: null },
      { name: "Sam", response: "confirmed", note: null },
    ])).toEqual([]);
  });
});

describe("what changed (AT09)", () => {
  it("shows only the changed criterion, and which part of it", () => {
    const before = specimen();
    const after = specimen();
    after.criteria.find((x) => x.id === "max")!.value = 450_000;
    const d = diffBriefs(before, after);
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0]).toMatchObject({ kind: "changed", parts: ["value"] });
  });

  it("reports additions, removals and settled questions", () => {
    const before = { ...specimen(), questions: ["Lilburn?"] };
    const after = specimen();
    after.criteria = after.criteria.filter((x) => x.id !== "road");
    after.criteria.push(c({ id: "garage", field: "garage", operator: "atLeast", value: 2, unit: "count" }));
    const d = diffBriefs(before, after);
    expect(d.changes.map((x) => x.kind).sort()).toEqual(["added", "removed"]);
    expect(d.questionsResolved).toEqual(["Lilburn?"]);
  });

  it("lists the Matrix edits between two packages", () => {
    const b = specimen();
    b.criteria.find((x) => x.id === "max")!.strength = "hard";
    const one = buildPackage(b, 1, "daily");
    b.criteria.find((x) => x.id === "max")!.value = 450_000;
    const two = buildPackage(b, 2, "daily");
    if (!one.ok || !two.ok) throw new Error("expected packages");
    expect(packageChanges(one.pkg, two.pkg)).toEqual({ add: ["Price: At most $450,000"], remove: ["Price: At most $430,000"] });
  });
});

describe("the package", () => {
  const ready = () => {
    const b = specimen();
    b.criteria.find((x) => x.id === "max")!.strength = "hard";
    const r = buildPackage(b, 4, "weekly");
    if (!r.ok) throw new Error("expected a package");
    return r.pkg;
  };

  it("hashes the same package the same way regardless of key order", () => {
    const p = ready();
    const { preferences, cadence, ...rest } = p;
    const shuffled = JSON.parse(JSON.stringify({ preferences, cadence, ...rest }));
    expect(canonicalPackage(shuffled)).toBe(canonicalPackage(p));
  });

  it("copies as text that marks approximate filters and separates manual checks", () => {
    const text = packageText(ready(), "Devon Ellison");
    expect(text).toContain("brief revision 4");
    expect(text).toContain("Areas: Snellville, Lilburn, Lawrenceville  [approximate]");
    expect(text).toMatch(/Check by hand[\s\S]*Avoid: On a major road/);
    expect(text).toMatch(/Preferences[\s\S]*Has a basement/);
  });

  it("hides money from a member without the money scope", () => {
    expect(say(specimen().criteria[1]!, false)).toBe("Price: kept private");
  });
});

describe("search status (AT11)", () => {
  it("is never active without a confirmation", () => {
    expect(statusOf({ latest: 3, active: null, pending: { revision: 3 } })).toBe("manual-action-needed");
    expect(statusOf({ latest: 3, active: null, pending: null })).toBe("awaiting-approval");
  });

  it("is active only for the confirmed revision, and says an update is pending otherwise", () => {
    expect(statusOf({ latest: 3, active: { revision: 3, status: "active-confirmed" }, pending: null })).toBe("active-confirmed");
    expect(statusOf({ latest: 4, active: { revision: 3, status: "active-confirmed" }, pending: null })).toBe("update-pending");
  });

  it("reports an unreadable status as unknown, never as fine", () => {
    expect(statusOf({ latest: 3, active: { revision: 3, status: "active-confirmed" }, pending: null, unreadable: true })).toBe("unknown");
  });

  it("puts a waiting setup ahead of an active search", () => {
    expect(statusOf({ latest: 4, active: { revision: 3, status: "active-confirmed" }, pending: { revision: 4 } })).toBe("manual-action-needed");
  });
});

describe("a home against the brief (AT15, AT16)", () => {
  const brief = () => {
    const b = specimen();
    b.criteria.find((x) => x.id === "max")!.strength = "hard";
    return b.criteria;
  };

  it("says which requirements it meets and never gives a percentage", () => {
    const f = fitOf({ ...EMPTY_FACTS, price: 415_000, bedrooms: 4, city: "Lilburn" }, brief());
    expect(f.summary).toBe("Meets 3 of 4 requirements; 1 still to check");
    expect(f.summary).not.toMatch(/%/);
  });

  it("treats a missing fact as unknown, not as a pass", () => {
    const f = fitOf({ ...EMPTY_FACTS, bedrooms: 4 }, brief());
    expect(f.lines.find((l) => l.criterionId === "max")?.fit).toBe("unknown");
  });

  it("names what it misses", () => {
    const f = fitOf({ ...EMPTY_FACTS, price: 480_000, bedrooms: 2, city: "Snellville" }, brief());
    expect(f.summary).toMatch(/^Misses price, bedrooms/);
  });

  it("is honest when there is nothing approved to compare against", () => {
    expect(fitOf(EMPTY_FACTS, []).summary).toMatch(/No requirements/);
  });
});

describe("listing links", () => {
  it("keeps http(s) and refuses anything that could run", () => {
    expect(safeListingUrl("https://www.fmls.com/listing/123")).toBe("https://www.fmls.com/listing/123");
    expect(safeListingUrl("javascript:alert(1)")).toBeNull();
    expect(safeListingUrl("not a url")).toBeNull();
  });
});
