import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { missingSteps, moveInSteps } from "./move-in";

/* B19: a concise handoff with owners; tax and homestead dates only from
   maintained official sources, never generic annual assumptions. */
describe("the move-in handoff", () => {
  it("gives every step an owner, and names who, when it is someone else", () => {
    for (const s of moveInSteps(null)) {
      expect(["client", "agent", "other"]).toContain(s.owner);
      if (s.owner === "other") expect(s.ownerName).toBeTruthy();
      expect(s.title.length).toBeLessThanOrEqual(160);
    }
  });

  it("names the county's tax commissioner when the county is known", () => {
    expect(moveInSteps("DeKalb").find((s) => /homestead/i.test(s.title))!.ownerName).toBe("DeKalb County tax commissioner");
  });

  it("states no date anywhere: no April 1, no 'by', no month", () => {
    for (const s of moveInSteps(null)) {
      expect(s.title).not.toMatch(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\bby \d|\d{1,2}\/\d{1,2}/i);
    }
    expect(readFileSync("app/(operations)/operations/actions.ts", "utf8")).toMatch(/ownerName: s\.ownerName, dueOn: null/);
  });

  it("adds nothing twice", () => {
    const all = moveInSteps(null);
    expect(missingSteps(all, all.map((s) => s.title.toUpperCase()))).toEqual([]);
    expect(missingSteps(all, [all[0].title])).toHaveLength(all.length - 1);
  });
});
