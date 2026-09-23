import { describe, it, expect } from "vitest";
import {
  buildAgenda, summariseAgenda, agendaHeadline, dayLabel, daysAway,
  type Commitment,
} from "./agenda";

/**
 * The next five weeks, across everybody.
 *
 * Today's screen answers "what do I do now". This answers "what does the
 * month look like", and the difference that matters is not the date range:
 * it is that a plan step is something a CLIENT can see he promised them, on a
 * page they may have open, and a next action is a note to himself.
 */

const TODAY = new Date("2026-09-20T12:00:00Z");

const c = (over: Partial<Commitment> = {}): Commitment => ({
  id: "x", kind: "action", what: "Call about the survey", dueOn: "2026-09-22",
  personId: "p1", personName: "Sara Tesfaye", side: "buy", visibleToThem: false, ...over,
});

describe("how a day reads", () => {
  it("names the near ones the way somebody plans", () => {
    expect(dayLabel("2026-09-20", TODAY)).toBe("Today");
    expect(dayLabel("2026-09-21", TODAY)).toBe("Tomorrow");
    expect(dayLabel("2026-09-19", TODAY)).toBe("Yesterday");
    expect(dayLabel("2026-09-24", TODAY)).toBe("Thursday");
  });

  it("brings the date back past a week, because there are two Thursdays in a fortnight", () => {
    expect(dayLabel("2026-10-02", TODAY)).toMatch(/Fri 2 Oct/);
  });

  it("says outright when a day has passed", () => {
    expect(dayLabel("2026-09-01", TODAY)).toMatch(/overdue/);
  });

  it("counts whole days, so something due today is not already late", () => {
    expect(daysAway("2026-09-20", new Date("2026-09-20T23:59:00Z"))).toBe(0);
  });
});

describe("what the agenda contains", () => {
  it("renders only days that have something on them", () => {
    /* A month view with twenty-two empty cells is a picture of a calendar. */
    const days = buildAgenda([c({ dueOn: "2026-09-22" }), c({ id: "y", dueOn: "2026-09-30" })], TODAY);
    expect(days).toHaveLength(2);
    expect(days.map((d) => d.date)).toEqual(["2026-09-22", "2026-09-30"]);
  });

  it("keeps overdue items however far back they go", () => {
    /* Something promised to a client three weeks ago and never done does not
       stop mattering because it scrolled off a window. */
    const days = buildAgenda([c({ dueOn: "2026-06-01" })], TODAY);
    expect(days).toHaveLength(1);
    expect(days[0]!.daysAway).toBeLessThan(-100);
  });

  it("drops what is beyond the horizon", () => {
    expect(buildAgenda([c({ dueOn: "2027-06-01" })], TODAY, 35)).toHaveLength(0);
  });

  it("puts what a client can see first within a day", () => {
    /* He is more exposed on those: they are on a page somebody may have
       open. */
    const days = buildAgenda([
      c({ id: "private", what: "Aaa private note", visibleToThem: false }),
      c({ id: "shared", what: "Zzz shared step", kind: "step", visibleToThem: true }),
    ], TODAY);
    expect(days[0]!.items.map((i) => i.id)).toEqual(["shared", "private"]);
  });

  it("runs in date order", () => {
    const days = buildAgenda([
      c({ id: "late", dueOn: "2026-10-05" }),
      c({ id: "soon", dueOn: "2026-09-21" }),
    ], TODAY);
    expect(days.map((d) => d.date)).toEqual(["2026-09-21", "2026-10-05"]);
  });
});

describe("the line at the top", () => {
  it("leads with what a client can see when something is overdue", () => {
    /* "Three things are overdue" is a private embarrassment. "Two of them are
       on a page your client can open" is a different fact, and the one that
       decides what he does first. */
    const days = buildAgenda([
      c({ id: "a", dueOn: "2026-09-10", kind: "step", visibleToThem: true }),
      c({ id: "b", dueOn: "2026-09-12" }),
    ], TODAY);
    const line = agendaHeadline(summariseAgenda(days));
    expect(line).toMatch(/2 things are overdue/);
    expect(line).toMatch(/1 on a page a client can open/);
  });

  it("does not mention client pages when none of the overdue items is on one", () => {
    const days = buildAgenda([c({ dueOn: "2026-09-10" })], TODAY);
    expect(agendaHeadline(summariseAgenda(days))).toBe("One thing is overdue.");
  });

  it("says they are all visible when they all are", () => {
    const days = buildAgenda([
      c({ id: "a", dueOn: "2026-09-10", visibleToThem: true }),
      c({ id: "b", dueOn: "2026-09-11", visibleToThem: true }),
    ], TODAY);
    expect(agendaHeadline(summariseAgenda(days))).toMatch(/they are on pages your clients can open/);
  });

  it("falls back to today, then to the week, then to nothing", () => {
    expect(agendaHeadline(summariseAgenda(buildAgenda([c({ dueOn: "2026-09-20" })], TODAY))))
      .toBe("One thing is due today.");
    expect(agendaHeadline(summariseAgenda(buildAgenda([c({ dueOn: "2026-09-24" })], TODAY))))
      .toMatch(/Nothing today\. 1 this week\./);
    expect(agendaHeadline(summariseAgenda(buildAgenda([], TODAY))))
      .toBe("Nothing is due in the next five weeks.");
  });
});

describe("the empty days", () => {
  it("counts them rather than drawing them", () => {
    const days = buildAgenda([c({ dueOn: "2026-09-22" }), c({ id: "y", dueOn: "2026-09-30" })], TODAY, 35);
    expect(summariseAgenda(days, 35).clearDays).toBe(33);
  });

  it("does not count overdue days as forward capacity", () => {
    /* A day that has passed is not a day with nothing on it. */
    const days = buildAgenda([c({ dueOn: "2026-09-01" })], TODAY, 35);
    expect(summariseAgenda(days, 35).clearDays).toBe(35);
  });
});
