import { describe, it, expect } from "vitest";
import {
  ago, dueView, bandIsLive, sourceLabel, stagesFor, startingStagesFor, isTerminal,
  narrowPeople, sortPeople, sameContact, pick, SORTS,
} from "./people";

/* Noon in Georgia on 30 Sep 2026, so "today" is not at the mercy of UTC. */
const NOW = new Date("2026-09-30T16:00:00Z");

const person = (over: Partial<{ id: string; name: string | null; email: string | null; phone: string | null; stage: string | null; nextDue: string | null; createdAt: string }> = {}) => ({
  id: over.id ?? "a", name: over.name ?? "A", email: over.email ?? null, phone: over.phone ?? null,
  stage: (over.stage ?? null) as never, nextDue: over.nextDue ?? null, createdAt: over.createdAt ?? "2026-09-01T12:00:00Z",
});

describe("ago", () => {
  it("counts Georgia days and says months properly", () => {
    expect(ago("2026-09-30T13:00:00Z", NOW)).toBe("today");
    expect(ago("2026-09-29T16:00:00Z", NOW)).toBe("yesterday");
    expect(ago("2026-09-25T16:00:00Z", NOW)).toBe("5 days ago");
    expect(ago("2026-09-02T16:00:00Z", NOW)).toBe("4 weeks ago");
    expect(ago("2026-08-15T16:00:00Z", NOW)).toBe("1 month ago");
    expect(ago("2026-06-15T16:00:00Z", NOW)).toBe("3 months ago");
    expect(ago("2025-06-15T16:00:00Z", NOW)).toBe("1 year ago");
  });
  it("does not call last evening in Georgia today because it was already tomorrow in London", () => {
    // 11pm on 29 Sep in Georgia is 03:00 UTC on 30 Sep.
    expect(ago("2026-09-30T03:00:00Z", NOW)).toBe("yesterday");
  });
});

describe("dueView", () => {
  it("names overdue, today, tomorrow, this week and later", () => {
    expect(dueView("2026-09-26", NOW)).toMatchObject({ state: "overdue", label: "Overdue 4 days" });
    expect(dueView("2026-09-29", NOW)).toMatchObject({ state: "overdue", label: "Overdue 1 day" });
    expect(dueView("2026-09-30", NOW)).toMatchObject({ state: "today", label: "Due today" });
    expect(dueView("2026-10-01", NOW)).toMatchObject({ state: "soon", label: "Due tomorrow" });
    expect(dueView("2026-10-05", NOW)).toMatchObject({ state: "soon", label: "Due in 5 days" });
    expect(dueView("2026-10-20", NOW)).toMatchObject({ state: "later", label: "Due Oct 20" });
  });
});

describe("the funnel band", () => {
  it("is shown only while nobody has picked them up", () => {
    expect(bandIsLive({ band: "now", stage: null, archivedAt: null })).toBe(true);
    expect(bandIsLive({ band: "now", stage: "Closed", archivedAt: null })).toBe(false);
    expect(bandIsLive({ band: "now", stage: null, archivedAt: "2026-09-01T00:00:00Z" })).toBe(false);
    expect(bandIsLive({ band: null, stage: null, archivedAt: null })).toBe(false);
  });
});

describe("words for codes", () => {
  it("does not call a referral added by hand", () => {
    expect(sourceLabel("referral")).toBe("Referred");
    expect(sourceLabel("manual")).toBe("Added by hand");
    expect(sourceLabel("import")).toBe("Imported");
    expect(sourceLabel("something-new")).toBe("something-new");
  });
});

describe("stages by side", () => {
  it("offers buyers no seller stage and sellers no buyer stage", () => {
    expect(stagesFor("buy")).not.toContain("Preparing the property");
    expect(stagesFor("sell")).not.toContain("Searching");
    expect(stagesFor("sell")).toContain("Preparing the property");
  });
  it("never starts somebody as lost", () => {
    expect(startingStagesFor("buy")).not.toContain("Lost");
    expect(startingStagesFor("buy")).toContain("Closed");
  });
  it("knows the terminal stages", () => {
    expect(isTerminal("Closed")).toBe(true);
    expect(isTerminal("Lost")).toBe(true);
    expect(isTerminal("Closing")).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });
});

