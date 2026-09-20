import { describe, expect, it } from "vitest";
import {
  KIND_LABEL, REVIEW_SLA_HOURS, SEEDED, ceilingNote, nextRung, openItems,
  overdue, promote, rungOf, type ReviewItem, type TrustState,
} from "./review";

/**
 * The trust ladder.
 *
 * Every figure this product shows carries a chip saying how sure anybody is
 * about it, and this module decides which chip. The two constraints it exists
 * to enforce are the ones a UI is most likely to route around: not every item
 * can reach `verified`, and reaching it requires the name of whoever confirmed
 * it. A verified chip with nobody behind it is the precise false confidence
 * the ladder was built to prevent.
 */

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: "x", who: "A client", whoId: "a", kind: "figure",
  what: "Cash to close", claim: "$31,190",
  state: "preliminary", ceiling: "verified",
  raisedBy: "client", raisedAt: "2026-09-05", waitingHours: 0,
  toAdvance: "Confirm the arithmetic.",
  ...over,
});

describe("the rungs are ordered, and the order is the whole point", () => {
  it("runs from an estimate to a fact", () => {
    const order: TrustState[] = ["preliminary", "pending-review", "reviewed", "verified"];
    expect(order.map(rungOf)).toEqual([0, 1, 2, 3]);
  });

  it("offers the next one up until the ceiling", () => {
    expect(nextRung(item({ state: "preliminary" }))).toBe("pending-review");
    expect(nextRung(item({ state: "pending-review" }))).toBe("reviewed");
    expect(nextRung(item({ state: "reviewed" }))).toBe("verified");
    expect(nextRung(item({ state: "verified" }))).toBeNull();
  });

  it("offers nothing past an item's own ceiling", () => {
    /* A repair budget is a judgement. Nobody certifies it, ever. */
    expect(nextRung(item({ state: "reviewed", ceiling: "reviewed" }))).toBeNull();
    expect(nextRung(item({ state: "pending-review", ceiling: "pending-review" }))).toBeNull();
  });
});

describe("why an item cannot go higher, said rather than greyed out", () => {
  it("says nothing while there is still room", () => {
    expect(ceilingNote(item({ state: "preliminary", ceiling: "verified" }))).toBeNull();
  });

  it("explains a judgement ceiling in the product's own terms", () => {
    const note = ceilingNote(item({ state: "reviewed", ceiling: "reviewed" }));
    expect(note).toContain("judgement, not a fact");
    expect(note).toContain("lie with a green chip on it");
  });

  it("closes the top rung without apology", () => {
    expect(ceilingNote(item({ state: "verified", ceiling: "verified" }))).toBe("Confirmed in writing. Nothing above this.");
  });
});

describe("promotion", () => {
  it("advances one rung", () => {
    const r = promote(item({ state: "preliminary" }), "pending-review");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.item.state).toBe("pending-review");
  });

  it("refuses a skipped rung and names the real next one", () => {
    /* The message read `to === "verified" ? "review" : next`, so the one case
       it was written for was told "Next is review" — a rung that does not
       exist — while the actual next rung went unmentioned. */
    const r = promote(item({ state: "preliminary" }), "verified", "A lender");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.why).toContain("Next is pending-review.");
      expect(r.why).not.toContain("Next is review.");
    }
  });

  it("refuses verification with no name behind it", () => {
    for (const name of [undefined, "", "   "]) {
      const r = promote(item({ state: "reviewed" }), "verified", name);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why).toContain("needs the name of who confirmed it");
    }
  });

  it("accepts verification with one", () => {
    const r = promote(item({ state: "reviewed" }), "verified", "Brookhaven Mortgage, 3 Sep 2026");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item.state).toBe("verified");
      expect(r.item.confirmedBy).toBe("Brookhaven Mortgage, 3 Sep 2026");
    }
  });

  it("does not record a confirming party against a rung that is not a confirmation", () => {
    /* `confirmedBy` means the party who decides confirmed it in writing. Only
       `verified` means that; recording a name at `reviewed` puts somebody
       else's authority behind Kaleb's own judgement. */
    const r = promote(item({ state: "pending-review" }), "reviewed", "Brookhaven Mortgage");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.item.confirmedBy).toBeUndefined();
  });

  it("refuses to move an item that is already at its ceiling", () => {
    const r = promote(item({ state: "reviewed", ceiling: "reviewed" }), "verified", "Somebody");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toContain("judgement, not a fact");
  });

  it("cannot be used to move an item back down", () => {
    for (const to of ["preliminary", "pending-review"] as TrustState[]) {
      expect(promote(item({ state: "reviewed" }), to).ok).toBe(false);
    }
  });

  it("never mutates the item it was given", () => {
    const original = item({ state: "preliminary" });
    promote(original, "pending-review");
    expect(original.state).toBe("preliminary");
  });
});

describe("the queue an agent actually sees", () => {
  it("shows only what is waiting on them", () => {
    const rows = openItems(SEEDED);
    expect(rows.every((i) => i.state === "pending-review")).toBe(true);
    expect(rows.length).toBeLessThan(SEEDED.length);
  });

  it("puts the longest wait first, because anything else is a to-do list", () => {
    const waits = openItems(SEEDED).map((i) => i.waitingHours);
    expect(waits).toEqual([...waits].sort((a, b) => b - a));
  });

  it("is overdue only past the stated turnaround, and only while waiting", () => {
    expect(overdue(item({ state: "pending-review", waitingHours: REVIEW_SLA_HOURS }))).toBe(false);
    expect(overdue(item({ state: "pending-review", waitingHours: REVIEW_SLA_HOURS + 1 }))).toBe(true);
    /* A reviewed item is not overdue, however long it sat before it moved. */
    expect(overdue(item({ state: "reviewed", waitingHours: 999 }))).toBe(false);
  });
});

describe("the seeded queue is a legal board, not just plausible", () => {
  it("never sits above its own ceiling", () => {
    for (const i of SEEDED) expect(rungOf(i.state)).toBeLessThanOrEqual(rungOf(i.ceiling));
  });

  it("names a confirming party on everything that reached verified, and nothing else", () => {
    for (const i of SEEDED) {
      if (i.state === "verified") expect(i.confirmedBy?.trim()).toBeTruthy();
      else expect(i.confirmedBy).toBeUndefined();
    }
  });

  it("says what has to be true for each item to advance", () => {
    for (const i of SEEDED) {
      expect(i.toAdvance.trim()).not.toBe("");
      expect(KIND_LABEL[i.kind]).toBeTruthy();
    }
  });

  it("includes the case the ceiling rule exists for", () => {
    const judgement = SEEDED.find((i) => i.ceiling === "reviewed");
    expect(judgement).toBeDefined();
    expect(nextRung({ ...judgement!, state: "reviewed" })).toBeNull();
  });
});
