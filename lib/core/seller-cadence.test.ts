import { describe, it, expect } from "vitest";
import { cadenceDue, type SaleCadence } from "./seller-cadence";
import type { ListingEvent } from "./listing";

const ev = (kind: ListingEvent["kind"], at: string): ListingEvent => ({ kind, detail: "x", url: kind === "mls-live" ? "https://example.com/l" : null, price: null, by: "Kaleb", at });
const sale = (over: Partial<SaleCadence> = {}): SaleCadence => ({
  journeyId: "j1", person: "Sam", label: "Sale of 12 Oak St", stage: "market",
  listing: [ev("mls-live", "2026-09-10T15:00:00Z")], lastReviewAt: null, latestOpinion: null, ...over,
});

describe("what a sale owes the agent on a schedule (S04, S09)", () => {
  it("asks for the first weekly review a week after the listing went live", () => {
    expect(cadenceDue([sale()], "2026-09-16")).toEqual([]);
    const [d] = cadenceDue([sale()], "2026-09-17");
    expect(d).toMatchObject({ kind: "weekly-review", due: "2026-09-17", late: 0 });
  });

  it("counts from the last review, and says how late it is", () => {
    const [d] = cadenceDue([sale({ lastReviewAt: "2026-09-17T20:00:00Z" })], "2026-09-28");
    expect(d).toMatchObject({ kind: "weekly-review", due: "2026-09-24", late: 4 });
  });

  it("owes no weekly review for a listing not live or withdrawn", () => {
    expect(cadenceDue([sale({ listing: [] })], "2026-10-30")).toEqual([]);
    expect(cadenceDue([sale({ listing: [ev("mls-live", "2026-09-10T15:00:00Z"), ev("withdrawn", "2026-09-12T15:00:00Z")] })], "2026-10-30")).toEqual([]);
  });

  it("brings the pricing review on the day the opinion named", () => {
    const s = sale({ listing: [], latestOpinion: { version: 2, reviewOn: "2026-09-28" } });
    expect(cadenceDue([s], "2026-09-27")).toEqual([]);
    expect(cadenceDue([s], "2026-09-28")[0]).toMatchObject({ kind: "pricing-review", late: 0, version: 2 });
  });

  it("stops once the sale is under contract or done, and never hides one whose stage did not load", () => {
    const s = sale({ latestOpinion: { version: 1, reviewOn: "2026-09-01" } });
    expect(cadenceDue([{ ...s, stage: "under-contract" }], "2026-09-28")).toEqual([]);
    expect(cadenceDue([{ ...s, stage: "continue" }], "2026-09-28")).toEqual([]);
    expect(cadenceDue([{ ...s, stage: null }], "2026-09-28")).toHaveLength(2);
  });

  it("uses Georgia's day: a listing live at 9pm counts from that evening, not the next day", () => {
    /* 01:00 UTC on 11 Sep is 9pm on 10 Sep in Atlanta. */
    const [d] = cadenceDue([sale({ listing: [ev("mls-live", "2026-09-11T01:00:00Z")] })], "2026-09-17");
    expect(d?.due).toBe("2026-09-17");
  });
});
