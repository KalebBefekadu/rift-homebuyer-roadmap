import { describe, it, expect } from "vitest";
import { SEQUENCES, STOPS, sequenceFor, resolveChannel, dueFor, nextFor, autonomy, blockedStop, listsPrograms, programsCopy, programLines, touchCopy, skipReason, SAVE_EMAIL_STEP, type Audience, type TouchKind } from "./nurture";
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

/**
 * The copy somebody who saved a plan reads (Blueprint v5 §5.5). Every step
 * whose own words would be untrue for them carries a plan variant, and the
 * variant follows the same rules as the rest of the copy.
 */
describe("the copy for a saved plan", () => {
  it("replaces every opening that claims a readout or an unfinished answer", () => {
    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        if (!step.auto) continue;
        const read = touchCopy(step, "plan");
        const where = `${seq.band}/${step.id}`;
        expect(read.says, `${where} tells a plan saver about a readout`).not.toMatch(/\breadout\b/i);
        expect(read.body, `${where} tells a plan saver about a readout`).not.toMatch(/\breadout\b/i);
        expect(read.says, `${where} tells a plan saver they did not finish`).not.toMatch(/most of the way|where you left/i);
        expect(read.body, `${where} tells a plan saver they did not finish`).not.toMatch(/where you left them/i);
      }
    }
  });

  it("is written to the reader, like every other line", () => {
    for (const seq of SEQUENCES) {
      for (const step of seq.steps) {
        if (!step.plan) continue;
        expect(step.plan.body.length).toBeGreaterThan(20);
        expect(step.plan.body).not.toMatch(/\btheir\b|\bthe person\b|recovery, not pursuit|\bcadence\b|\bsequence\b/i);
      }
    }
  });

  it("leaves a readout's and a resume's copy exactly as defined", () => {
    const n1 = SEQUENCES[0].steps[0];
    expect(touchCopy(n1, "readout")).toEqual({ says: n1.says, body: n1.body });
    expect(touchCopy(n1, "resume")).toEqual({ says: n1.says, body: n1.body });
    expect(touchCopy(n1, "plan")).toEqual(n1.plan);
  });

  it("uses a step's own copy when it is already true for a plan", () => {
    const d2 = SEQUENCES.find((s) => s.band === "nurture")!.steps.find((s) => s.id === "d2")!;
    expect(touchCopy(d2, "plan")).toEqual({ says: d2.says, body: d2.body });
  });
});

describe("the steps a save email covers", () => {
  it("are the emails in the first day that only carry the plan's link, and no others", () => {
    /* The save email carries the link the moment they save. A day-zero touch
       is the same link again within the day, and so is the dormant day-one
       touch in its plan words ("your plan is saved"); nothing later is. */
    const covered = SEQUENCES.flatMap((s) => s.steps).filter((x) => x.coveredBySaveEmail).map((x) => x.id);
    expect(covered).toEqual(["n1", "s1", "l1", "d1"]);
    for (const s of SEQUENCES.flatMap((q) => q.steps)) {
      if (s.coveredBySaveEmail) {
        expect(s.day, s.id).toBeLessThanOrEqual(1);
        expect(s.channel, s.id).toBe("email");
        expect(s.plan, `${s.id} needs plan copy: the covered touch is the plan's`).toBeDefined();
      }
    }
  });

  it("has a recorded step id no sequence uses, so it can never stand in for a step", () => {
    expect(SAVE_EMAIL_STEP).toBe("save");
    expect(SEQUENCES.flatMap((s) => s.steps).some((x) => x.id === SAVE_EMAIL_STEP)).toBe(false);
  });
});

/**
 * Who a step is written to.
 *
 * Sequences are chosen by band, not by side, so a seller was sent "What
 * actually moves your closing date" and "The savings target that gets you
 * there fastest". Nothing failed: the queue was well formed and the words
 * were about somebody else's purchase. Every step now says something true to
 * a seller and to a buyer abroad, or is skipped for them with a recorded
 * reason.
 *
 * The guard below is on vocabulary rather than on a list of steps, so a step
 * added later cannot be buyer wording for everybody without this failing.
 */
