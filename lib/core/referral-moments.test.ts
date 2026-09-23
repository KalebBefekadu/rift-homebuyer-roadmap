import { describe, expect, it } from "vitest";
import {
  MOMENTS, momentsFor, actionable, mayAsk, serviceCheck, anniversariesPassed,
  currentOccurrence, SILENT_MOMENTS, DAY_30, MONTH_6,
  type Lifecycle, type Mood, type MomentId, type MomentState, type RecordedMoment,
} from "./referral";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

const life = (over: Partial<Lifecycle> = {}): Lifecycle => ({
  stage: "Exploring",
  closedOn: null,
  readoutDelivered: false,
  planPublished: false,
  mood: null,
  ...over,
});

const find = (l: Lifecycle, id: MomentId, rec: RecordedMoment[] = [], now = at("2026-09-21")) =>
  momentsFor(l, rec, now).find((s) => s.moment.id === id)!;

describe("what the data can and cannot see", () => {
  it("waits for a readout before offering the tool to a friend", () => {
    expect(find(life(), "value_delivered").state).toBe("waiting");
    expect(find(life({ readoutDelivered: true }), "value_delivered").state).toBe("due");
  });

  it("waits for a published plan before asking them to share it", () => {
    expect(find(life(), "plan_published").state).toBe("waiting");
    expect(find(life({ planPublished: true }), "plan_published").state).toBe("due");
  });

  /**
   * The expensive guess this refuses to make. Inferring financing from the
   * stage having moved past Financing would congratulate somebody whose
   * pre-approval fell through, on the strongest ungated ask in the set.
   */
  it("never infers that financing was secured, at any stage", () => {
    for (const stage of ["Financing", "Ready to shop", "Searching", "Under contract", "Closing", "Closed"]) {
      const s = find(life({ stage, closedOn: "2026-01-01" }), "financing_secured");
      expect(s.state, `${stage} must not imply financing`).toBe("waiting");
      expect(s.blockedBecause).toMatch(/mark it when it has/i);
    }
  });

  it("takes a human's word for financing when one is recorded", () => {
    const rec: RecordedMoment[] = [{ momentId: "financing_secured", occurrence: 0, state: "acted" }];
    expect(find(life(), "financing_secured", rec).state).toBe("acted");
  });
});

describe("the dates after closing", () => {
  const closed = life({ stage: "Closed", closedOn: "2026-01-01", mood: "good" });

  it("holds the thirty-day check until thirty days have passed", () => {
    expect(find(closed, "day_30", [], at("2026-01-30")).state).toBe("waiting");
    expect(find(closed, "day_30", [], at("2026-01-31")).state).toBe("due");
  });

  it("holds the six-month ask until six months have passed", () => {
    expect(find(closed, "month_6", [], at("2026-06-30")).state).toBe("waiting");
    expect(find(closed, "month_6", [], at("2026-07-02")).state).toBe("due");
  });

  it("counts the days rather than the number on the calendar", () => {
    /* A 2 January closing must not have its "first anniversary" on 1 January
       eleven months later, which is what comparing year numbers produces. */
    expect(anniversariesPassed("2026-01-02", at("2027-01-01"))).toBe(0);
    expect(anniversariesPassed("2026-01-02", at("2027-01-03"))).toBe(1);
  });

  it("does not fire the anniversary a day early every fourth year", () => {
    /* 2028 is a leap year: 365-day arithmetic would call 31 December 2028 the
       third anniversary of a 1 January 2026 closing. */
    expect(anniversariesPassed("2026-01-01", at("2028-12-31"))).toBe(2);
    expect(anniversariesPassed("2026-01-01", at("2029-01-02"))).toBe(3);
  });

  /**
   * The failure this exists to prevent: a cadence that runs once and stops,
   * which from every screen looks exactly like one that is running.
   */
  it("reopens the anniversary every year rather than staying sent forever", () => {
    const sentYearOne: RecordedMoment[] = [{ momentId: "anniversary", occurrence: 1, state: "sent" }];
    expect(find(closed, "anniversary", sentYearOne, at("2027-02-01")).state).toBe("sent");

    const yearTwo = find(closed, "anniversary", sentYearOne, at("2028-02-01"));
    expect(yearTwo.occurrence).toBe(2);
    expect(yearTwo.state).toBe("due");
  });

  it("keys non-recurring moments to occurrence zero", () => {
    for (const m of MOMENTS) {
      if (m.id === "anniversary") continue;
      expect(currentOccurrence(m.id, closed, at("2030-01-01"))).toBe(0);
    }
  });
});

