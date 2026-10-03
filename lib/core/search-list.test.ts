import { describe, expect, it } from "vitest";
import { searchListing } from "./search-list";

const base = { stage: "search" as const, status: "active" as const, statusReason: null, search: "draft" as const };

describe("the Search list", () => {
  it("lists an active buyer who is still looking, and says what they need", () => {
    expect(searchListing(base)).toMatchObject({ listed: true, group: "needs", next: "Write the brief" });
  });

  it("does not list a journey that has completed, been cancelled, or reached a contract", () => {
    expect(searchListing({ ...base, status: "completed", stage: "own" }).listed).toBe(false);
    expect(searchListing({ ...base, status: "cancelled" }).listed).toBe(false);
    expect(searchListing({ ...base, stage: "under-contract" }).listed).toBe(false);
    expect(searchListing({ ...base, stage: "close" }).listed).toBe(false);
  });

  it("keeps a paused journey, in its own group, with the reason", () => {
    expect(searchListing({ ...base, status: "paused", statusReason: "Delayed until October" }))
      .toMatchObject({ listed: true, group: "paused", next: "Journey paused: Delayed until October" });
  });

  it("puts a running search in running and a search paused in Matrix in paused", () => {
    expect(searchListing({ ...base, search: "active-confirmed" }).group).toBe("running");
    expect(searchListing({ ...base, search: "paused" }).group).toBe("paused");
  });

  it("ranks what is his to do first, and an unreadable status among it", () => {
    const r = (s: Parameters<typeof searchListing>[0]["search"]) => searchListing({ ...base, search: s }).rank;
    expect(r("manual-action-needed")).toBeLessThan(r("update-pending"));
    expect(r("unknown")).toBeLessThan(r("active-confirmed"));
    expect(searchListing({ ...base, search: "unknown" }).group).toBe("needs");
  });
});
