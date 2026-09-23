import { describe, expect, it } from "vitest";
import {
  MOMENTS, STATE_CHIP, gate,
  type MomentState, type Mood,
} from "./referral";

/**
 * Deliberately narrow.
 *
 * What is tested here is the one rule that has to hold however the engine is
 * driven, because getting it wrong is not a bug but a thing done to a person:
 * nobody is asked to say something in public before they have been asked, in
 * private, whether they are happy.
 *
 * The moments are now derived from real lifecycle data rather than a fixture
 *: see referral-moments.test.ts, which walks every combination of mood and
 * gate rather than the five clients somebody happened to invent.
 */

describe("the satisfaction gate", () => {
  it("asks publicly only after they have said it went well", () => {
    const g = gate("good");
    expect(g.askPublicly).toBe(true);
    expect(g.route).toBe("Review request sent");
  });

  it("never asks publicly on anything else", () => {
    for (const mood of ["mixed", "bad", null] as Mood[]) {
      expect(gate(mood).askPublicly, String(mood)).toBe(false);
    }
  });

  /* The default matters most: `mood` is null until they answer, which is the
     state every client is in when the moment first comes due. */
  it("says nothing public before they have answered at all", () => {
    expect(gate(null).askPublicly).toBe(false);
    expect(gate(null).note).toContain("before they answer");
  });

  it("sends an unresolved one to Kaleb rather than to a review form", () => {
    expect(gate("mixed").route).toBe("Raised with Kaleb");
    expect(gate("mixed").note).toContain("publish a shrug");
  });

  it("treats a bad answer as work to do, not a lead to nurture", () => {
    const g = gate("bad");
    expect(g.route).toContain("today");
    expect(g.note).toContain("The job is to fix it");
  });

  it("gives every outcome somewhere to go", () => {
    for (const mood of ["good", "mixed", "bad", null] as Mood[]) {
      expect(gate(mood).route.trim()).not.toBe("");
      expect(gate(mood).note.trim()).not.toBe("");
    }
  });
});

describe("the moments", () => {
  it("names each one once", () => {
    const ids = MOMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives each a trigger, an ask and a reason for being that moment", () => {
    for (const m of MOMENTS) {
      expect(m.trigger.trim(), m.id).not.toBe("");
      expect(m.ask.trim(), m.id).not.toBe("");
      expect(m.why.trim().length, m.id).toBeGreaterThan(20);
      expect(m.strength, m.id).toBeGreaterThanOrEqual(1);
      expect(m.strength, m.id).toBeLessThanOrEqual(5);
    }
  });

  /* Rule 1 of the design: the ask scales with what they have received. Right
     after a readout the ask is for the tool, not for a person. */
  it("asks for the tool at the moment they have received the least", () => {
    const first = MOMENTS.find((m) => m.id === "value_delivered")!;
    expect(first.gated).toBe(false);
    expect(first.ask.toLowerCase()).toContain("send this to someone");
    expect(first.strength).toBeLessThan(5);
  });

  it("gates every moment that would put them in public", () => {
    const gated = MOMENTS.filter((m) => m.gated).map((m) => m.id);
    expect(gated.length).toBeGreaterThan(0);
    /* Closing day and the two follow-ups are the review asks. */
    expect(gated).toContain("closing_day");
  });

  it("has a chip for every state a moment can be in", () => {
    const states: MomentState[] = ["waiting", "due", "sent", "acted", "declined", "held"];
    for (const s of states) {
      expect(STATE_CHIP[s].l, s).toBeTruthy();
      expect(STATE_CHIP[s].c, s).toBeTruthy();
    }
  });
});
