import { describe, expect, it } from "vitest";
import {
  MOMENTS, momentsFor, actionable, mayAskPublicly, anniversariesPassed,
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

describe("nothing public before the private check", () => {
  /**
   * Walks every gated moment against every possible mood, rather than the one
   * or two a fixture happened to contain. `mood === null` is the case a
   * truthy check gets wrong, and it is also the most common one: nobody has
   * asked them yet.
   */
  const MOODS: Mood[] = ["good", "mixed", "bad", null];

  it("never reports a public ask as allowed unless they said it went well", () => {
    for (const mood of MOODS) {
      const l = life({ stage: "Closed", closedOn: "2020-01-01", readoutDelivered: true, planPublished: true, mood });
      for (const s of momentsFor(l, [], at("2026-09-21"))) {
        const allowed = mayAskPublicly(s, mood);
        if (s.moment.gated && mood !== "good") {
          expect(allowed, `${s.moment.id} with mood=${mood} must not be askable`).toBe(false);
        }
      }
    }
  });

  it("asks the private question rather than holding a client nobody has asked", () => {
    const l = life({ stage: "Closed", closedOn: "2026-01-01", mood: null });
    const s = find(l, "closing_day", [], at("2026-02-01"));
    expect(s.needsCheck).toBe(true);
    expect(s.state).toBe("due");
    expect(s.blockedBecause).toMatch(/before they answer/i);
  });

  it("holds, and says why, when the check came back short of good", () => {
    for (const mood of ["mixed", "bad"] as const) {
      const l = life({ stage: "Closed", closedOn: "2026-01-01", mood });
      const s = find(l, "closing_day", [], at("2026-02-01"));
      expect(s.state).toBe("held");
      expect(s.needsCheck).toBe(false);
      expect(s.blockedBecause).toBeTruthy();
    }
  });

  it("leaves ungated moments alone whatever the mood", () => {
    for (const mood of MOODS) {
      const s = find(life({ readoutDelivered: true, mood }), "value_delivered");
      expect(s.state).toBe("due");
      expect(mayAskPublicly(s, mood)).toBe(true);
    }
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

  it("does not let a recorded decision bypass the gate for a public ask", () => {
    /* Recording "due" by hand must not become a way round the private check. */
    const rec: RecordedMoment[] = [{ momentId: "closing_day", occurrence: 0, state: "due" }];
    const l = life({ stage: "Closed", closedOn: "2026-01-01", mood: "bad" });
    const s = find(l, "closing_day", rec, at("2026-02-01"));
    expect(mayAskPublicly(s, l.mood)).toBe(false);
  });
});

describe("the constants the rest of this depends on", () => {
  it("counts thirty days and half a year the way the moments are named", () => {
    expect(DAY_30).toBe(30);
    expect(MONTH_6).toBeGreaterThan(178);
    expect(MONTH_6).toBeLessThan(187);
  });
});
