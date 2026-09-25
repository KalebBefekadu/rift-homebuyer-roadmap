import { describe, expect, it } from "vitest";
import { ACTIVITY, CALENDAR, JOURNEYS, NOW, PEOPLE, TODAY, daysFromNow, inDays } from "@/lib/prototype/ops-mock";
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
    for (const p of PEOPLE) for (const id of p.journeyIds) expect(JOURNEYS.some((j) => j.id === id), p.id).toBe(true);
    for (const j of JOURNEYS) expect(PEOPLE.find((p) => p.id === j.personId)?.journeyIds, j.id).toContain(j.id);
  });
});

/* The first version said a job "retries at 8:00" beside a text from 8:10 and a
   lead from 9:25, and listed Saturday's tours under Today. A page that
   disagrees with itself about the time is not reviewable. */
describe("the mock-up's clock", () => {
  it("puts only today's things under Today, and only the next two weeks under Next two weeks", () => {
    for (const t of TODAY.filter((x) => x.group === "today")) expect(t.on, t.id).toBe(NOW.day);
    for (const t of TODAY.filter((x) => x.group === "upcoming")) {
      expect(daysFromNow(t.on), t.id).toBeGreaterThan(0);
      expect(daysFromNow(t.on), t.id).toBeLessThanOrEqual(14);
    }
  });

  it("lists nothing under What changed that happens after now", () => {
    const [h, m] = NOW.time.replace(/ am| pm/, "").split(":").map(Number);
    for (const a of ACTIVITY.filter((x) => /^\d+:\d+$/.test(x.at))) {
      const [ah, am] = a.at.split(":").map(Number);
      expect(ah * 60 + am, a.what).toBeLessThanOrEqual(h * 60 + m);
    }
  });

  it("closes every contract in the future, and keeps the calendar inside two weeks", () => {
    for (const j of JOURNEYS.filter((x) => x.closing)) expect(daysFromNow(j.closing!.iso), j.id).toBeGreaterThan(0);
    for (const c of CALENDAR) expect(daysFromNow(c.on), c.what).toBeGreaterThanOrEqual(0);
    for (const c of CALENDAR) expect(daysFromNow(c.on), c.what).toBeLessThanOrEqual(14);
  });

  it("says relative days the way a person would", () => {
    expect(inDays(NOW.day)).toBe("today");
    expect(inDays("2026-09-26")).toBe("tomorrow");
    expect(inDays("2026-09-30")).toBe("in 5 days");
    expect(inDays("2026-09-23")).toBe("2 days ago");
  });
});

describe("the mock-up keeps the product's rules", () => {
  it("never shows a workstream as confirmed without a named party and a day (rule 9)", () => {
    for (const j of JOURNEYS) for (const w of j.work ?? []) {
      if (w.state === "confirmed") expect(w.word, `${j.id} ${w.stream}`).toMatch(/^[A-Z][a-z]+.*, .+/);
    }
  });

  it("ranks a seller's offers by what reaches them, and the ranking is not just the price", () => {
    const j = JOURNEYS.find((x) => x.side === "sell" && (x.offers?.length ?? 0) > 1)!;
    const n = (s?: string) => Number((s ?? "").replace(/\D/g, ""));
    const byReach = [...j.offers!].sort((a, b) => n(b.reaches) - n(a.reaches));
    const byPrice = [...j.offers!].sort((a, b) => n(b.price) - n(a.price));
    expect(byReach[0]).not.toBe(byPrice[0]);
  });

  it("shows the new lead once, in the new-lead bar, not again under Needs attention", () => {
    const lead = PEOPLE.find((p) => p.stage === "New lead")!;
    expect(TODAY.some((t) => t.personId === lead.id && t.group === "attention")).toBe(false);
  });
});
