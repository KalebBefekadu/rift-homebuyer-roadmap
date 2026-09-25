import { describe, expect, it } from "vitest";
import { JOURNEYS, PEOPLE, TODAY } from "@/lib/prototype/ops-mock";
import { WORKSTREAMS } from "./progress";

/* The Operations mock-up (Blueprint v5 §8, D15) must itself meet §8's acceptance. */
describe("the Operations mock-up", () => {
  it("names an owner, a due time and a next action on every item on Today", () => {
    for (const t of TODAY) {
      expect(t.owner, t.id).toBeTruthy();
      expect(t.due, t.id).toBeTruthy();
      expect(t.next, t.id).toBeTruthy();
      expect(t.why, t.id).toBeTruthy();
    }
  });

  it("covers all five groups, so each of the seven questions has somewhere to be answered", () => {
    expect(new Set(TODAY.map((t) => t.group))).toEqual(new Set(["attention", "approval", "today", "waiting", "upcoming"]));
  });

  it("shows all ten workstreams on every contract, in the product's own words", () => {
    for (const j of JOURNEYS.filter((x) => x.work)) {
      expect(j.work!.map((w) => w.stream)).toEqual(WORKSTREAMS);
    }
  });

  it("links only to people and journeys that exist", () => {
    for (const t of TODAY) {
      if (t.personId) expect(PEOPLE.some((p) => p.id === t.personId), t.id).toBe(true);
      if (t.journeyId) expect(JOURNEYS.some((j) => j.id === t.journeyId), t.id).toBe(true);
    }
  });
});
