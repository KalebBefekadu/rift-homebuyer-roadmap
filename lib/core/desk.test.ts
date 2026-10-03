import { describe, it, expect } from "vitest";
import { activity, arrange, deskItems, markError, markOf, type DeskInput, type Mark } from "./desk";
import { contractFlags, datesNeeding, nextDate, waitingOnOthers, type ContractSummary } from "./transactions";
import { deadlineView, type Revision } from "./deadline";
import { workstreamView, WORKSTREAMS, type WorkUpdate } from "./progress";

const NOW = new Date("2026-09-28T14:00:00Z");
const TODAY = "2026-09-28";

const rev = (dueDate: string, verified: boolean): Revision => ({
  seq: 1, state: "active", dueDate, dueTime: null, timezone: "America/New_York", dueAt: null, rule: "as-written",
  triggerLabel: null, triggerDate: null, days: null, sourceTerm: "Paragraph 4", sourcePage: null, sourceDocumentId: null,
  amendment: null, verified, note: null, by: "Kaleb", at: "2026-09-01T12:00:00Z",
});

const update = (state: WorkUpdate["state"], extra: Partial<WorkUpdate> = {}): WorkUpdate => ({
  seq: 2, state, owner: "other", ownerName: "Peach Mortgage", source: "Dana at Peach Mortgage", confirmedOn: "2026-09-25",
  note: null, byKind: "agent", by: "Kaleb", at: "2026-09-25T15:00:00Z", ...extra,
});

function contract(over: Partial<ContractSummary> = {}, work: Partial<Record<string, WorkUpdate[]>> = {}): ContractSummary {
  return {
    id: "c1", journeyId: "j1", journeyLabel: "Decatur search", leadId: "l1", person: "Dana Okafor", address: "418 Ridgecrest Dr",
    financing: "financed", stage: "under-contract", recordedAt: "2026-09-01T00:00:00Z", outcome: null,
    work: WORKSTREAMS.map((w) => workstreamView(w, work[w] ?? [], NOW)),
    dates: [
      { id: "d-missed", label: "Due diligence", kind: "contractual", workstream: "inspection", view: deadlineView([rev("2026-09-26", true)], "contractual", NOW) },
      { id: "d-unchecked", label: "Financing contingency", kind: "contractual", workstream: "financing", view: deadlineView([rev("2026-10-03", false)], "contractual", NOW) },
      { id: "d-soon", label: "Appraisal", kind: "contractual", workstream: "appraisal", view: deadlineView([rev("2026-10-05", true)], "contractual", NOW) },
      { id: "d-far", label: "Closing", kind: "contractual", workstream: "closing", view: deadlineView([rev("2026-11-20", true)], "contractual", NOW) },
    ],
    ...over,
  };
}

const base = (over: Partial<DeskInput> = {}): DeskInput => ({
  agentFirst: "Kaleb", today: TODAY, dates: [], contracts: [], waiting: [], commitments: [], touches: [], outbox: [],
  programFlags: [], programsWithheld: { names: [], owner: "Kaleb", withinDays: 30 }, reviews: [], jobProblems: [], lapsing: [], choices: [],
  rate: { stale: false, pct: 6.5, age: "2 days old" }, ...over,
});

describe("every contract at once (§8.7)", () => {
  it("names missed, unchecked and upcoming dates, and leaves far ones out", () => {
    const d = datesNeeding([contract()], 14);
    expect(d.map((x) => [x.deadlineId, x.why])).toEqual([["d-missed", "missed"], ["d-unchecked", "unchecked"], ["d-soon", "soon"]]);
  });

  it("ignores ended contracts entirely", () => {
    expect(datesNeeding([contract({ outcome: { outcome: "closed", at: "2026-09-20T00:00:00Z" } })], 14)).toEqual([]);
  });

  it("the next date is the soonest checked one ahead, never a missed or unchecked one", () => {
    expect(nextDate(contract())?.id).toBe("d-soon");
  });

  it("flags blocked work, passed and unchecked dates, and silence, in words", () => {
    const f = contractFlags(contract({}, { appraisal: [update("blocked", { note: "Appraiser not assigned" })] }));
    expect(f.join(" | ")).toMatch(/Appraisal blocked: Appraiser not assigned/);
    expect(f.join(" | ")).toMatch(/Due diligence passed/);
    expect(f.join(" | ")).toMatch(/1 date not checked/);
  });

  it("waiting on others: open work someone else owns, with the day to ask again", () => {
    const w = waitingOnOthers([contract({}, { financing: [update("in-progress")] })], TODAY);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ on: "Peach Mortgage", workstream: "financing", checkIn: "2026-10-02" });
  });
});

