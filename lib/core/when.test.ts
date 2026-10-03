import { describe, it, expect } from "vitest";
import { agoFrom, relativeDay, spanOf } from "./when";

describe("days said as a person says them", () => {
  it("names the near days and counts the rest", () => {
    expect(relativeDay(0)).toBe("today");
    expect(relativeDay(1)).toBe("tomorrow");
    expect(relativeDay(-1)).toBe("yesterday");
    expect(relativeDay(3)).toBe("in 3 days");
    expect(relativeDay(-4)).toBe("4 days ago");
  });

  it("moves to weeks after a fortnight and months after two", () => {
    expect(relativeDay(-13)).toBe("13 days ago");
    expect(relativeDay(-40)).toBe("6 weeks ago");
    expect(relativeDay(21)).toBe("in 3 weeks");
    expect(relativeDay(-90)).toBe("3 months ago");
  });

  it("says how long ago a moment was: minutes, hours today, then Georgia's days", () => {
    const now = new Date("2026-09-30T12:00:00Z"); // 8 AM in Atlanta
    expect(agoFrom(new Date("2026-09-30T11:59:40Z"), now)).toBe("just now");
    expect(agoFrom(new Date("2026-09-30T11:48:00Z"), now)).toBe("12 minutes ago");
    expect(agoFrom(new Date("2026-09-30T09:30:00Z"), now)).toBe("2 hours ago");
    /* 11 PM last night in Atlanta is nine hours ago and still yesterday. */
    expect(agoFrom(new Date("2026-10-01T03:00:00Z"), new Date("2026-10-01T12:00:00Z"))).toBe("yesterday");
    expect(agoFrom(new Date("2026-09-27T16:00:00Z"), now)).toBe("3 days ago");
  });

  it("says a span without a direction", () => {
    expect(spanOf(1)).toBe("1 day");
    expect(spanOf(-40)).toBe("6 weeks");
  });
});