describe("narrowPeople", () => {
  const people = [
    person({ id: "new", stage: null }),
    person({ id: "late", stage: "Searching", nextDue: "2026-09-26" }),
    person({ id: "week", stage: "Financing", nextDue: "2026-10-04" }),
    person({ id: "far", stage: "Under contract", nextDue: "2026-11-01" }),
    person({ id: "done", stage: "Closed" }),
  ];
  const contacts = new Map([["late", "2026-09-29T16:00:00Z"], ["week", "2026-09-01T16:00:00Z"]]);
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  const any = { stage: "any", next: "any", contact: "any" } as const;

  it("groups stages", () => {
    expect(ids(narrowPeople(people, contacts, { ...any, stage: "none" }, NOW))).toEqual(["new"]);
    expect(ids(narrowPeople(people, contacts, { ...any, stage: "early" }, NOW))).toEqual(["week"]);
    expect(ids(narrowPeople(people, contacts, { ...any, stage: "contract" }, NOW))).toEqual(["far"]);
    expect(ids(narrowPeople(people, contacts, { ...any, stage: "done" }, NOW))).toEqual(["done"]);
  });
  it("finds overdue, due this week and none set; overdue counts as due this week", () => {
    expect(ids(narrowPeople(people, contacts, { ...any, next: "overdue" }, NOW))).toEqual(["late"]);
    expect(ids(narrowPeople(people, contacts, { ...any, next: "week" }, NOW))).toEqual(["late", "week"]);
    expect(ids(narrowPeople(people, contacts, { ...any, next: "none" }, NOW))).toEqual(["new", "done"]);
  });
  it("treats never contacted as quiet, and ignores the contact filter when contacts did not load", () => {
    expect(ids(narrowPeople(people, contacts, { ...any, contact: "recent" }, NOW))).toEqual(["late"]);
    expect(ids(narrowPeople(people, contacts, { ...any, contact: "quiet" }, NOW))).toEqual(["new", "week", "far", "done"]);
    expect(ids(narrowPeople(people, contacts, { ...any, contact: "never" }, NOW))).toEqual(["new", "far", "done"]);
    expect(narrowPeople(people, null, { ...any, contact: "never" }, NOW)).toHaveLength(5);
  });
});

describe("sortPeople", () => {
  const people = [
    person({ id: "b", name: "bea", nextDue: null }),
    person({ id: "a", name: "Al", nextDue: "2026-10-02" }),
    person({ id: "c", name: "Cy", nextDue: "2026-09-01" }),
  ];
  const contacts = new Map([["a", "2026-09-29T00:00:00Z"], ["c", "2026-08-01T00:00:00Z"]]);
  it("orders by name, by due with none last, and by quietest with never first", () => {
    expect(sortPeople(people, contacts, "name").map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(sortPeople(people, contacts, "due").map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(sortPeople(people, contacts, "quiet").map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(sortPeople(people, contacts, "arrived").map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
  it("reads a sort from the address and falls back when it is not one", () => {
    expect(pick(SORTS, "quiet", "arrived")).toBe("quiet");
    expect(pick(SORTS, "drop table", "arrived")).toBe("arrived");
  });
});

describe("sameContact", () => {
  const people = [
    { email: "Marcus.Bell@Example.com", phone: "(404) 555-0142" },
    { email: null, phone: "770 555 0171" },
  ];
  it("matches email without case and phone by digits, country code or not", () => {
    expect(sameContact(people, " marcus.bell@example.com ", null)).toHaveLength(1);
    expect(sameContact(people, null, "+1 404-555-0142")).toHaveLength(1);
    expect(sameContact(people, null, "7705550171")).toHaveLength(1);
    expect(sameContact(people, "someone@else.com", "404")).toHaveLength(0);
  });
});
