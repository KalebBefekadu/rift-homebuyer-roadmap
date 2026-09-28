import { describe, it, expect } from "vitest";
import { journeyHistory } from "./journey-history";

describe("a journey's history", () => {
  it("says stages and statuses in words, not their stored ids", () => {
    const h = journeyHistory({
      events: [{ seq: 1, kind: "stage", from: "price-launch", to: "market", reason: "Live on the MLS", evidence: null, contractId: null, by: "Kaleb", at: "2026-09-20T12:00:00Z" }],
      revisions: [],
    });
    expect(h[0]!.text).toBe("Stage Price & launch to Market & show");
  });

  it("includes a sale's pricing, proceeds, listing and weekly reviews, newest first", () => {
    const h = journeyHistory({
      events: [], revisions: [],
      opinions: [{ id: "o1", version: 2, listPrice: 425_000, low: 410_000, high: 440_000, comps: [], rationale: "r", reviewOn: "2026-10-05", by: "Kaleb", at: "2026-09-21T12:00:00Z", responses: [] }],
      figures: [{ kind: "planning", price: 425_000, owed: 200_000, owedSource: "balance", commissionPct: 5, credits: 0, officialNet: null, source: "Kaleb's estimate", asOf: "2026-09-21", note: null, by: "Kaleb", at: "2026-09-21T13:00:00Z" }],
      listing: {
        events: [{ kind: "mls-live", detail: "FMLS 123", url: "https://example.com", price: 425_000, by: "Kaleb", at: "2026-09-22T12:00:00Z" }],
        reviews: [{ weekOf: "2026-09-28", metrics: null, summary: "Six showings", decision: "keep", decisionNote: null, by: "Kaleb", at: "2026-09-28T12:00:00Z" }],
      },
    });
    expect(h.map((x) => x.text)).toEqual([
      "Weekly review, week of 2026-09-28: keep the course",
      "Live on the MLS at $425,000",
      expect.stringMatching(/^Proceeds: .* at \$425,000$/),
      "Pricing version 2: list at $425,000, range $410,000 to $440,000",
    ]);
  });
});
