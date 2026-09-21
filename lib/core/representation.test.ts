import { describe, it, expect } from "vitest";
import {
  standingOf, mayAdvance, isCovered, daysTo,
  STATUSES, STATUS_RULES, GATE, JOURNEY, EXPIRY_WARNING_DAYS,
  type Representation, type Status,
} from "./representation";

/**
 * The gate between a lead and a client.
 *
 * docs/benchmark.md scores representation capture at 1 in production against 3
 * in the prototype, with the note that there is no column — "which is why
 * canPublish has to assume the agreement exists rather than check it". That
 * assumption was a literal `hasAgreement: true` inside the one function whose
 * whole job is refusing to publish when something is not true.
 *
 * The case that matters most is the one in the middle: stored as signed, with
 * an expiry date in the past. Read naively that is coverage, and reading it as
 * coverage is how somebody shows a house on a lapsed agreement.
 */

const TODAY = new Date("2026-09-21T12:00:00Z");
const day = (n: number) => {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const rep = (p: Partial<Representation> = {}): Representation => ({
  status: "none", signedOn: null, expiresOn: null, ...p,
});

describe("the vocabulary", () => {
  it("gives every status a rule", () => {
    for (const s of STATUSES) {
      expect(STATUS_RULES[s], s).toBeTruthy();
      expect(STATUS_RULES[s].status).toBe(s);
      expect(STATUS_RULES[s].meaning.length).toBeGreaterThan(20);
    }
  });

  it("treats exactly one status as coverage", () => {
    const covered = STATUSES.filter(isCovered);
    expect(covered).toEqual(["signed"]);
  });
});

describe("standingOf", () => {
  it("reads an unexpired signed agreement as coverage", () => {
    const s = standingOf(rep({ status: "signed", signedOn: day(-30), expiresOn: day(60) }), TODAY);
    expect(s.covered).toBe(true);
    expect(s.effective).toBe("signed");
    expect(s.daysLeft).toBe(60);
  });

  it("reads a signed agreement whose date has passed as expired", () => {
    /* THE ONE THAT MATTERS. Stored as signed; not in force. An agent reading
       "signed" off a screen and showing a house is the failure. */
    const s = standingOf(rep({ status: "signed", signedOn: day(-400), expiresOn: day(-5) }), TODAY);
    expect(s.covered).toBe(false);
    expect(s.effective).toBe("expired");
    expect(s.note).toMatch(/expired 5 days ago/);
    expect(s.note).toMatch(/not in force/);
  });

  it("does not expire on the day it runs out", () => {
    /* An agreement valid "until the 21st" is valid on the 21st. Off-by-one
       here is somebody uncovered for a day they believed they were covered. */
    const s = standingOf(rep({ status: "signed", expiresOn: day(0) }), TODAY);
    expect(s.covered).toBe(true);
    expect(s.note).toMatch(/runs out today/);
  });

  it("treats a signed agreement with no end date as in force", () => {
    const s = standingOf(rep({ status: "signed", signedOn: day(-10) }), TODAY);
    expect(s.covered).toBe(true);
    expect(s.daysLeft).toBeNull();
    expect(s.lapsingSoon).toBe(false);
    expect(s.note).toMatch(/no end date/);
  });

  it("raises a lapse before it happens, not after", () => {
    const soon = standingOf(rep({ status: "signed", expiresOn: day(EXPIRY_WARNING_DAYS) }), TODAY);
    expect(soon.lapsingSoon).toBe(true);
    const later = standingOf(rep({ status: "signed", expiresOn: day(EXPIRY_WARNING_DAYS + 1) }), TODAY);
    expect(later.lapsingSoon).toBe(false);
  });

  it("does not call an already-expired agreement lapsing soon", () => {
    /* "Expires in -4 days" is the shape of bug this is here to prevent. */
    const s = standingOf(rep({ status: "signed", expiresOn: day(-4) }), TODAY);
    expect(s.lapsingSoon).toBe(false);
  });

  it("leaves every other status alone whatever the dates say", () => {
    for (const status of ["none", "prepared", "sent", "declined", "expired"] as Status[]) {
      const s = standingOf(rep({ status, expiresOn: day(90) }), TODAY);
      expect(s.effective, status).toBe(status);
      expect(s.covered, status).toBe(false);
    }
  });
});

describe("mayAdvance", () => {
  const signed = rep({ status: "signed", signedOn: day(-10), expiresOn: day(90) });

  it("lets a buyer reach the gate without an agreement", () => {
    for (const stage of ["Exploring", "Building readiness", "Financing", "Ready to shop"]) {
      expect(mayAdvance("buy", stage, rep(), TODAY).allowed, stage).toBe(true);
    }
  });

  it("stops a buyer going past it", () => {
    for (const stage of ["Searching", "Reviewing offers", "Under contract", "Closing"]) {
      const check = mayAdvance("buy", stage, rep(), TODAY);
      expect(check.allowed, stage).toBe(false);
      expect(check.because, stage).toMatch(/Ready to shop/);
    }
  });

  it("stops a seller going past their own gate, which is a different one", () => {
    expect(mayAdvance("sell", "Preparing the property", rep(), TODAY).allowed).toBe(true);
    const check = mayAdvance("sell", "Reviewing offers", rep(), TODAY);
    expect(check.allowed).toBe(false);
    expect(check.because).toMatch(/Preparing the property/);
  });

  it("opens the gate on a signed agreement", () => {
    for (const stage of JOURNEY.buy) {
      expect(mayAdvance("buy", stage, signed, TODAY).allowed, stage).toBe(true);
    }
  });

  it("closes again when the agreement lapses", () => {
    const lapsed = rep({ status: "signed", signedOn: day(-400), expiresOn: day(-1) });
    const check = mayAdvance("buy", "Searching", lapsed, TODAY);
    expect(check.allowed).toBe(false);
    expect(check.because).toMatch(/expired/);
  });

  it("explains rather than announcing", () => {
    /* product.md: "Rift blocks the advance and explains why rather than
       silently allowing it." A refusal with no reason is a bug report. */
    for (const status of ["none", "prepared", "sent", "declined"] as Status[]) {
      const check = mayAdvance("buy", "Searching", rep({ status }), TODAY);
      expect(check.because, status).toBeTruthy();
      expect(check.because!.length, status).toBeGreaterThan(40);
    }
  });

  it("says something different for each reason it refuses", () => {
    const reasons = (["none", "prepared", "sent", "declined"] as Status[])
      .map((status) => mayAdvance("buy", "Searching", rep({ status }), TODAY).because);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("always allows the terminal stages", () => {
    /* A relationship that ended without an agreement still ended. Refusing to
       let an agent record "Lost" until paperwork exists makes the record a
       description of policy rather than of what happened. */
    for (const side of ["buy", "sell"] as const) {
      for (const stage of ["Closed", "Lost"]) {
        expect(mayAdvance(side, stage, rep(), TODAY).allowed, `${side} ${stage}`).toBe(true);
      }
    }
  });

  it("does not judge a stage the side never enters", () => {
    /* A buyer in "Preparing the property" is a data problem, not a compliance
       one, and this gate inventing an opinion about it would block a stage
       change for the wrong reason. */
    expect(mayAdvance("buy", "Preparing the property", rep(), TODAY).allowed).toBe(true);
    expect(mayAdvance("sell", "Financing", rep(), TODAY).allowed).toBe(true);
    expect(mayAdvance("buy", "Something nobody defined", rep(), TODAY).allowed).toBe(true);
  });

  it("puts each side's gate inside its own journey", () => {
    for (const side of ["buy", "sell"] as const) {
      expect(JOURNEY[side], side).toContain(GATE[side]);
    }
  });
});

describe("daysTo", () => {
  it("counts whole days either side of today", () => {
    expect(daysTo(day(0), TODAY)).toBe(0);
    expect(daysTo(day(1), TODAY)).toBe(1);
    expect(daysTo(day(-1), TODAY)).toBe(-1);
  });

  it("is not moved by the time of day", () => {
    /* An agreement does not expire at noon. */
    for (const h of ["00:00:01", "12:00:00", "23:59:59"]) {
      expect(daysTo(day(3), new Date(`2026-09-21T${h}Z`)), h).toBe(3);
    }
  });
});
