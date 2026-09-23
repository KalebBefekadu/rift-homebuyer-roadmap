import { describe, expect, it } from "vitest";
import {
  MOMENTS, STATE_CHIP, serviceCheck,
  type MomentState, type Mood,
} from "./referral";

/**
 * Deliberately narrow. The rule that matters most, that a review invitation
 * is the same for everyone whatever they said privately (decision D12), is
 * walked across every mood and every point in a relationship in
 * referral-moments.test.ts. What is here is the private check itself.
 */

describe("the private service check", () => {
  it("raises a follow-up when something is unresolved or they are unhappy", () => {
    expect(serviceCheck("mixed").followUp).toBe(true);
    expect(serviceCheck("bad").followUp).toBe(true);
    expect(serviceCheck("bad").label).toContain("today");
  });

  it("raises none when it went well, or before they have been asked", () => {
    expect(serviceCheck("good").followUp).toBe(false);
    /* Unanswered is not a problem to chase; it is a question not yet asked. */
    expect(serviceCheck(null).followUp).toBe(false);
    expect(serviceCheck(null).note).toMatch(/never whether they are asked for a review/);
  });

  it("gives every answer a label and a note", () => {
    for (const mood of ["good", "mixed", "bad", null] as Mood[]) {
      expect(serviceCheck(mood).label.trim()).not.toBe("");
      expect(serviceCheck(mood).note.trim()).not.toBe("");
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
    expect(first.review).toBe(false);
    expect(first.ask.toLowerCase()).toContain("send this to someone");
    expect(first.strength).toBeLessThan(5);
  });

  it("marks the review asks, so the screen can say which moments include one", () => {
    const review = MOMENTS.filter((m) => m.review).map((m) => m.id);
    expect(review).toContain("closing_day");
    expect(review).toContain("month_6");
  });

  it("has a chip for every state a moment can be in", () => {
    const states: MomentState[] = ["waiting", "due", "sent", "acted", "declined", "held"];
    for (const s of states) {
      expect(STATE_CHIP[s].l, s).toBeTruthy();
      expect(STATE_CHIP[s].c, s).toBeTruthy();
    }
  });
});
