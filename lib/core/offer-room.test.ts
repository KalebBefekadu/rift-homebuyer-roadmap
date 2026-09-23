import { describe, it, expect } from "vitest";
import {
  draftTake, canApprove, takeIsCurrent, wasEdited, snapshotOf, canChoose,
  RECOMMENDATION_MARKER, EMPTY_ROOM, NOT_ACCEPTANCE, type OfferRoom,
} from "./offer-room";
import type { Offer } from "./offers";

const offer = (o: Partial<Offer> & { id: string; from: string; price: number }): Offer => ({
  concessions: 0, repairCredit: 0, financing: "conventional", earnest: 5_000,
  closeOn: "2026-10-17", contingencies: [], preapproval: true, proofOfFunds: false,
  note: null, releasedAt: "2026-09-20T10:00:00Z", createdAt: "2026-09-20T09:00:00Z", ...o,
});

/* The prototype's own pair: the higher price nets less. */
const whitfield = offer({ id: "w", from: "Whitfield", price: 400_000 });
const deel = offer({
  id: "d", from: "Deel", price: 413_000, concessions: 15_000, financing: "fha",
  preapproval: false, contingencies: ["the sale of their home"],
});
const costs = { payoff: 180_000, commissionPct: 5 };

describe("Rift drafts the facts and leaves the judgement blank", () => {
  it("says when the highest price is not the best net", () => {
    const d = draftTake([whitfield, deel], costs)!;
    expect(d).toMatch(/highest price is Deel/);
    expect(d).toMatch(/not the one that leaves you most/);
    expect(d).toMatch(/Whitfield offered less/);
  });

  it("names paperwork gaps as facts, per offer", () => {
    const d = draftTake([whitfield, deel], costs)!;
    expect(d).toMatch(/Deel: FHA, conditional on the sale of their home; no preapproval letter attached/);
  });

  it("never writes a recommendation; it ends on the marker", () => {
    /* The machine's ranking must not reach a seller dressed as their agent's
       advice. Whatever the draft says, the last line is his to write. */
    const d = draftTake([whitfield, deel], costs)!;
    expect(d.trim().endsWith(RECOMMENDATION_MARKER)).toBe(true);
    expect(d).not.toMatch(/\bI('d| would)\b|recommend|take the/i);
  });

  it("compares terms, not money, when the payoff is unknown", () => {
    const d = draftTake([whitfield, deel], null)!;
    expect(d).toMatch(/payoff, which is not recorded/);
    expect(d).not.toMatch(/leaves you most/);
  });

  it("has nothing to say about nothing", () => {
    expect(draftTake([], costs)).toBeNull();
  });
});

describe("approval", () => {
  it("is refused while the recommendation is still Rift's placeholder", () => {
    const d = draftTake([whitfield], costs)!;
    expect(canApprove(d, [whitfield])).toMatch(/Replace the bracketed line/);
  });

  it("is refused with nothing released", () => {
    expect(canApprove("I would take it.", [])).toMatch(/Release at least one offer/);
  });

  it("is allowed once the agent has written his own line", () => {
    const d = draftTake([whitfield], costs)!.replace(RECOMMENDATION_MARKER, "I would take it.");
    expect(canApprove(d, [whitfield])).toBeNull();
  });

  it("knows whether the facts were rewritten", () => {
    const prepared = draftTake([whitfield, deel], costs)!;
    const kept: OfferRoom = { ...EMPTY_ROOM, prepared, take: prepared.replace(RECOMMENDATION_MARKER, "Whitfield."), approvedAt: "x", approvedFor: ["w", "d"] };
    const rewritten: OfferRoom = { ...kept, take: "Take Whitfield. Deel is a gamble." };
    expect(wasEdited(kept)).toBe(false);
    expect(wasEdited(rewritten)).toBe(true);
  });
});

describe("a take describes one set of offers", () => {
  const room: OfferRoom = { ...EMPTY_ROOM, prepared: "p", take: "t", approvedAt: "x", approvedFor: ["w", "d"] };

  it("is current for exactly that set, in any order", () => {
    expect(takeIsCurrent(room, [deel, whitfield])).toBe(true);
  });

  it("goes stale when an offer is released after it", () => {
    /* "I would take Whitfield" above an offer that arrived an hour later is
       advice about a choice that no longer exists. */
    const late = offer({ id: "n", from: "Newcomer", price: 420_000 });
    expect(takeIsCurrent(room, [whitfield, deel, late])).toBe(false);
  });

  it("goes stale when an offer is withdrawn", () => {
    expect(takeIsCurrent(room, [whitfield])).toBe(false);
  });

  it("is never current when nothing was approved", () => {
    expect(takeIsCurrent(EMPTY_ROOM, [])).toBe(false);
  });
});

describe("the seller's choice", () => {
  it("records the net they were shown and whether it was the best", () => {
    const s = snapshotOf(deel, [whitfield, deel], costs, null);
    expect(s.from).toBe("Deel");
    expect(s.bestNet).toBe(false);
    expect(s.net).not.toBeNull();
    expect(s.askedBack).toBe(15_000);
    expect(s.gaps).toContain("No preapproval letter attached");
    expect(s.of).toBe(2);
  });

  it("records no net when none was shown", () => {
    const s = snapshotOf(whitfield, [whitfield, deel], null, null);
    expect(s.net).toBeNull();
    expect(s.bestNet).toBeNull();
  });

  it("can only be made once, and only for an offer on the page", () => {
    expect(canChoose("w", [whitfield], EMPTY_ROOM)).toBeNull();
    expect(canChoose("gone", [whitfield], EMPTY_ROOM)).toMatch(/no longer in front of you/);
    expect(canChoose("w", [whitfield], { ...EMPTY_ROOM, chosenOfferId: "d" })).toMatch(/already told/);
  });

  it("is never described as an acceptance", () => {
    expect(NOT_ACCEPTANCE).toMatch(/Nothing is accepted or signed/);
  });
});