describe("a review invitation is the same for everyone (decision D12)", () => {
  /**
   * Asking only the people who said they were happy is review gating, which
   * Google forbids. So the moments must come out identical whatever the
   * private check said, including unanswered: walked across every mood and
   * every point in a relationship rather than the one a fixture contained.
   */
  const MOODS: Mood[] = ["good", "mixed", "bad", null];
  const POINTS: [Partial<Lifecycle>, string][] = [
    [{ readoutDelivered: true }, "2026-02-01"],
    [{ stage: "Closed", closedOn: "2026-01-01", readoutDelivered: true, planPublished: true }, "2026-01-01"],
    [{ stage: "Closed", closedOn: "2026-01-01", readoutDelivered: true, planPublished: true }, "2026-08-01"],
    [{ stage: "Closed", closedOn: "2020-01-01", readoutDelivered: true, planPublished: true }, "2026-09-21"],
  ];

  it("derives every moment identically whatever they said about how it went", () => {
    for (const [point, day] of POINTS) {
      const baseline = momentsFor(life({ ...point, mood: null }), [], at(day));
      for (const mood of MOODS) {
        expect(momentsFor(life({ ...point, mood }), [], at(day)), `mood=${mood} at ${day}`).toEqual(baseline);
      }
    }
  });

  it("offers the closing-day review to an unhappy client like anyone else", () => {
    for (const mood of MOODS) {
      const s = find(life({ stage: "Closed", closedOn: "2026-01-01", mood }), "closing_day", [], at("2026-02-01"));
      expect(s.moment.review).toBe(true);
      expect(s.state).toBe("due");
      expect(mayAsk(s), `mood=${mood}`).toBe(true);
    }
  });

  it("uses the private check only to raise a follow-up", () => {
    expect(serviceCheck("mixed").followUp).toBe(true);
    expect(serviceCheck("bad").followUp).toBe(true);
    expect(serviceCheck("good").followUp).toBe(false);
    expect(serviceCheck(null).followUp).toBe(false);
    for (const mood of MOODS) {
      const c = serviceCheck(mood);
      expect(c.label.trim()).not.toBe("");
      expect(c.note.trim()).not.toBe("");
      /* The agent is never told to hold a review back because of the answer. */
      expect(c.note).not.toMatch(/no (public )?ask|not (be )?asked|hold (it|them) back|do not ask/i);
    }
  });

  it("marks exactly the moments whose ask includes a public review", () => {
    expect(MOMENTS.filter((m) => m.review).map((m) => m.id).sort()).toEqual(["closing_day", "month_6"]);
    for (const m of MOMENTS) expect(m.review, m.id).toBe(/review/i.test(m.ask));
  });
});

describe("the queue", () => {
  it("never lists the moment whose ask is to say nothing", () => {
    const l = life({ stage: "Under contract", readoutDelivered: true, planPublished: true });
    const ids = actionable(momentsFor(l, [], at("2026-09-21"))).map((s) => s.moment.id);
    for (const silent of SILENT_MOMENTS) expect(ids).not.toContain(silent);
  });

  it("still shows the silent moment so the restraint reads as deliberate", () => {
    const l = life({ stage: "Under contract" });
    expect(find(l, "under_contract").state).toBe("due");
  });

  it("puts a question nobody has asked above a decision already taken", () => {
    const l = life({ stage: "Closed", closedOn: "2020-01-01", readoutDelivered: true, planPublished: true, mood: "mixed" });
    const q = actionable(momentsFor(l, [], at("2026-09-21")));
    const firstHeld = q.findIndex((s) => s.state === "held");
    const lastDue = q.map((s) => s.state).lastIndexOf("due");
    if (firstHeld >= 0 && lastDue >= 0) expect(lastDue).toBeLessThan(firstHeld);
  });

  it("orders by strength within a state", () => {
    const l = life({ stage: "Closed", closedOn: "2020-01-01", readoutDelivered: true, planPublished: true, mood: "good" });
    const due = actionable(momentsFor(l, [], at("2026-09-21"))).filter((s) => s.state === "due");
    for (let i = 1; i < due.length; i++) {
      expect(due[i - 1]!.moment.strength).toBeGreaterThanOrEqual(due[i]!.moment.strength);
    }
  });

  it("carries nothing at all for a relationship that has just started", () => {
    expect(actionable(momentsFor(life(), [], at("2026-09-21")))).toEqual([]);
  });
});

describe("a recorded decision is the answer", () => {
  const states: MomentState[] = ["sent", "acted", "declined", "held", "waiting", "due"];

  it("does not quietly reopen anything a human has decided", () => {
    for (const state of states) {
      const rec: RecordedMoment[] = [{ momentId: "closing_day", occurrence: 0, state }];
      const l = life({ stage: "Closed", closedOn: "2026-01-01", mood: "good" });
      expect(find(l, "closing_day", rec, at("2026-02-01")).state).toBe(state);
    }
  });

  it("lets only a due moment be asked, whatever was recorded around it", () => {
    for (const state of ["sent", "acted", "declined", "held"] as const) {
      const rec: RecordedMoment[] = [{ momentId: "closing_day", occurrence: 0, state }];
      const s = find(life({ stage: "Closed", closedOn: "2026-01-01", mood: "bad" }), "closing_day", rec, at("2026-02-01"));
      expect(mayAsk(s), state).toBe(false);
    }
  });
});

describe("the constants the rest of this depends on", () => {
  it("counts thirty days and half a year the way the moments are named", () => {
    expect(DAY_30).toBe(30);
    expect(MONTH_6).toBeGreaterThan(178);
    expect(MONTH_6).toBeLessThan(187);
  });
});
