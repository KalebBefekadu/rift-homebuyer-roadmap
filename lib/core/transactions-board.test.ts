import { describe, expect, it } from "vitest";
import { nextAhead, orderContracts, progressOf, urgencyOf, type ContractSummary } from "./transactions";
import type { WorkState } from "./progress";

const work = (states: Partial<Record<string, WorkState>>, stale: string[] = []) =>
  ["earnest-money", "inspection", "financing", "appraisal", "title"].map((w) => ({
    workstream: w, label: w, state: states[w] ?? "not-started", owner: "agent", ownerName: null, lastWord: null, daysSinceWord: null,
    stale: stale.includes(w), note: null, seq: 1,
  })) as unknown as ContractSummary["work"];

const date = (label: string, days: number, over: { verified?: boolean; missed?: boolean } = {}) => ({
  id: label, label, kind: "contractual", workstream: null,
  view: { state: "active", timing: "upcoming", days, verified: over.verified ?? true, when: `in ${days}`, missed: over.missed ?? false, current: {} },
}) as unknown as ContractSummary["dates"][number];

const contract = (id: string, over: Partial<ContractSummary> = {}): ContractSummary => ({
  id, journeyId: `j-${id}`, journeyLabel: "", leadId: "l", person: id, address: id, financing: "financed", stage: "under-contract",
  recordedAt: "2026-09-01T00:00:00Z", outcome: null, work: work({}), dates: [], ...over,
});

describe("the date to look at", () => {
  it("counts a date that has not been checked, which the Today view must not", () => {
    const c = contract("a", { dates: [date("Due diligence ends", 4, { verified: false })] });
    const d = nextAhead(c)!;
    expect(d.days).toBe(4);
    expect(d.verified).toBe(false);
  });

  it("puts a missed date before any date still ahead", () => {
    const c = contract("a", { dates: [date("Closing", 3), date("Earnest due", -2, { missed: true })] });
    expect(nextAhead(c)).toMatchObject({ label: "Earnest due", missed: true });
  });

  it("is nothing when no date is recorded ahead", () => {
    expect(nextAhead(contract("a"))).toBeNull();
  });
});

describe("progress and urgency", () => {
  it("counts confirmed workstreams out of the ones that apply", () => {
    const c = contract("a", { work: work({ "earnest-money": "confirmed", inspection: "confirmed", financing: "blocked", appraisal: "not-applicable" }) });
    expect(progressOf(c)).toEqual({ settled: 2, total: 4, blocked: 1, reported: 0 });
  });

  it("ranks stuck or missed first, then unchecked or unconfirmed, then quiet, then clean", () => {
    expect(urgencyOf(contract("a", { work: work({ title: "blocked" }) }))).toBe(0);
    expect(urgencyOf(contract("b", { dates: [date("x", -1, { missed: true })] }))).toBe(0);
    expect(urgencyOf(contract("c", { work: work({ title: "reported" }) }))).toBe(1);
    expect(urgencyOf(contract("d", { dates: [date("x", 5, { verified: false })] }))).toBe(1);
    expect(urgencyOf(contract("e", { work: work({ title: "waiting" }, ["title"]) }))).toBe(2);
    expect(urgencyOf(contract("f", { work: work({ title: "in-progress" }) }))).toBe(3);
  });
});

describe("the order of the table", () => {
  it("puts what needs the agent first, then the nearest date, with ended contracts last and newest first", () => {
    const list = [
      contract("clean-soon", { dates: [date("Closing", 2)] }),
      contract("ended-old", { outcome: { outcome: "closed", at: "2026-03-01T00:00:00Z" } }),
      contract("blocked", { work: work({ title: "blocked" }), dates: [date("Closing", 30)] }),
      contract("clean-later", { dates: [date("Closing", 20)] }),
      contract("ended-new", { outcome: { outcome: "terminated", at: "2026-09-01T00:00:00Z" } }),
    ];
    expect(orderContracts(list).map((c) => c.id)).toEqual(["blocked", "clean-soon", "clean-later", "ended-new", "ended-old"]);
  });
});
