import { describe, it, expect } from "vitest";
import { SEQUENCES, STOPS, sequenceFor, resolveChannel, dueFor, nextFor, autonomy, blockedStop, listsPrograms, programsCopy, programLines } from "./nurture";
import { PROGRAMS } from "./registry";
import { BUY_FUNNEL } from "./funnel";

/**
 * The cadence's own rules.
 *
 * The one these were written for: the dormant sequence exists for people who
 * started and stopped, so they have no readout, and the ordinary touch leads
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
       the emails sent it, so somebody would have opened a message about their
       own house purchase and read "Recovery, not pursuit." Caught by rendering
       the templates and looking at them, which nothing else was doing. */
    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.body.length, `${seq.band}/${step.id} has no body copy`).toBeGreaterThan(20);
        expect(step.body).not.toBe(step.gives);
      }
    }
  });

  it("the copy addresses the reader, not a designer", () => {
    /* Rationale refers to the reader in the third person: "their answers",
       "the person": and carries design vocabulary. Copy speaks to them.
       
       Two earlier versions of this test were wrong rather than the copy. One
       flagged the bare word "them", which fails on "exactly where you left
       them". One required every line to contain "you", which fails on "there
       are two windows this week": a perfectly direct sentence.
       
       Both were prescribing style rather than detecting the defect. A test
       that rejects correct work is worse than none: the fix people reach for
       is to weaken the writing until the test passes. What is left detects the
       actual failure: prose about the reader instead of to them, and design
       vocabulary that has no business in an inbox. */
    const thirdPerson = /\btheir\b|\bthe person\b|\bthe reader\b/i;
    const jargon = /recovery, not pursuit|\brule \d|\bcadence\b|\bsequence\b/i;

    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        const where = `${seq.band}/${step.id}`;
        expect(thirdPerson.test(step.body), `${where} talks about the reader instead of to them`).toBe(false);
        expect(jargon.test(step.body), `${where} contains design vocabulary`).toBe(false);
      }
    }
  });
})

describe("an address on the provider's block list (AT37)", () => {
  it("reads every kind of unsubscribe, and a spam report, as an opt-out", () => {
    for (const c of ["unsubscribedViaEmail", "unsubscribedViaApi", "unsubscribedViaMA", "contactFlaggedAsSpam"]) {
      expect(blockedStop(c), c).toBe("unsubscribed");
    }
  });

  it("reads a hard bounce as a dead address, not as disinterest", () => {
    expect(blockedStop("hardBounce")).toBe("bounced");
  });

  it("does not claim an opt-out for a block the person did not make", () => {
    expect(blockedStop("adminBlocked")).toBeNull();
    expect(blockedStop("somethingNew")).toBeNull();
  });
});

describe("the step that lists their programs", () => {
  it("is the n4 email, and nothing else claims a count it cannot know", () => {
    expect(listsPrograms("n4")).toBe(true);
    expect(listsPrograms("n3")).toBe(false);
    const n4 = SEQUENCES.flatMap((q) => q.steps).find((x) => x.id === "n4")!;
    /* The definition is what Studio shows. It used to say "the two programs"
       for everybody; a number there would be a guess about somebody. */
    expect(`${n4.says} ${n4.body}`).not.toMatch(/\b(one|two|three|four|\d+) (Georgia )?programs?\b/i);
  });

  it("does not write anything for somebody who matched none", () => {
    expect(programsCopy([])).toBeNull();
  });

  it("speaks of one program in the singular", () => {
    const c = programsCopy(["Georgia Dream Homeownership Program"])!;
    expect(c.says).toBe("The program you matched, and what it would need from you");
    expect(c.body).toMatch(/^One Georgia program looks like it fits/);
    expect(`${c.says} ${c.body}`).not.toMatch(/programs|each/);
  });

  it("counts several in words", () => {
    expect(programsCopy(["A", "B"])!.says).toBe("The two programs you matched, and what each would need from you");
    const three = programsCopy(["A", "B", "C"])!;
    expect(three.says).toMatch(/^The three programs/);
    expect(three.body).toMatch(/^Three Georgia programs look like they fit/);
    expect(programsCopy(Array.from({ length: 12 }, (_, i) => `P${i}`))!.says).toMatch(/^The 12 programs/);
  });

  it("lists each programme with what it asks, and says when funding is not simply open", () => {
    const open = PROGRAMS.find((p) => p.funding === "open")!;
    const [line] = programLines([open, { ...open, funding: "closed" }]);
    expect(line).toEqual({ name: open.name, state: null, needs: open.conditions });
    expect(programLines([{ ...open, funding: "closed" }])[0]!.state).toBe("Funding closed");
  });
});
