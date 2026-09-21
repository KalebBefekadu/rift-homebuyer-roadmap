import { describe, it, expect } from "vitest";
import {
  nextForClient,
  notOnYou,
  approaching,
  whenPhrase,
  RECENT_DAYS,
  type PlanItem,
} from "./plan";

/**
 * The three questions the client's page could not answer.
 *
 * docs/benchmark.md scores criterion 3.1 at 2 in production against 4 in the
 * prototype and calls it "the largest single parity gap in the product".
 * `/plan/<token>` told somebody where they were and what was next; it did not
 * tell them what their agent was doing, what was approaching, or where to ask.
 *
 * What is under test here is mostly restraint. Every one of these functions
 * could produce a confident-looking answer out of nothing, and a page that
 * tells a client their agent is busy when the record knows of no such thing is
 * worse than a page that says nothing at all.
 */

const TODAY = new Date("2026-09-21T12:00:00Z");
const day = (n: number) => {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let seq = 0;
const item = (p: Partial<PlanItem> = {}): PlanItem => ({
  id: `i${seq++}`,
  title: "Something",
  owner: "client",
  ownerName: null,
  dueOn: null,
  doneAt: null,
  sort: 0,
  ...p,
});

describe("nextForClient", () => {
  it("says nothing when nothing is owed by them", () => {
    /* The common state, and a page that manufactures a task to fill the space
       is a page that teaches people to ignore it. */
    expect(nextForClient([item({ owner: "agent" })], TODAY)).toBeNull();
    expect(nextForClient([], TODAY)).toBeNull();
  });

  it("ignores what they have already done", () => {
    expect(nextForClient([item({ doneAt: "2026-09-01T00:00:00Z" })], TODAY)).toBeNull();
  });

  it("never points at somebody else's work", () => {
    const out = nextForClient([
      item({ owner: "agent", dueOn: day(-9), title: "Agent's overdue thing" }),
      item({ owner: "other", ownerName: "Lender", dueOn: day(-5) }),
      item({ owner: "client", dueOn: day(20), title: "Mine, far off" }),
    ], TODAY);
    expect(out?.item.title).toBe("Mine, far off");
  });

  it("leads with the thing that has been late longest", () => {
    /* Not the most recently overdue. The one sitting there for a fortnight is
       what is actually holding the rest up. */
    const out = nextForClient([
      item({ dueOn: day(-2), title: "Late by two" }),
      item({ dueOn: day(-14), title: "Late by fourteen" }),
      item({ dueOn: day(1), title: "Tomorrow" }),
    ], TODAY);
    expect(out?.item.title).toBe("Late by fourteen");
    expect(out?.reason).toBe("overdue");
    expect(out?.days).toBe(-14);
  });

  it("falls to the soonest date when nothing is late", () => {
    const out = nextForClient([
      item({ dueOn: day(30), title: "Far" }),
      item({ dueOn: day(3), title: "Near" }),
    ], TODAY);
    expect(out?.item.title).toBe("Near");
    expect(out?.reason).toBe("dated");
    expect(out?.days).toBe(3);
  });

  it("prefers anything dated over the agent's ordering", () => {
    const out = nextForClient([
      item({ sort: 0, title: "First in the list, no date" }),
      item({ sort: 9, dueOn: day(25), title: "Last in the list, dated" }),
    ], TODAY);
    expect(out?.item.title).toBe("Last in the list, dated");
  });

  it("uses the agent's order when nobody has set a date", () => {
    const out = nextForClient([
      item({ sort: 5, title: "Later" }),
      item({ sort: 1, title: "Earlier" }),
    ], TODAY);
    expect(out?.item.title).toBe("Earlier");
    expect(out?.reason).toBe("undated");
    expect(out?.days).toBeNull();
  });

  it("does not report a day count it does not have", () => {
    /* `days: 0` would render as "today" — a deadline nobody set. */
    expect(nextForClient([item()], TODAY)?.days).toBeNull();
  });
});

describe("notOnYou", () => {
  it("reports nothing rather than inventing activity", () => {
    const out = notOnYou([item({ owner: "client", dueOn: day(2) })], TODAY);
    expect(out.open).toEqual([]);
    expect(out.recentlyDone).toEqual([]);
  });

  it("excludes the client's own work from both halves", () => {
    const out = notOnYou([
      item({ owner: "client" }),
      item({ owner: "client", doneAt: TODAY.toISOString() }),
    ], TODAY);
    expect(out.open).toHaveLength(0);
    expect(out.recentlyDone).toHaveLength(0);
  });

  it("counts a third party as somebody working for them", () => {
    /* "Waiting on the county" is an answer to "what is happening", and to the
       person reading it, it is the same kind of answer as "waiting on Kaleb". */
    const out = notOnYou([item({ owner: "other", ownerName: "DeKalb County" })], TODAY);
    expect(out.open).toHaveLength(1);
  });

  it("puts dated work before undated, soonest first", () => {
    const out = notOnYou([
      item({ owner: "agent", title: "No date", sort: 0 }),
      item({ owner: "agent", title: "Later", dueOn: day(10), sort: 1 }),
      item({ owner: "agent", title: "Sooner", dueOn: day(2), sort: 2 }),
    ], TODAY);
    expect(out.open.map((i) => i.title)).toEqual(["Sooner", "Later", "No date"]);
  });

  it("ages out old completions", () => {
    /* Evidence of life has a shelf life. Something finished in March must not
       read, in September, as though work is under way. */
    const out = notOnYou([
      item({ owner: "agent", title: "Recent", doneAt: new Date(TODAY.getTime() - 3 * 86_400_000).toISOString() }),
      item({ owner: "agent", title: "Ancient", doneAt: new Date(TODAY.getTime() - 200 * 86_400_000).toISOString() }),
    ], TODAY);
    expect(out.recentlyDone.map((i) => i.title)).toEqual(["Recent"]);
  });

  it("keeps something finished exactly on the boundary", () => {
    const at = new Date(TODAY.getTime() - RECENT_DAYS * 86_400_000).toISOString();
    const out = notOnYou([item({ owner: "agent", doneAt: at })], TODAY);
    expect(out.recentlyDone).toHaveLength(1);
  });

  it("shows the most recent completion first", () => {
    const ago = (d: number) => new Date(TODAY.getTime() - d * 86_400_000).toISOString();
    const out = notOnYou([
      item({ owner: "agent", title: "Five days ago", doneAt: ago(5) }),
      item({ owner: "agent", title: "One day ago", doneAt: ago(1) }),
    ], TODAY);
    expect(out.recentlyDone.map((i) => i.title)).toEqual(["One day ago", "Five days ago"]);
  });

  it("treats an unparseable timestamp as no completion at all", () => {
    const out = notOnYou([item({ owner: "agent", doneAt: "not a date" })], TODAY);
    expect(out.recentlyDone).toEqual([]);
  });
});

describe("approaching", () => {
  it("includes work owned by anybody", () => {
    /* A client whose appraisal is on Thursday needs to know, even though there
       is nothing for them to do about it. */
    const out = approaching([
      item({ owner: "other", ownerName: "Appraiser", dueOn: day(3), title: "Appraisal" }),
      item({ owner: "client", dueOn: day(5), title: "Pay stubs" }),
      item({ owner: "agent", dueOn: day(1), title: "Send the agreement" }),
    ], TODAY);
    expect(out.map((a) => a.item.title)).toEqual(["Send the agreement", "Appraisal", "Pay stubs"]);
  });

  it("puts what has already passed at the front", () => {
    const out = approaching([
      item({ dueOn: day(2), title: "Coming" }),
      item({ dueOn: day(-4), title: "Missed" }),
    ], TODAY);
    expect(out[0]!.item.title).toBe("Missed");
    expect(out[0]!.days).toBe(-4);
  });

  it("drops anything beyond the window", () => {
    const out = approaching([item({ dueOn: day(400) })], TODAY, 30);
    expect(out).toEqual([]);
  });

  it("never lists something already done", () => {
    const out = approaching([item({ dueOn: day(2), doneAt: TODAY.toISOString() })], TODAY);
    expect(out).toEqual([]);
  });

  it("omits undated work rather than guessing at a date", () => {
    expect(approaching([item({ dueOn: null })], TODAY)).toEqual([]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => item({ dueOn: day(i + 1) }));
    expect(approaching(many, TODAY, 30, 5)).toHaveLength(5);
  });
});

describe("whenPhrase", () => {
  it("reads the way a person says it", () => {
    expect(whenPhrase(0)).toBe("today");
    expect(whenPhrase(1)).toBe("tomorrow");
    expect(whenPhrase(-1)).toBe("yesterday");
    expect(whenPhrase(-6)).toBe("6 days ago");
    expect(whenPhrase(3)).toBe("in 3 days");
    expect(whenPhrase(9)).toBe("next week");
    expect(whenPhrase(21)).toBe("in 3 weeks");
  });

  it("never renders a negative number of days into the future", () => {
    for (let d = -60; d <= 60; d++) {
      expect(whenPhrase(d), `day ${d}`).not.toMatch(/in -|-\d+ days? ago/);
    }
  });
});
