import { describe, it, expect } from "vitest";
import {
  bucketFor, groupPlan, summarise, headline, ownerLabel, daysUntil,
  BUCKET_ORDER, BUCKET_LABEL, type PlanItem,
} from "./plan";

/**
 * The client's plan.
 *
 * This is the first surface in the product that a client reads about
 * themselves, so two rules decide whether it is worth having. Every item has
 * an owner, because a plan where nobody owes anything is a list of hopes. And
 * nothing is late until it is, because a page that marks things overdue by
 * guessing is a page they stop opening.
 */

const TODAY = new Date("2026-09-20T12:00:00Z");

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  id: "i1", title: "Send the agreement", owner: "agent", ownerName: null,
  dueOn: null, doneAt: null, sort: 0, ...over,
});

describe("when a step belongs", () => {
  it("puts a step with no date in 'after that' rather than calling it late", () => {
    /* Otherwise the agent is punished for not inventing a deadline, which is
       the behaviour worth encouraging. */
    expect(bucketFor(item({ dueOn: null }), TODAY)).toBe("someday");
  });

  it("reads a date that has passed as overdue, and today as this week", () => {
    expect(bucketFor(item({ dueOn: "2026-09-19" }), TODAY)).toBe("overdue");
    expect(bucketFor(item({ dueOn: "2026-09-20" }), TODAY)).toBe("now");
  });

  it("does not call something due later today overdue", () => {
    /* The comparison is whole days in UTC. Comparing timestamps would make an
       item due today read as late from lunchtime onwards. */
    expect(daysUntil("2026-09-20", new Date("2026-09-20T23:59:00Z"))).toBe(0);
  });

  it("keeps a finished step out of every bucket but done, whatever its date", () => {
    /* A completed step that still shows as overdue is the fastest way to make
       somebody stop believing the page. */
    expect(bucketFor(item({ dueOn: "2020-01-01", doneAt: "2026-01-01" }), TODAY)).toBe("done");
  });

  it("walks the windows in order", () => {
    const at = (d: string) => bucketFor(item({ dueOn: d }), TODAY);
    expect(at("2026-09-26")).toBe("now");
    expect(at("2026-09-30")).toBe("soon");
    expect(at("2026-10-15")).toBe("later");
    expect(at("2026-12-01")).toBe("someday");
  });
});

describe("how the plan is laid out", () => {
  it("drops empty buckets instead of rendering headings with nothing under them", () => {
    /* Five empty headings is what a product looks like when it has not
       started, and this page is shown to a client. */
    const sections = groupPlan([item({ dueOn: "2026-09-21" })], TODAY);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.bucket).toBe("now");
  });

  it("puts overdue first, because that is the point of saying it", () => {
    const sections = groupPlan([
      item({ id: "a", doneAt: "2026-09-01" }),
      item({ id: "b", dueOn: "2026-09-01" }),
      item({ id: "c", dueOn: "2026-09-22" }),
    ], TODAY);
    expect(sections.map((s) => s.bucket)).toEqual(["overdue", "now", "done"]);
  });

  it("shows the most recently finished step first", () => {
    /* The reverse of every other bucket, deliberately. What was achieved last
       is the one worth seeing. */
    const sections = groupPlan([
      item({ id: "old", doneAt: "2026-01-01T00:00:00Z" }),
      item({ id: "new", doneAt: "2026-09-01T00:00:00Z" }),
    ], TODAY);
    expect(sections[0]!.items.map((i) => i.id)).toEqual(["new", "old"]);
  });

  it("keeps the agent's order inside a bucket", () => {
    /* He knows what comes first. A list re-sorted by date would put the thing
       he wants read last at the top. */
    const sections = groupPlan([
      item({ id: "second", sort: 2, dueOn: "2026-09-21" }),
      item({ id: "first", sort: 1, dueOn: "2026-09-25" }),
    ], TODAY);
    expect(sections[0]!.items.map((i) => i.id)).toEqual(["first", "second"]);
  });

  it("has a label for every bucket it can produce", () => {
    for (const b of BUCKET_ORDER) {
      expect(BUCKET_LABEL[b], `${b} has no label`).toBeTruthy();
    }
  });
});

