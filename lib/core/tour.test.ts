import { describe, expect, it } from "vitest";
import {
  NEXT, TOUR_STATUSES, buyerLabel, feedbackError, slotError, slotLabel, stepError, viewOf, zonedToUtc,
  type TourContext, type TourStatus, type TourStep,
} from "./tour";

const OK: TourContext = { covered: true, coverageNote: "Signed and in force until 2027-01-01.", homeWithdrawn: false };
const LAPSED: TourContext = { covered: false, coverageNote: "The agreement expired 2 days ago.", homeWithdrawn: false };
const GONE: TourContext = { ...OK, homeWithdrawn: true };

const step = (seq: number, status: TourStatus, extra: Partial<TourStep> = {}): TourStep => ({
  seq, status, startsAt: null, endsAt: null, ref: null, note: null, by: "Kaleb", at: "2026-10-01T12:00:00Z", ...extra,
});
const SLOT = { startsAt: "2026-10-03T18:00:00.000Z", endsAt: "2026-10-03T18:30:00.000Z" };

describe("the steps a showing can take", () => {
  it("never lets a finished showing move again", () => {
    for (const to of TOUR_STATUSES) {
      expect(stepError("cancelled", { to, note: "x", ...SLOT }, OK)).toMatch(/finished/);
      expect(stepError("completed", { to, note: "x", ...SLOT }, OK)).toMatch(/finished/);
    }
  });

  it("refuses a jump the listing side never made", () => {
    expect(stepError("requested", { to: "confirmed", ...SLOT }, OK)).toMatch(/cannot become/);
    expect(stepError("requested", { to: "completed" }, OK)).toMatch(/cannot become/);
  });

  it("allows only what NEXT lists", () => {
    for (const from of TOUR_STATUSES) {
      for (const to of TOUR_STATUSES) {
        const err = stepError(from, { to, note: "reason", ...SLOT }, OK);
        expect(err === null, `${from} -> ${to}: ${err}`).toBe(NEXT[from].includes(to));
      }
    }
  });
});

describe("a request is not an appointment (AT17)", () => {
  it("stays unconfirmed until a confirmed time is recorded", () => {
    for (const s of ["requested", "awaiting-confirmation"] as const) {
      const v = viewOf([step(1, "requested"), ...(s === "requested" ? [] : [step(2, s)])], OK);
      expect(v.status).toBe(s);
      expect(v.slot).toBeNull();
      expect(buyerLabel(v, "Kaleb")).not.toMatch(/confirmed:/i);
    }
  });

  it("needs a real slot to confirm", () => {
    expect(stepError("awaiting-confirmation", { to: "confirmed" }, OK)).toMatch(/date and the start and end/);
    expect(stepError("awaiting-confirmation", { to: "confirmed", startsAt: SLOT.endsAt, endsAt: SLOT.startsAt }, OK)).toMatch(/after the start/);
    expect(slotError("2026-10-03T13:00:00Z", "2026-10-03T18:00:01Z")).toMatch(/four hours/);
  });
});

describe("cover is checked at every step, not once (AT18)", () => {
  it("refuses to ask for or confirm a time without a signed agreement in force", () => {
    expect(stepError("requested", { to: "awaiting-confirmation" }, LAPSED)).toMatch(/signed buyer agreement.*expired 2 days ago/);
    expect(stepError("awaiting-confirmation", { to: "confirmed", ...SLOT }, LAPSED)).toMatch(/signed buyer agreement/);
    expect(stepError("changed", { to: "confirmed", ...SLOT }, LAPSED)).toMatch(/signed buyer agreement/);
  });

  it("still lets the record say what happened when something went wrong", () => {
    expect(stepError("confirmed", { to: "cancelled", note: "agreement lapsed" }, LAPSED)).toBeNull();
    expect(stepError("confirmed", { to: "completed" }, LAPSED)).toBeNull();
    expect(stepError("confirmed", { to: "changed", ...SLOT }, LAPSED)).toBeNull();
    expect(stepError("confirmed", { to: "cancelled", note: "sold" }, GONE)).toBeNull();
  });

  it("shows a confirmed showing as blocked the day the agreement lapses, with the fix", () => {
    const steps = [step(1, "requested"), step(2, "awaiting-confirmation"), step(3, "confirmed", SLOT)];
    const ok = viewOf(steps, OK, new Date("2026-10-01T00:00:00Z"));
    expect(ok.blocked).toBeNull();
    const lapsed = viewOf(steps, LAPSED, new Date("2026-10-01T00:00:00Z"));
    expect(lapsed.blocked).toMatch(/cannot go ahead.*expired 2 days ago.*Renew it, or cancel/);
    expect(lapsed.nextStep).toBe(lapsed.blocked);
  });

  it("blocks a showing for a home that came off the list", () => {
    const v = viewOf([step(1, "requested"), step(2, "awaiting-confirmation")], GONE);
    expect(v.blocked).toMatch(/off the list/);
    expect(stepError("requested", { to: "awaiting-confirmation" }, GONE)).toMatch(/off the list/);
  });

  it("does not block a bare request, which is only somebody asking", () => {
    const v = viewOf([step(1, "requested")], LAPSED);
    expect(v.blocked).toBeNull();
    expect(v.nextStep).toMatch(/Before asking for a time/);
  });

  it("never tells the buyer why something is on hold", () => {
    const v = viewOf([step(1, "requested"), step(2, "awaiting-confirmation"), step(3, "confirmed", SLOT)], LAPSED);
    const text = buyerLabel(v, "Kaleb");
    expect(text).toMatch(/On hold/);
    expect(text).not.toMatch(/agreement|expired|signed/i);
  });
});

