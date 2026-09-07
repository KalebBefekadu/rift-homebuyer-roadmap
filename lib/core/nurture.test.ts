import { describe, it, expect } from "vitest";
import { SEQUENCES, STOPS, sequenceFor, resolveChannel, dueFor, nextFor, autonomy } from "./nurture";
import { BUY_FUNNEL } from "./funnel";

/**
 * The cadence's own rules.
 *
 * The one these were written for: the dormant sequence exists for people who
 * started and stopped, so they have no readout — and the ordinary touch leads
 * with the reader's figures and refuses to send without them. That combination
 * meant recovery could never reach the largest population in the funnel, and
 * nothing failed. The runner reported it as "nothing worth sending", which is
 * true of the email it was trying to send and not of the person.
 */

describe("the sequences", () => {
  it("gives every step something to give", () => {
    /* If a step has nothing to say, the step should not exist. A cadence whose
       touches are nudges is the one people mute. */
    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.gives.length, `${seq.band}/${step.id} has no "gives"`).toBeGreaterThan(20);
        expect(step.says.length).toBeGreaterThan(10);
      }
    }
  });

  it("widens its intervals rather than repeating", () => {
    /* A fixed spacing reads as a machine by the third touch. Real attention
       decays and the cadence should follow it. */
    for (const seq of SEQUENCES) {
      const gaps = seq.steps.slice(1).map((s, i) => s.day - seq.steps[i].day);
      const widening = gaps.every((g, i) => i === 0 || g >= gaps[i - 1]);
      expect(widening, `${seq.band} does not widen`).toBe(true);
    }
  });

  it("ends the dormant sequence, and says so", () => {
    /* A list you cannot stop sending to is not a list, it is a liability. */
    const dormant = sequenceFor("nurture");
    expect(dormant.steps.length).toBeLessThanOrEqual(2);
    expect(dormant.ends.toLowerCase()).toContain("stops");
    expect(dormant.steps.at(-1)!.id).toBe("d2");
  });

  it("has a stop for every way a person can end it", () => {
    const ids = STOPS.map((s) => s.id);
    expect(ids).toContain("replied");
    expect(ids).toContain("unsubscribed");
    expect(ids).toContain("bounced");
    for (const s of STOPS) expect(s.why.length).toBeGreaterThan(20);
  });
});

describe("consent gates the channel, not the sequence", () => {
  it("downgrades a text to email and says why", () => {
    const text = SEQUENCES.flatMap((s) => s.steps).find((s) => s.channel === "text")!;
    const out = resolveChannel(text, false);
    expect(out.channel).toBe("email");
    expect(out.downgraded).toContain("consent");
  });

  it("leaves the text alone when consent exists", () => {
    const text = SEQUENCES.flatMap((s) => s.steps).find((s) => s.channel === "text")!;
    expect(resolveChannel(text, true).channel).toBe("text");
    expect(resolveChannel(text, true).downgraded).toBeNull();
  });
});

describe("the queue", () => {
  const enrolled = (over = {}) => ({
    leadId: "l1", name: "Someone", band: "now" as const, daysIn: 0,
    stopped: null, phoneConsent: false, done: [], ...over,
  });

  it("owes the day-zero step immediately", () => {
    expect(dueFor(enrolled())?.step.day).toBe(0);
  });

  it("owes nothing once stopped", () => {
    /* Immediately, not after the current step. Software that keeps sending
       once somebody answered proves there was never a person on this end. */
    expect(dueFor(enrolled({ stopped: "replied" }))).toBeNull();
  });

  it("does not run ahead of the schedule", () => {
    const e = enrolled({ done: ["n1"] });
    expect(dueFor(e)).toBeNull();
    expect(nextFor(e)?.inDays).toBeGreaterThan(0);
  });

  it("reports how much goes out without the agent", () => {
    /* The leverage number. A cadence that needs him for every touch has not
       bought him anything. */
    const a = autonomy("later");
    expect(a.auto).toBe(a.total);
  });
});

describe("recovery can actually reach somebody", () => {
  it("the dormant sequence's touches are automatic", () => {
    /* They are for people who left no conversation to continue, so waiting for
       the agent to send them by hand means they are never sent. */
    for (const s of sequenceFor("nurture").steps) expect(s.auto).toBe(true);
  });

  it("the funnel length the recovery email quotes is read, not hard-coded", () => {
    /* "You answered 3 of 7" has to stay true when the funnel is edited. */
    const enabled = BUY_FUNNEL.questions.filter((q) => q.enabled).length;
    expect(enabled).toBeGreaterThan(0);
    expect(enabled).toBe(BUY_FUNNEL.questions.filter((q) => q.enabled).length);
  });
});

describe("what a customer actually reads", () => {
  it("every step has customer-facing copy, separate from its rationale", () => {
    /* `gives` is a note to whoever designs the cadence. The first version of
       the emails sent it — so somebody would have opened a message about their
       own house purchase and read "Recovery, not pursuit." Caught by rendering
       the templates and looking at them, which nothing else was doing. */
    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.body.length, `${seq.band}/${step.id} has no body copy`).toBeGreaterThan(20);
        expect(step.body).not.toBe(step.gives);
      }
    }
  });

  it("the copy does not read as an internal note", () => {
    /* Design rationale addresses the reader in the third person — "their
       answers", "them" — and copy addresses them directly. */
    const tell = /\b(their|them|recovery, not pursuit|rule \d)\b/i;
    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        expect(tell.test(step.body), `${seq.band}/${step.id} reads like a design note`).toBe(false);
      }
    }
  });
})