describe("copy for who it is sent to", () => {
  const all = SEQUENCES.flatMap((s) => s.steps.map((step) => ({ where: `${s.band}/${step.id}`, step })));
  const KINDS: TouchKind[] = ["readout", "plan", "resume"];

  /* What only a buyer has: a purchase date, a savings target, a monthly
     payment, a mortgage rate, programs that help somebody buy. */
  const BUYER_ONLY = /closing date|timeline|savings|monthly|mortgage|down payment|first-time|\bprograms?\b|assistance|\brates?\b|\bgap\b|cash to close/i;
  /* What a buyer from abroad cannot use: the Georgia programs need the buyer
     to live in the home, and most ask for a Social Security number. */
  const NOT_ABROAD = /closing date|savings|first-time|\bprograms?\b|assistance|Georgia Dream|\bgap\b/i;

  const check = (aud: Audience, no: RegExp) => {
    for (const { where, step } of all) {
      if (skipReason(step, aud)) continue;
      for (const kind of KINDS) {
        const c = touchCopy(step, kind, aud);
        expect(`${c.says} ${c.body}`, `${where} (${kind}) reads as buyer wording to a ${aud}`).not.toMatch(no);
      }
    }
  };

  it("says nothing only a buyer has to a seller", () => check("sell", BUYER_ONLY));
  it("says nothing a buyer from abroad cannot use to them", () => check("abroad", NOT_ABROAD));

  it("leaves a buyer's copy exactly as it was defined", () => {
    for (const { step } of all) {
      expect(touchCopy(step, "readout", "buy")).toEqual({ says: step.says, body: step.body });
      expect(skipReason(step, "buy")).toBeNull();
    }
  });

  it("talks to a seller about what a seller got: what they keep, what it costs, what to fix", () => {
    const s2 = all.find((x) => x.step.id === "s2")!.step;
    expect(touchCopy(s2, "plan", "sell").says).toMatch(/keep/i);
    expect(touchCopy(s2, "plan", "sell").body).toMatch(/payoff.*commission.*costs of selling/i);
    const n1 = SEQUENCES[0].steps[0];
    expect(touchCopy(n1, "readout", "sell").says).toMatch(/what selling would leave you/i);
    const l4 = all.find((x) => x.step.id === "l4")!.step;
    expect(touchCopy(l4, "plan", "sell").body).toMatch(/what selling would leave you/i);
  });

  it("is written to the reader, like every other line", () => {
    for (const { where, step } of all) {
      for (const aud of ["sell", "abroad"] as const) {
        for (const kind of KINDS) {
          const c = touchCopy(step, kind, aud);
          expect(c.body, `${where} ${aud}`).not.toMatch(/\btheir\b|\bthe person\b|recovery, not pursuit|\bcadence\b|\bsequence\b/i);
          expect(c.body.length, `${where} ${aud}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("quotes no figure in any variant: the plan's figures are not ours to restate", () => {
    for (const { where, step } of all) {
      for (const aud of ["sell", "abroad"] as const) {
        for (const kind of KINDS) {
          const c = touchCopy(step, kind, aud);
          expect(`${c.says} ${c.body}`, `${where} ${aud}`).not.toMatch(/[$]\s?\d|\d\s?%/);
        }
      }
    }
  });

  it("skips what has no honest version for them, and says why in the reason", () => {
    const by = new Map(all.map((x) => [x.step.id, x.step]));
    /* The programs email, the rates text and the savings target are a buyer's. */
    for (const id of ["n4", "s3", "l2"]) {
      expect(skipReason(by.get(id)!, "sell"), `${id} for a seller`).toMatch(/^Not sent: .*(buy|buyer|mortgage)/i);
    }
    for (const id of ["n4", "s4", "l2"]) {
      expect(skipReason(by.get(id)!, "abroad"), `${id} for a buyer abroad`).toMatch(/^Not sent: /);
    }
    expect(skipReason(by.get("n4")!, "abroad")).toMatch(/live in the home/);
  });

  it("never skips the opening or the closing of a sequence", () => {
    /* A person always hears the first thing and the last thing, whatever
       they came for. Otherwise a seller in a short sequence could be
       enrolled and never contacted. */
    for (const seq of SEQUENCES) {
      for (const aud of ["sell", "abroad"] as const) {
        expect(skipReason(seq.steps[0]!, aud), `${seq.band} first`).toBeNull();
        expect(skipReason(seq.steps.at(-1)!, aud), `${seq.band} last`).toBeNull();
      }
    }
  });
});
