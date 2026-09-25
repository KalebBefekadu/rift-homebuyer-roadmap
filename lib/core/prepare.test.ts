import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prepTriage, FINISHED_INTERIOR_PRICE, type PrepInputs } from "./prepare";

const base: PrepInputs = { price: 400_000, interior: "worn", kitchen: "dated", systems: "fine" };
const verdictOf = (i: PrepInputs, item: RegExp) => prepTriage(i).items.find((x) => item.test(x.item))?.verdict;

describe("should I fix it first", () => {
  it("always starts with cleaning and the front of the house", () => {
    const r = prepTriage({ ...base, interior: "fresh", kitchen: "updated" });
    expect(r.items.filter((x) => x.verdict === "now").map((x) => x.item)).toEqual([
      "Deep clean and declutter", "Front door, entry and yard tidy",
    ]);
  });

  it("never recommends renovating a kitchen to sell", () => {
    for (const kitchen of ["dated", "original"] as const) {
      expect(verdictOf({ ...base, kitchen }, /renovation/)).toBe("later");
    }
  });

  it("puts a known problem first, and an unknown one as an inspection to weigh up", () => {
    expect(verdictOf({ ...base, systems: "issues" }, /known problem/)).toBe("now");
    expect(verdictOf({ ...base, systems: "unsure" }, /inspection/)).toBe("maybe");
    expect(verdictOf(base, /inspection|known problem/)).toBeUndefined();
  });

  it("treats worn floors as expected work only at the upper end", () => {
    expect(verdictOf({ ...base, interior: "tired", price: FINISHED_INTERIOR_PRICE }, /flooring/)).toBe("now");
    expect(verdictOf({ ...base, interior: "tired", price: FINISHED_INTERIOR_PRICE - 1 }, /flooring/)).toBe("maybe");
  });

  it("counts match the list the drawing is sized from", () => {
    const r = prepTriage({ ...base, interior: "tired", systems: "unsure" });
    expect(r.counts.now + r.counts.maybe + r.counts.skip).toBe(r.items.length);
  });

  /* MONEY-06: no generated repair return. Not in the reasons, and not in the
     code: a dollar sign in this file would be a cost nobody quoted. */
  it("gives no dollar figure for any repair", () => {
    const r = prepTriage({ ...base, interior: "tired", kitchen: "original", systems: "issues" });
    for (const x of r.items) expect(x.why + x.item).not.toMatch(/\$|\d+%|return on/i);
    const src = readFileSync("lib/core/prepare.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/cost:\s*\d|roi/i);
  });
});