describe("Today in five groups (§8.4)", () => {
  it("puts each date where it belongs, and never offers to snooze one", () => {
    const c = contract();
    const items = deskItems(base({ dates: datesNeeding([c], 14), contracts: [c] }));
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey["date:d-missed"]).toMatchObject({ group: "attention", tone: "neg", snoozable: false });
    expect(byKey["date:d-unchecked"]).toMatchObject({ group: "approval", snoozable: false });
    expect(byKey["date:d-soon"]).toMatchObject({ group: "upcoming", snoozable: false });
    for (const i of items) expect(i.next, i.key).toBeTruthy();
  });

  it("every item names why, who and what it is about", () => {
    const items = deskItems(base({
      outbox: [{ id: "o1", state: "prepared", subject: "Georgia Dream has changed", to: "Luis" }, { id: "o2", state: "unknown", subject: "S", to: "Maya" }],
      jobProblems: ["The program check did not run on Monday."],
      lapsing: [{ id: "l2", name: "Eleanor", covered: false, note: "Ended 20 Sep" }],
      rate: { stale: true, pct: 6.72, age: "30 days old" },
      commitments: [
        { id: "action:l3", kind: "action", what: "Call about the appraisal", dueOn: "2026-09-26", personId: "l3", personName: "Maya", side: "buy", visibleToThem: false },
        { id: "step:s1", kind: "step", what: "Send the insurance binder", dueOn: "2026-09-30", personId: "l3", personName: "Maya", side: "buy", visibleToThem: true, owner: "client" },
      ],
    }));
    const group = (k: string) => items.find((i) => i.key === k)?.group;
    expect(group("outbox:o1")).toBe("approval");
    expect(group("outbox:o2")).toBe("attention");
    expect(group("agreement:l2")).toBe("attention");
    expect(group("rate:stale")).toBe("attention");
    expect(group("action:l3")).toBe("attention");
    expect(group("step:s1")).toBe("waiting");
    for (const i of items) {
      expect(i.why, i.key).toBeTruthy();
      expect(i.owner, i.key).toBeTruthy();
    }
  });
});

