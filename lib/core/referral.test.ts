import { describe, expect, it } from "vitest";
import {
  MOMENTS, REFERRAL_STATE, STATE_CHIP, dueNow, gate, referralStats,
  type MomentState, type Mood,
} from "./referral";

/**
 * Deliberately narrow.
 *
 * This module is reached only from `/prototype/*`, which does not serve in
 * production — it is the specification for phase 5, not running code. What is
 * tested here is the one rule that has to survive into the real
 * implementation, because getting it wrong is not a bug but a thing done to a
 * person: nobody is asked to say something in public before they have been
 * asked, in private, whether they are happy.
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

describe("the queue and the counts", () => {
  it("puts the strongest moment first", () => {
    const strengths = dueNow().map((x) => x.m.strength);
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
  });

  it("carries only what is due or being held", () => {
    for (const { c, m } of dueNow()) {
      expect(["due", "held"]).toContain(c.states[m.id]);
    }
  });

  /**
   * The invariant the gate exists for, asserted against the seeded board: no
   * moment that would put somebody in public is queued for a client who has
   * not said they are happy. It holds today. It is here so that it still has
   * to hold when this board is real data.
   */
  it("queues no public ask for a client who has not said it went well", () => {
    for (const { c, m } of dueNow()) {
      if (!m.gated) continue;
      expect(gate(c.mood).askPublicly, `${c.client} · ${m.id}`).toBe(true);
    }
  });

  it("counts referrals without double-counting an advocate", () => {
    const s = referralStats();
    const sent = REFERRAL_STATE.flatMap((c) => c.sent);
    expect(s.sent).toBe(sent.length);
    expect(s.closed + s.active).toBeLessThanOrEqual(s.sent);
    expect(s.advocates).toBeLessThanOrEqual(REFERRAL_STATE.length);
    expect(s.advocates).toBe(REFERRAL_STATE.filter((c) => c.sent.length > 0).length);
  });

  it("only uses states the model defines", () => {
    const states: MomentState[] = ["waiting", "due", "sent", "acted", "declined", "held"];
    const ids = new Set(MOMENTS.map((m) => m.id));
    for (const c of REFERRAL_STATE) {
      for (const [id, st] of Object.entries(c.states)) {
        expect(ids.has(id as never), `${c.client} · ${id}`).toBe(true);
        expect(states).toContain(st);
      }
    }
  });
});
