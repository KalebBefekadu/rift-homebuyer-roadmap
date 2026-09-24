import { describe, expect, it } from "vitest";
import { todayFor, type TodayInput } from "./today";
import { workstreamView, type WorkUpdate, type Workstream } from "./progress";
import type { PlanItem } from "./plan";

const NOW = new Date("2026-09-23T15:00:00Z");
const up = (seq: number, extra: Partial<WorkUpdate>): WorkUpdate => ({
  seq, state: "not-started", owner: "other", ownerName: "Dana at Peach Mortgage", source: null, confirmedOn: null,
  note: null, byKind: "agent", by: "Kaleb", at: "2026-09-01T12:00:00Z", ...extra,
});
const w = (ws: Workstream, ...updates: WorkUpdate[]) => workstreamView(ws, updates, NOW);
const item = (id: string, extra: Partial<PlanItem>): PlanItem => ({
  id, title: id, owner: "client", ownerName: null, dueOn: null, doneAt: null, sort: 0, ...extra,
});
const base: TodayInput = {
  agentFirst: "Kaleb",
  progress: { stage: "under-contract", status: "active", stageSince: null, statusSince: null, seq: 4 },
  work: [], plan: [], briefToConfirm: false, showingsToAnswer: [],
};

describe("Today's order (blueprint v4 §6)", () => {
  it("keeps a blocked loan first even though the inspection is finished (AT19)", () => {
    const t = todayFor({
      ...base,
      work: [
        w("inspection", up(1, { owner: "client", ownerName: null }), up(2, { state: "confirmed", owner: "client", ownerName: null, source: "ABC Inspections", confirmedOn: "2026-09-21" })),
        w("financing", up(1, {}), up(2, { state: "blocked", note: "The lender needs two more pay stubs", confirmedOn: "2026-09-22" })),
      ],
    }, NOW);
    expect(t.items[0]).toMatchObject({ kind: "blocker", title: "Financing is blocked" });
    expect(t.items[0]!.detail).toMatch(/two more pay stubs/);
    expect(t.items.some((i) => /Inspection/.test(i.title))).toBe(false);
    expect(t.nothingOwed).toBeNull();
  });

  it("puts their overdue items before decisions, and decisions before their other tasks", () => {
    const t = todayFor({
      ...base,
      plan: [item("Send pay stubs", { dueOn: "2026-09-20" }), item("Book the movers", { dueOn: "2026-09-25" })],
      briefToConfirm: true,
      showingsToAnswer: ["12 Oak St"],
    }, NOW);
    expect(t.items.map((i) => i.kind)).toEqual(["overdue", "decision", "decision", "yours"]);
    expect(t.items[0]!.detail).toMatch(/3 days ago/);
  });

  it("puts an offer waiting on them first among decisions, as an instruction not a signature", () => {
    const t = todayFor({ ...base, briefToConfirm: true, offersToAnswer: ["12 Oak St"] }, NOW);
    expect(t.items[0]).toMatchObject({ kind: "decision", title: "Your offer on 12 Oak St", anchor: "offers" });
    expect(t.items[0]!.detail).toMatch(/instruction, not a signature/);
  });

  it("never lets one action hide a second real deadline", () => {
    const t = todayFor({
      ...base,
      plan: [item("Wire earnest money", { dueOn: "2026-09-24" }), item("Choose an inspector", { dueOn: "2026-09-26" }), item("Later thing", { dueOn: "2026-11-01" })],
    }, NOW);
    const mine = t.items.filter((i) => i.kind === "yours").map((i) => i.title);
    expect(mine).toEqual(["Wire earnest money", "Choose an inspector"]);
  });

  it("shows other people's work with its source and date, and a quiet lender as awaiting an update (AT21)", () => {
    const t = todayFor({ ...base, work: [w("financing", up(1, {}), up(2, { state: "in-progress", source: "Dana at Peach Mortgage", confirmedOn: "2026-09-10" }))] }, NOW);
    const lender = t.items.find((i) => i.kind === "others")!;
    expect(lender.title).toBe("Financing: Dana at Peach Mortgage");
    expect(lender.detail).toMatch(/Last confirmed Sep 10.*Waiting for an update/);
    expect(JSON.stringify(t)).not.toMatch(/on track/i);
  });

  it("lists a reported earnest money deposit as waiting on the holder, not as done or as theirs to do (AT20)", () => {
    const t = todayFor({ ...base, work: [w("earnest-money", up(1, { owner: "client", ownerName: null }), up(2, { state: "reported", owner: "client", ownerName: null, byKind: "client", at: "2026-09-22T10:00:00Z" }))] }, NOW);
    expect(t.items).toHaveLength(1);
    expect(t.items[0]).toMatchObject({ kind: "others", title: "Earnest money" });
    expect(t.items[0]!.detail).toMatch(/Not confirmed received until the holder says so/);
  });

  it("says nothing is owed without vouching for anybody else", () => {
    const quiet = todayFor(base, NOW);
    expect(quiet.items).toHaveLength(0);
    expect(quiet.nothingOwed).toMatch(/Nothing is waiting on you right now\. If something seems to be missing, ask Kaleb/);
    const others = todayFor({ ...base, plan: [item("Order the appraisal", { owner: "other", ownerName: "The lender" })] }, NOW);
    expect(others.nothingOwed).toMatch(/what others are doing, with the date each last gave word/);
    expect(others.nothingOwed).not.toMatch(/on track|everything is/i);
  });

  it("ignores finished plan items and never ranks by anything but the rule", () => {
    const t = todayFor({ ...base, plan: [item("Done already", { dueOn: "2026-09-01", doneAt: "2026-09-02T00:00:00Z" })] }, NOW);
    expect(t.items).toHaveLength(0);
  });

  it("says where the journey is, including paused with the contract still running", () => {
    expect(todayFor(base, NOW).where).toBe("Now: Under contract.");
    expect(todayFor({ ...base, progress: { ...base.progress, status: "paused" } }, NOW).where).toMatch(/keeps its dates/);
  });
});