describe("what the top line says", () => {
  it("counts only what is waiting on them", () => {
    /* The only number they can act on. "You are 40% complete" is a number
       about the plan; this is a number about them. */
    const s = summarise([
      item({ id: "a", owner: "client" }),
      item({ id: "b", owner: "agent" }),
      item({ id: "c", owner: "other", ownerName: "The county" }),
    ], TODAY);
    expect(s.onYou).toBe(1);
    expect(headline(s)).toBe("One thing is waiting on you.");
  });

  it("never tells somebody that zero things are waiting on them", () => {
    /* Which is how a page announces that it was generated rather than
       written. This is the branch the first draft got wrong. */
    const s = summarise([item({ owner: "agent", dueOn: "2026-01-01" })], TODAY);
    expect(s.onYou).toBe(0);
    expect(s.overdue).toBe(1);
    expect(headline(s)).not.toMatch(/\b0 things\b/);
    expect(headline(s)).toMatch(/Nothing is waiting on you/);
  });

  it("still names an overdue step the agent owes", () => {
    /* The client is entitled to know the hold-up is at this end. A page that
       only reports the client's own failings is a page with an opinion. */
    const s = summarise([item({ owner: "agent", dueOn: "2026-01-01" })], TODAY);
    expect(headline(s)).toMatch(/past its date/);
  });

  it("says so plainly when everything is finished", () => {
    const s = summarise([item({ doneAt: "2026-09-01" })], TODAY);
    expect(headline(s)).toBe("Everything on your plan is done.");
  });

  it("does not pretend an empty plan is a finished one", () => {
    expect(headline(summarise([], TODAY))).toBe("Your plan is being written.");
  });

  it("counts nothing that is already done as waiting", () => {
    const s = summarise([item({ owner: "client", doneAt: "2026-09-01" })], TODAY);
    expect(s.onYou).toBe(0);
  });
});

describe("who owes it, and who is reading", () => {
  const names = { agent: "Kaleb", client: "Sara" };

  it("says 'You' to the client for their own step, and names them to the agent", () => {
    /* The bug this replaced: ownerLabel knew only the agent's name, so a step
       owed by the client rendered as "You" on BOTH pages: correct on theirs,
       and on his a line telling him he owes something he does not. Same family
       as the readout that printed "You'm a U.S. citizen living abroad": a
       pronoun produced without knowing who is being addressed. */
    const step = { owner: "client" as const, ownerName: null };
    expect(ownerLabel(step, names, "client")).toBe("You");
    expect(ownerLabel(step, names, "agent")).toBe("Sara");
  });

  it("names the agent to the client, and says 'You' to the agent", () => {
    const step = { owner: "agent" as const, ownerName: null };
    expect(ownerLabel(step, names, "client")).toBe("Kaleb");
    expect(ownerLabel(step, names, "agent")).toBe("You");
  });

  it("never says 'You' to somebody who does not owe it", () => {
    /* Stated as the property rather than the four cases, because the four
       cases are what got it wrong. */
    for (const owner of ["client", "agent", "other"] as const) {
      for (const reader of ["client", "agent"] as const) {
        const label = ownerLabel({ owner, ownerName: "Brookhaven" }, names, reader);
        if (label === "You") {
          expect(owner, `"You" shown to the ${reader} for a step owned by the ${owner}`)
            .toBe(reader);
        }
      }
    }
  });

  it("falls back to 'Them' when the client has no name on record", () => {
    /* A lead can arrive with an email and no name. A blank where a person goes
       is worse than a pronoun. */
    expect(ownerLabel({ owner: "client", ownerName: null }, { agent: "Kaleb", client: null }, "agent"))
      .toBe("Them");
    expect(ownerLabel({ owner: "client", ownerName: null }, { agent: "Kaleb", client: "  " }, "agent"))
      .toBe("Them");
  });

  it("names a third party to both, because waiting on a county is not waiting on a lender", () => {
    for (const reader of ["client", "agent"] as const) {
      expect(ownerLabel({ owner: "other", ownerName: "Brookhaven" }, names, reader)).toBe("Brookhaven");
    }
  });

  it("never renders an empty owner", () => {
    /* The database refuses this combination; if one ever arrives the page must
       still say something rather than leaving a blank where a name goes. */
    expect(ownerLabel({ owner: "other", ownerName: "   " }, names, "client")).toBe("Someone else");
    expect(ownerLabel({ owner: "other", ownerName: null }, names, "agent")).toBe("Someone else");
  });
});
