import { describe, it, expect } from "vitest";
import { addDays, daysBetween, daysUntil, georgiaDay, showDay, showTime } from "./day";
import { bucketFor } from "./plan";
import { daysLeft } from "./decision";
import { cleanPlan } from "./saved-plan";

describe("the day in Georgia (DATE-01)", () => {
  it("is still today at nine in the evening, when London is already tomorrow", () => {
    /* 01:00 UTC on 28 Sep is 9pm on 27 Sep in Atlanta (EDT). */
    expect(georgiaDay(new Date("2026-09-28T01:00:00Z"))).toBe("2026-09-27");
    /* And in winter (EST), 11:30pm on 31 Jan. */
    expect(georgiaDay(new Date("2026-02-01T04:30:00Z"))).toBe("2026-01-31");
  });

  it("moves by whole calendar days, across months and the clock change", () => {
    expect(georgiaDay(new Date("2026-09-28T01:00:00Z"), 7)).toBe("2026-10-04");
    expect(georgiaDay(new Date("2026-11-01T15:00:00Z"), 1)).toBe("2026-11-02");
    expect(georgiaDay(new Date("2026-03-01T15:00:00Z"), -1)).toBe("2026-02-28");
  });

  it("dates a plan saved after dinner on the day it was saved", () => {
    const plan = cleanPlan({ side: "buy", values: [], answers: {} }, new Date("2026-09-28T01:30:00Z"));
    expect(plan.savedOn).toBe("2026-09-27");
  });
});

describe("counting days", () => {
  it("adds and counts calendar days across months and the clock change", () => {
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-01", "2026-11-03")).toBe(2);
    expect(daysBetween("2026-09-28", "2026-09-20")).toBe(-8);
  });

  it("does not call something due today late at nine in the evening", () => {
    /* 01:00 UTC on 21 Sep is 9pm on 20 Sep in Atlanta. Counted from London's
       day, a step due on the 20th read as a day overdue from 8pm. */
    const evening = new Date("2026-09-21T01:00:00Z");
    expect(daysUntil("2026-09-20", evening)).toBe(0);
    expect(bucketFor({ dueOn: "2026-09-20", doneAt: null } as Parameters<typeof bucketFor>[0], evening)).toBe("now");
    expect(daysLeft({ decideBy: "2026-09-20" }, evening)).toBe(0);
  });
});

describe("days and times for people to read", () => {
  it("shows a date-only value as that calendar day, never the day before", () => {
    expect(showDay("2026-09-28")).toBe("Sep 28");
    expect(showDay("2026-01-01", { month: "long", day: "numeric", year: "numeric" })).toBe("January 1, 2026");
  });

  it("shows a timestamp as the day and time it was in Georgia", () => {
    /* 01:30 UTC on 28 Sep is 9:30pm on 27 Sep in Atlanta. */
    expect(showDay("2026-09-28T01:30:00Z")).toBe("Sep 27");
    expect(showTime("2026-09-28T01:30:00Z")).toBe("Sep 27, 9:30 PM");
  });
});
