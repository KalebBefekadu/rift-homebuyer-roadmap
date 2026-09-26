import { describe, expect, it } from "vitest";
import { dealRow, dealsSummary, sortDeals, type DealDate, type DealInput } from "./transactions";
import { WORKSTREAMS, WORKSTREAM_LABEL, type WorkState, type WorkstreamView } from "./progress";
import type { DeadlineView } from "./deadline";

const ws = (state: WorkState = "not-started", more: Partial<WorkstreamView> = {}) =>
  WORKSTREAMS.map((w): WorkstreamView => ({
    workstream: w, label: WORKSTREAM_LABEL[w], state, owner: "other", ownerName: null,
    lastWord: null, daysSinceWord: null, stale: false, note: null, seq: 1, ...more,
  }));
const date = (label: string, dueDate: string, days: number, more: Partial<DeadlineView> = {}, workstream: string | null = null): DealDate => ({
  label, workstream,
  view: { state: "active", timing: days < 0 ? "past" : "upcoming", days, verified: true, when: dueDate, missed: false, current: { dueDate } as DeadlineView["current"], ...more },
});
const deal = (more: Partial<DealInput> = {}): DealInput => ({
  journeyId: "j1", person: "Selam", address: "12 Oak St", financing: "financed", contractedAt: "2026-09-01T12:00:00Z",
  work: ws(), dates: [], ...more,
});

describe("one deal's row", () => {
  it("finds the closing date apart from the next date", () => {
    const r = dealRow(deal({ dates: [date("Closing", "2026-10-20", 24, {}, "closing"), date("Due diligence ends", "2026-10-02", 6)] }));
    expect(r.closing?.when).toBe("2026-10-20");
    expect(r.next?.label).toBe("Due diligence ends");
  });

  it("says nothing about a closing nobody recorded, rather than guessing one", () => {
    const r = dealRow(deal({ dates: [date("Due diligence ends", "2026-10-02", 6)] }));
    expect(r.closing).toBeNull();
  });

  it("puts a missed date and a blocked workstream first, then what is unchecked, reported or quiet", () => {
    const work = ws("in-progress");
    work[4] = { ...work[4], state: "blocked", note: "A 2019 lien" };
    work[1] = { ...work[1], state: "reported" };
    work[2] = { ...work[2], stale: true, daysSinceWord: 9 };
    const r = dealRow(deal({ work, dates: [date("Option ends", "2026-09-20", -6, { missed: true }), date("Appraisal due", "2026-10-01", 5, { verified: false })] }));
    expect(r.flags.map((f) => f.tone)).toEqual(["neg", "neg", "warn", "warn", "warn"]);
    expect(r.flags[1].text).toBe("Title: blocked, A 2019 lien");
    expect(r.flags[4].text).toBe("Financing: no word for 9 days");
  });

  it("counts confirmed out of what applies", () => {
    const work = ws("confirmed");
    work[6] = { ...work[6], state: "not-applicable" };
    work[7] = { ...work[7], state: "waiting" };
    const r = dealRow(deal({ work }));
    expect([r.confirmed, r.applicable]).toEqual([8, 9]);
  });

  it("ignores dates already met or removed", () => {
    const r = dealRow(deal({ dates: [date("Closing", "2026-10-20", 24, { state: "met" }, "closing")] }));
    expect(r.closing).toBeNull();
  });
});

describe("all deals", () => {
  it("lists trouble first, then closing soonest, and an unknown closing last", () => {
    const soon = dealRow(deal({ journeyId: "soon", dates: [date("Closing", "2026-10-01", 5, {}, "closing")] }));
    const later = dealRow(deal({ journeyId: "later", dates: [date("Closing", "2026-11-01", 36, {}, "closing")] }));
    const unknown = dealRow(deal({ journeyId: "unknown" }));
    const work = ws(); work[0] = { ...work[0], state: "blocked" };
    const trouble = dealRow(deal({ journeyId: "trouble", work, dates: [date("Closing", "2026-12-01", 66, {}, "closing")] }));
    expect(sortDeals([unknown, later, trouble, soon]).map((r) => r.journeyId)).toEqual(["trouble", "soon", "later", "unknown"]);
  });

  it("summarises with counts only", () => {
    expect(dealsSummary([])).toBe("Nothing under contract.");
    const soon = dealRow(deal({ dates: [date("Closing", "2026-10-01", 5, {}, "closing")] }));
    expect(dealsSummary([soon, dealRow(deal())])).toBe("2 under contract, 1 closing in the next two weeks.");
  });
});