describe("the latest step is the state", () => {
  it("reads steps in sequence, not in the order they arrived", () => {
    const v = viewOf([step(3, "confirmed", SLOT), step(1, "requested"), step(2, "awaiting-confirmation")], OK);
    expect(v.status).toBe("confirmed");
    expect(v.slot).toEqual(SLOT);
  });

  it("carries the newest slot through a change", () => {
    const moved = { startsAt: "2026-10-04T15:00:00.000Z", endsAt: "2026-10-04T15:30:00.000Z" };
    const v = viewOf([step(1, "requested"), step(2, "awaiting-confirmation"), step(3, "confirmed", SLOT), step(4, "changed", moved)], OK);
    expect(v.status).toBe("changed");
    expect(v.slot).toEqual(moved);
    expect(buyerLabel(v, "Kaleb")).toMatch(/time changed/);
  });

  it("flags a confirmed showing whose time has passed without an outcome", () => {
    const steps = [step(1, "requested"), step(2, "awaiting-confirmation"), step(3, "confirmed", SLOT)];
    expect(viewOf(steps, OK, new Date("2026-10-03T17:00:00Z")).overdue).toBe(false);
    const after = viewOf(steps, OK, new Date("2026-10-04T00:00:00Z"));
    expect(after.overdue).toBe(true);
    expect(after.nextStep).toMatch(/has passed/);
  });

  it("asks the post-showing question once it happened", () => {
    const v = viewOf([step(1, "requested"), step(2, "awaiting-confirmation"), step(3, "confirmed", SLOT), step(4, "completed")], OK);
    expect(v.nextStep).toMatch(/would they consider an offer/);
    expect(v.slot).toBeNull();
  });
});

describe("times in the agent's market", () => {
  it("turns a Georgia wall-clock time into the right instant, summer and winter", () => {
    expect(zonedToUtc("2026-10-03", "14:00")).toBe("2026-10-03T18:00:00.000Z"); // EDT, UTC-4
    expect(zonedToUtc("2026-12-05", "14:00")).toBe("2026-12-05T19:00:00.000Z"); // EST, UTC-5
  });

  it("gets the days the clocks change right", () => {
    expect(zonedToUtc("2026-03-08", "10:00")).toBe("2026-03-08T14:00:00.000Z"); // after spring forward
    expect(zonedToUtc("2026-11-01", "10:00")).toBe("2026-11-01T15:00:00.000Z"); // after fall back
  });

  it("refuses what it cannot read", () => {
    expect(zonedToUtc("10/03/2026", "14:00")).toBeNull();
    expect(zonedToUtc("2026-10-03", "2pm")).toBeNull();
  });

  it("reads a slot back the way ShowingTime shows it", () => {
    expect(slotLabel("2026-10-03T18:00:00.000Z", "2026-10-03T18:30:00.000Z")).toMatch(/^Sat, Oct 3, 2:00.to 2:30.PM$/);
    expect(slotLabel("2026-10-03T15:30:00.000Z", "2026-10-03T16:30:00.000Z")).toMatch(/^Sat, Oct 3, 11:30.AM to 12:30.PM$/);
  });
});

describe("after the showing (REQ-SEARCH-08)", () => {
  it("asks for one answer, with reasons optional", () => {
    expect(feedbackError({ offer: "yes", reason: null, searchChange: null })).toBeNull();
    expect(feedbackError({ offer: "rating-5" as never, reason: null, searchChange: null })).toMatch(/Choose/);
    expect(feedbackError({ offer: "no", reason: "x".repeat(501), searchChange: null })).toMatch(/under 500/);
  });
});
