import { describe, it, expect } from "vitest";
import { buildAgenda, contractDateCommitments } from "./agenda";
import { deadlineView, type Revision } from "./deadline";
import type { ContractSummary } from "./transactions";

const NOW = new Date("2026-10-03T14:00:00Z");

const rev = (dueDate: string, verified: boolean, state: Revision["state"] = "active"): Revision => ({
  seq: 1, state, dueDate, dueTime: null, timezone: "America/New_York", dueAt: null, rule: "as-written",
  triggerLabel: null, triggerDate: null, days: null, sourceTerm: "Paragraph 4", sourcePage: null, sourceDocumentId: null,
  amendment: null, verified, note: null, by: "Kaleb", at: "2026-09-01T12:00:00Z",
});

const date = (id: string, label: string, kind: "contractual" | "target", due: string, verified: boolean, state: Revision["state"] = "active") =>
  ({ id, label, kind, workstream: null, view: deadlineView([rev(due, verified, state)], kind, NOW) });

const contract = (over: Partial<ContractSummary> = {}): ContractSummary => ({
  id: "c1", journeyId: "j1", journeyLabel: "Decatur", leadId: "l1", person: "Michael Brooks", address: "318 Oakhurst Ave",
  financing: "financed", stage: "under-contract", recordedAt: "2026-09-01T00:00:00Z", outcome: null, side: "buy", work: [],
  dates: [
    date("missed", "Due diligence ends", "contractual", "2026-10-01", true),
    date("soon", "Closing", "contractual", "2026-10-09", true),
    date("unchecked", "Appraisal contingency ends", "contractual", "2026-10-12", false),
    date("old-target", "Target walkthrough", "target", "2026-09-20", true),
    date("removed", "Removed date", "contractual", "2026-10-05", true, "removed"),
    date("met", "Inspection", "contractual", "2026-10-02", true, "met"),
  ],
  ...over,
});

describe("contract dates on the calendar", () => {
  it("brings a missed date as overdue and the coming ones, and leaves history, met and removed dates out", () => {
    const got = contractDateCommitments([contract()]);
    expect(got.map((c) => [c.id, c.checked])).toEqual([["date:missed", true], ["date:soon", true], ["date:unchecked", false]]);
    const days = buildAgenda(got, NOW, 35);
    expect(days.map((d) => [d.date, d.daysAway])).toEqual([["2026-10-01", -2], ["2026-10-09", 6], ["2026-10-12", 9]]);
  });

  it("opens the journey's Contract tab, and lets the client see a date only once it is checked", () => {
    const [missed, , unchecked] = contractDateCommitments([contract()]);
    expect(missed).toMatchObject({ href: "/operations/journey/j1?tab=contract", visibleToThem: true, address: "318 Oakhurst Ave", side: "buy" });
    expect(unchecked?.visibleToThem).toBe(false);
  });

  it("has nothing from a contract that has ended", () => {
    expect(contractDateCommitments([contract({ outcome: { outcome: "closed", at: "2026-10-02T00:00:00Z" } })])).toEqual([]);
  });
});