describe("a sale's promised reviews on Today (S04, S09)", () => {
  it("brings a review due today to Today, and a missed week to Needs attention, each linked to its tab", () => {
    const items = deskItems(base({
      sales: [
        { journeyId: "j1", person: "Sam", label: "Sale of 12 Oak St", kind: "weekly-review", due: TODAY, late: 0 },
        { journeyId: "j2", person: "Ann", label: "Sale of 3 Elm Rd", kind: "pricing-review", due: "2026-09-18", late: 10, version: 2 },
      ],
    }));
    const week = items.find((i) => i.key.startsWith("sale-week:j1"));
    const price = items.find((i) => i.key.startsWith("sale-price:j2"));
    expect(week).toMatchObject({ group: "today", href: "/operations/journey/j1?tab=listing", evidence: "Due today" });
    expect(price).toMatchObject({ group: "attention", tone: "neg", href: "/operations/journey/j2?tab=pricing", title: "Review pricing with Ann" });
    expect(price?.why).toContain("pricing version 2");
    expect(price?.evidence).toContain("10 days ago");
  });

  it("names the listing a weekly review is about, and words a cycle that stopped as a stop", () => {
    const listing = { detail: "Live on FMLS as #7405561", liveOn: "2026-09-01", lastReviewOn: "2026-09-22", url: null };
    const items = deskItems(base({
      sales: [
        { journeyId: "j1", person: "Sam", label: "Selling 12 Oak St", kind: "weekly-review", due: "2026-09-29", late: 1, listing },
        { journeyId: "j2", person: "Ann", label: "Selling 3 Elm Rd", kind: "weekly-review", due: "2026-08-10", late: 49, listing: { ...listing, lastReviewOn: null } },
      ],
    }));
    const recent = items.find((i) => i.key.startsWith("sale-week:j1"));
    expect(recent?.evidence).toBe("Live on FMLS as #7405561, live since Sep 1; last reviewed Sep 22");
    expect(recent?.why).toContain("Due yesterday");
    const stopped = items.find((i) => i.key.startsWith("sale-week:j2"));
    expect(stopped).toMatchObject({ group: "attention", tone: "neg", title: "No weekly review for 8 weeks: Selling 3 Elm Rd" });
    expect(stopped?.next).toContain("withdraw the listing");
    expect(stopped?.evidence).toContain("not reviewed yet");
    /* No raw date and no bare "N days ago" on either. */
    for (const i of [recent, stopped]) expect([i?.title, i?.why, i?.evidence, i?.due].join(" ")).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("puts an approved message the last check refused where the agent will read why", () => {
    const items = deskItems(base({
      outbox: [
        { id: "o1", state: "approved", subject: "DeKalb HomeStart is taking applications", to: "Sofia", held: "They replied after this was approved; read their reply first" },
        { id: "o2", state: "approved", subject: "Plain approval", to: "Luis", held: null },
      ],
    }));
    expect(items.find((i) => i.key === "outbox:o1")).toMatchObject({
      group: "attention", tone: "warn", title: "Held back: DeKalb HomeStart is taking applications",
      evidence: "They replied after this was approved; read their reply first",
    });
    expect(items.find((i) => i.key === "outbox:o2")?.group).toBe("approval");
  });

  it("asks the agent to talk when a seller wants to discuss the price, and reports an agreement as news", () => {
    const answers = [
      { journeyId: "j1", person: "Sam", label: "Sale of 12 Oak St", version: 3, response: "discuss" as const, note: "Feels high", by: "Sam", at: "2026-09-28T12:00:00Z" },
      { journeyId: "j2", person: "Ann", label: "Sale of 3 Elm Rd", version: 1, response: "agree" as const, note: null, by: "Ann", at: "2026-09-28T13:00:00Z" },
    ];
    const items = deskItems(base({ pricingAnswers: answers }));
    expect(items.find((i) => i.key === "sale-discuss:j1:3")).toMatchObject({ group: "approval", evidence: "“Feels high”", title: "Sam wants to talk about the price" });
    expect(items.some((i) => i.key.includes("j2"))).toBe(false);
    const news = activity({ leads: [], events: [], jobs: [], sent: [], choices: [], answers }, NOW);
    expect(news.map((n) => n.text)).toEqual(["Ann agreed to pricing version 1 for Sale of 3 Elm Rd"]);
  });

  it("shows what households did, in the morning summary's words, linked to the journey", () => {
    const news = activity({
      leads: [], events: [], jobs: [], sent: [], choices: [],
      clients: [{ kind: "tour-request", journeyId: "j9", journey: "Buying in Decatur", person: "Maya", who: "Maya", home: "4 Pine Ct", at: "2026-09-28T11:00:00Z" }],
    }, NOW);
    expect(news[0]).toMatchObject({ href: "/operations/journey/j9", auto: false });
    expect(news[0]!.text).toBe("Buying in Decatur: Maya asked to see 4 Pine Ct. Nothing is booked until you arrange it.");
  });
});

describe("snooze, pin and delegate (OPS-02)", () => {
  const m = (kind: Mark["kind"], at: string, extra: Partial<Mark> = {}): Mark => ({ key: "action:l3", kind, until: null, person: null, reason: null, by: "Kaleb", at, ...extra });

  it("a contract date cannot be snoozed; a snooze needs a time and an owner", () => {
    expect(markError("date:d1", "snooze", { until: "2026-09-29T13:00:00Z", person: "Kaleb" }, NOW)).toMatch(/never snoozed/);
    expect(markError("action:l3", "snooze", { until: null, person: "Kaleb" }, NOW)).toMatch(/time/);
    expect(markError("action:l3", "snooze", { until: "2026-09-29T13:00:00Z", person: " " }, NOW)).toMatch(/who/);
    expect(markError("action:l3", "snooze", { until: "2026-09-29T13:00:00Z", person: "Kaleb" }, NOW)).toBeNull();
    expect(markError("action:l3", "pin", { until: "2026-09-29T13:00:00Z", reason: "" }, NOW)).toMatch(/why/);
  });

  it("a snooze ends on its own; a delegation shows unaccepted until accepted; clear ends everything", () => {
    expect(markOf([m("snooze", "2026-09-28T10:00:00Z", { until: "2026-09-29T13:00:00Z", person: "Kaleb" })], NOW)?.kind).toBe("snoozed");
    expect(markOf([m("snooze", "2026-09-20T10:00:00Z", { until: "2026-09-21T13:00:00Z", person: "Kaleb" })], NOW)).toBeNull();
    expect(markOf([m("delegate", "2026-09-28T10:00:00Z", { person: "Sam" })], NOW)).toEqual({ kind: "delegated", to: "Sam", accepted: false });
    expect(markOf([m("delegate", "2026-09-28T10:00:00Z", { person: "Sam" }), m("accept", "2026-09-28T11:00:00Z", { person: "Sam" })], NOW))
      .toEqual({ kind: "delegated", to: "Sam", accepted: true });
    expect(markOf([m("delegate", "2026-09-28T10:00:00Z", { person: "Sam" }), m("clear", "2026-09-28T11:00:00Z")], NOW)).toBeNull();
  });

  it("snoozed items leave their group and are counted; pinned ones lead it; dates stay whatever the marks say", () => {
    const c = contract();
    const items = deskItems(base({
      dates: datesNeeding([c], 14), contracts: [c],
      jobProblems: ["a", "b"],
    }));
    const [jobA, jobB] = items.filter((i) => i.key.startsWith("job:"));
    const marks: Mark[] = [
      { key: jobA!.key, kind: "snooze", until: "2026-09-29T13:00:00Z", person: "Kaleb", reason: null, by: "Kaleb", at: "2026-09-28T10:00:00Z" },
      { key: jobB!.key, kind: "pin", until: "2026-10-01T13:00:00Z", person: null, reason: "Vercel ticket open", by: "Kaleb", at: "2026-09-28T10:00:00Z" },
      { key: "date:d-missed", kind: "snooze", until: "2026-09-29T13:00:00Z", person: "Kaleb", reason: null, by: "Kaleb", at: "2026-09-28T10:00:00Z" },
    ];
    const attention = arrange(items, marks, NOW).find((g) => g.group === "attention")!;
    expect(attention.snoozed.map((i) => i.key)).toEqual([jobA!.key]);
    expect(attention.items[0]!.key).toBe(jobB!.key);
    expect(attention.items.some((i) => i.key === "date:d-missed")).toBe(true);
    expect(attention.items.some((i) => i.key === jobA!.key)).toBe(false);
  });
});

describe("recent activity", () => {
  it("keeps the last three days, newest first, and marks what Rift did on its own", () => {
    const a = activity({
      leads: [{ id: "l1", name: "Luis", email: null, side: "buy", createdAt: "2026-09-28T13:00:00Z" }, { id: "l0", name: "Old", email: null, side: "buy", createdAt: "2026-09-01T00:00:00Z" }],
      events: [],
      jobs: [{ label: "Program check", lastRun: { ok: true, detail: "6 unchanged", startedAt: "2026-09-28T12:00:00Z", finishedAt: "2026-09-28T12:01:00Z" } }],
      sent: [], choices: [],
    }, NOW);
    expect(a.map((x) => x.text)).toEqual(["New buyer lead: Luis", "Program check: ran, 6 unchanged"]);
    expect(a[1]!.auto).toBe(true);
  });
});
