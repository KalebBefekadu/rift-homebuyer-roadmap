import { describe, it, expect } from "vitest";
import { sinceLastLook, nextSeen, SEEN_GAP_MINUTES } from "./since";

const base = { stage: { label: "Under contract", since: "2026-10-10T15:00:00Z" }, work: [], homes: [], decisions: [] };

describe("since you last looked (audit portals-2026-10, item 10)", () => {
  it("says nothing on a first visit", () => {
    expect(sinceLastLook({ ...base, lastSeen: null })).toBeNull();
  });

  it("lists what changed after the day of the last visit, and only that", () => {
    const r = sinceLastLook({
      ...base,
      lastSeen: "2026-10-08T14:00:00Z",
      work: [
        { label: "Title", stateLabel: "Under way", lastWord: { on: "2026-10-09", from: "Smith Law" } },
        { label: "Financing", stateLabel: "Waiting", lastWord: { on: "2026-10-03", from: "Kaleb" } },
      ],
      homes: [{ address: "12 Oak St", createdAt: "2026-10-11T12:00:00Z", withdrawnAt: null }, { address: "1 Elm St", createdAt: "2026-10-01T12:00:00Z", withdrawnAt: null }],
      decisions: [{ question: "Which counter?", releasedAt: "2026-10-12T12:00:00Z" }],
    })!;
    expect(r.day).toBe("2026-10-08");
    expect(r.lines).toEqual([
      "Your move reached Under contract.",
      "A decision for you: Which counter?",
      "A home was added: 12 Oak St.",
      "Title: Under way, word from Smith Law.",
    ]);
  });

  it("says plainly when nothing changed", () => {
    expect(sinceLastLook({ ...base, stage: { label: "Search", since: "2026-09-01T00:00:00Z" }, lastSeen: "2026-10-08T14:00:00Z" })!.lines).toEqual([]);
  });

  it("starts a new visit only after a gap, so moving between tabs does not reset it", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(nextSeen({ seenAt: null, seenBefore: null }, now)).toEqual({ write: { seenAt: now.toISOString(), seenBefore: null }, since: null });
    const recent = new Date(now.getTime() - (SEEN_GAP_MINUTES - 1) * 60_000).toISOString();
    expect(nextSeen({ seenAt: recent, seenBefore: "2026-10-08T14:00:00Z" }, now)).toEqual({ write: null, since: "2026-10-08T14:00:00Z" });
    expect(nextSeen({ seenAt: "2026-10-09T10:00:00Z", seenBefore: "2026-10-08T14:00:00Z" }, now))
      .toEqual({ write: { seenAt: now.toISOString(), seenBefore: "2026-10-09T10:00:00Z" }, since: "2026-10-09T10:00:00Z" });
  });
});
