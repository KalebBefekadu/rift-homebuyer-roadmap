import { describe, it, expect } from "vitest";
import { dependencyError, eventError, lineFor, stateOf, type Dependency } from "./dependency";

const dep = (events: Dependency["events"] = []): Dependency => ({
  id: "d1", saleJourneyId: "s", purchaseJourneyId: "p", saleLabel: "Selling 12 Oak St", purchaseLabel: "Buying in Decatur",
  kind: "proceeds", note: "Down payment comes from the sale", owner: "Kaleb", by: "Kaleb", at: "2026-09-28T12:00:00Z", events,
});

describe("a sale linked to a purchase (STATE-07)", () => {
  it("is open until something is recorded, and reopened is open again", () => {
    expect(stateOf(dep())).toBe("open");
    expect(stateOf(dep([{ state: "met", evidence: "Funds wired", by: "K", at: "2026-10-03T12:00:00Z" }]))).toBe("met");
    expect(stateOf(dep([
      { state: "met", evidence: "Funds wired", by: "K", at: "2026-10-03T12:00:00Z" },
      { state: "reopened", evidence: "Wire returned", by: "K", at: "2026-10-04T12:00:00Z" },
    ]))).toBe("open");
  });

  it("needs a kind, two different journeys, words and an owner", () => {
    const ok = { kind: "proceeds", note: "Down payment from the sale", owner: "Kaleb", saleJourneyId: "s", purchaseJourneyId: "p" };
    expect(dependencyError(ok)).toBeNull();
    expect(dependencyError({ ...ok, kind: "vibes" })).toMatch(/Choose/);
    expect(dependencyError({ ...ok, purchaseJourneyId: "s" })).toMatch(/different/);
    expect(dependencyError({ ...ok, owner: " " })).toMatch(/owns/);
  });

  it("is met only with evidence, and not twice", () => {
    expect(eventError("open", "met", "")).toMatch(/shows it was met/);
    expect(eventError("open", "met", "Settlement statement")).toBeNull();
    expect(eventError("met", "met", "Again")).toMatch(/already met/);
    expect(eventError("open", "reopened", "Why not")).toMatch(/already open/);
  });

  it("reads from each side", () => {
    expect(lineFor(dep(), "buy")).toBe("Needs the sale's proceeds: Selling 12 Oak St");
    expect(lineFor(dep(), "sell")).toBe("A purchase needs this sale's proceeds: Buying in Decatur");
  });
});
