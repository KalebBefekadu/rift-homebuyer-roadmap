import { describe, it, expect } from "vitest";
import { checklist, listingError, listingLine, listingStatus, reviewError, showingCounts, showingError, showingsFrom, type ListingEvent, type ShowingRow } from "./listing";

const ev = (kind: ListingEvent["kind"], at: string, extra: Partial<ListingEvent> = {}): ListingEvent => ({ kind, detail: "Done by Kaleb", url: null, price: null, by: "Kaleb", at, ...extra });
const NOW = new Date("2026-10-10T15:00:00Z");

describe("listing and launch (S06, S07)", () => {
  it("the checklist names what is still to do; going live needs the MLS link", () => {
    const events = [ev("photos", "2026-10-01T12:00:00Z"), ev("copy", "2026-10-02T12:00:00Z")];
    expect(checklist(events).filter((c) => !c.done).map((c) => c.kind)).toEqual(["measurements", "disclosures", "access"]);
    expect(listingLine(events, [])).toMatch(/Still to do: measurements, disclosures, access arranged/);
    expect(listingError({ kind: "mls-live", detail: "Live", url: null, price: null }, events)).toMatch(/MLS link/);
    expect(listingError({ kind: "mls-live", detail: "Live", url: "https://fmls.com/123", price: null }, events)).toBeNull();
  });

  it("never records an access code, and syndication is its own fact after going live", () => {
    expect(listingError({ kind: "access", detail: "Lockbox code 4471 on the back door", url: null, price: null }, [])).toMatch(/never the code/);
    expect(listingError({ kind: "access", detail: "ShowingTime set up, lockbox on the back door", url: null, price: null }, [])).toBeNull();
    expect(listingError({ kind: "syndicated", detail: "On Zillow", url: null, price: null }, [])).toMatch(/live on the MLS first/);
    const live = [ev("mls-live", "2026-10-03T12:00:00Z", { url: "https://fmls.com/123" })];
    expect(listingStatus(live)).toMatchObject({ status: "live", syndicated: false });
    expect(listingLine(live, [])).toMatch(/other sites can take a day or two/);
  });

  it("a price change carries a price; withdraw and relist follow each other", () => {
    const live = [ev("mls-live", "2026-10-03T12:00:00Z", { url: "https://fmls.com/123" })];
    expect(listingError({ kind: "price-change", detail: "Reduced after review", url: null, price: null }, live)).toMatch(/new list price/);
    expect(listingError({ kind: "relisted", detail: "Back on", url: null, price: null }, live)).toMatch(/follows a withdrawal/);
    const withdrawn = [...live, ev("withdrawn", "2026-10-05T12:00:00Z")];
    expect(listingStatus(withdrawn).status).toBe("withdrawn");
    expect(listingError({ kind: "relisted", detail: "Back on", url: null, price: null }, withdrawn)).toBeNull();
  });
});

const row = (key: string, state: ShowingRow["state"], at: string, extra: Partial<ShowingRow> = {}): ShowingRow =>
  ({ key, startsAt: "2026-10-05T18:00:00Z", state, showingAgent: null, feedback: null, interest: null, by: "Kaleb", at, ...extra });

describe("showings, counted honestly (S08)", () => {
  it("counts feedback over the showings done, with the denominator", () => {
    const list = showingsFrom([
      row("a", "confirmed", "2026-10-04T12:00:00Z"), row("a", "done", "2026-10-05T20:00:00Z", { feedback: "Liked the kitchen", interest: "some" }),
      row("b", "done", "2026-10-06T20:00:00Z"),
      row("c", "done", "2026-10-07T20:00:00Z"),
      row("d", "requested", "2026-10-08T12:00:00Z", { startsAt: "2026-10-12T18:00:00Z" }),
    ]);
    const c = showingCounts(list);
    expect(c).toMatchObject({ done: 3, withFeedback: 1, upcoming: 1 });
    expect(c.line).toMatch(/1 of 3 gave feedback; no feedback is not a sign either way/);
  });

  it("feedback only after a showing that happened, and interest only from feedback", () => {
    expect(showingError({ state: "confirmed", startsAt: "2026-10-12T18:00:00Z", feedback: "Nice", interest: null }, null, NOW)).toMatch(/after the showing/);
    expect(showingError({ state: "done", startsAt: "2026-10-12T18:00:00Z", feedback: null, interest: null }, null, NOW)).toMatch(/after it happened/);
    expect(showingError({ state: "done", startsAt: "2026-10-05T18:00:00Z", feedback: null, interest: "strong" }, null, NOW)).toMatch(/feedback the interest came from/);
  });
});

describe("weekly review (S09)", () => {
  it("records the seller's decision, and never says price is the reason", () => {
    const ok = { weekOf: "2026-10-05", metrics: "FMLS: 412 views", summary: "Three showings, one with feedback on the kitchen.", decision: "keep", decisionNote: null };
    expect(reviewError(ok, "2026-10-10")).toBeNull();
    expect(reviewError({ ...ok, decision: "change" }, "2026-10-10")).toMatch(/what changes/);
    expect(reviewError({ ...ok, summary: "No offers because of the price, it is overpriced." }, "2026-10-10")).toMatch(/never states that price is the reason/);
  });
});
