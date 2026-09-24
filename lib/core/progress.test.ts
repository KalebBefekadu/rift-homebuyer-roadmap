import { describe, expect, it } from "vitest";
import {
  STAGES, marketDay, visitedStages, endContractError, contractError, initialWork, progressOf, stageError, stageStrip, statusError,
  workError, workLine, workSummary, workstreamView,
  type JourneyEvent, type Progress, type StageContext, type WorkUpdate, type Workstream,
} from "./progress";

const ev = (seq: number, kind: "stage" | "status", to: string, extra: Partial<JourneyEvent> = {}): JourneyEvent => ({
  seq, kind, from: "", to, reason: "because", evidence: null, contractId: null, by: "Kaleb", at: `2026-09-${String(10 + seq).padStart(2, "0")}T12:00:00Z`, ...extra,
});
const COVERED: StageContext = { covered: true, coverageNote: "", openContract: false };
const UNCOVERED: StageContext = { covered: false, coverageNote: "No agreement is on file.", openContract: false };
const P = (stage: Progress["stage"], status: Progress["status"] = "active"): Progress => ({ stage, status, stageSince: null, statusSince: null, seq: 3 });
const NOW = new Date("2026-09-23T15:00:00Z");

const up = (seq: number, extra: Partial<WorkUpdate>): WorkUpdate => ({
  seq, state: "not-started", owner: "other", ownerName: "Dana at Peach Mortgage", source: null, confirmedOn: null,
  note: null, byKind: "agent", by: "Kaleb", at: "2026-09-01T12:00:00Z", ...extra,
});
const view = (w: Workstream, updates: WorkUpdate[]) => workstreamView(w, updates, NOW);

describe("stage and status are history (REQ-STATE-01, 05)", () => {
  it("starts at Prepare, active, and follows the latest event of each kind", () => {
    expect(progressOf([])).toMatchObject({ stage: "prepare", status: "active", seq: 0 });
    const p = progressOf([ev(2, "status", "paused"), ev(1, "stage", "search"), ev(3, "stage", "tour")]);
    expect(p).toMatchObject({ stage: "tour", status: "paused", seq: 3 });
  });

  it("never moves on its own: every change needs a reason", () => {
    expect(stageError(P("search"), "tour", { reason: "" }, COVERED)).toMatch(/Say why/);
    expect(stageError(P("search"), "tour", { reason: "Saw 3 homes" }, COVERED)).toBeNull();
  });

  it("reaches Under contract and Own only through the contract record", () => {
    expect(stageError(P("offer"), "under-contract", { reason: "accepted" }, COVERED)).toMatch(/Record the contract/);
    expect(stageError(P("close"), "own", { reason: "closed" }, { ...COVERED, openContract: true })).toMatch(/as closed/);
  });

  it("cannot slip back before Under contract while a contract is open", () => {
    expect(stageError(P("under-contract"), "search", { reason: "x fell through" }, { ...COVERED, openContract: true })).toMatch(/Record how it ended/);
  });

  it("keeps the pipeline's agreement gate going forward, never going back", () => {
    expect(stageError(P("prepare"), "search", { reason: "ready" }, UNCOVERED)).toMatch(/signed buyer agreement.*No agreement/);
    expect(stageError(P("tour"), "prepare", { reason: "paused saving" }, UNCOVERED)).toBeNull();
  });

  it("asks for evidence to reach Close", () => {
    const ctx = { ...COVERED, openContract: true };
    expect(stageError(P("under-contract"), "close", { reason: "moving on" }, ctx)).toMatch(/what shows closing/);
    expect(stageError(P("under-contract"), "close", { reason: "moving on", evidence: "Set with Smith Law for 30 Oct" }, ctx)).toBeNull();
  });

  it("will not touch a finished journey's stage until it is reopened", () => {
    expect(stageError(P("search", "cancelled"), "tour", { reason: "back" }, COVERED)).toMatch(/Reopen/);
    expect(statusError(P("search", "cancelled"), "active", "They are back")).toBeNull();
  });

  it("calls a journey completed only once the home is theirs", () => {
    expect(statusError(P("close"), "completed", "done")).toMatch(/Record the closing/);
    expect(statusError(P("own"), "completed", "Keys handed over")).toBeNull();
  });

  it("draws the strip as happened, now and ahead, with no percentage (UX-03)", () => {
    const strip = stageStrip(P("offer"), ["prepare", "search", "tour", "offer"]);
    expect(strip.map((s) => s.state)).toEqual(["done", "done", "done", "now", "ahead", "ahead", "ahead"]);
    expect(JSON.stringify(strip)).not.toMatch(/%/);
    expect(strip).toHaveLength(STAGES.length);
  });

  it("ticks only stages the journey was recorded at", () => {
    const events = [ev(1, "stage", "search"), ev(2, "stage", "under-contract", { contractId: "t" })];
    const strip = stageStrip(progressOf(events), visitedStages(events));
    expect(strip.map((s) => s.state)).toEqual(["done", "done", "skipped", "skipped", "now", "ahead", "ahead"]);
  });
});

describe("contract attempts (REQ-STATE-06)", () => {
  const ok = { homeId: "h", financing: "financed" as const, evidence: "Executed purchase agreement, 23 Sep" };

  it("needs binding evidence, a home on the list and an agreement in force", () => {
    expect(contractError(P("offer"), ok, { ...COVERED, homeOnList: true })).toBeNull();
    expect(contractError(P("offer"), { ...ok, evidence: "" }, { ...COVERED, homeOnList: true })).toMatch(/binding/);
    expect(contractError(P("offer"), ok, { ...COVERED, homeOnList: false })).toMatch(/home on the list/);
    expect(contractError(P("offer"), ok, { ...UNCOVERED, homeOnList: true })).toMatch(/signed buyer agreement/);
    expect(contractError(P("under-contract"), ok, { ...COVERED, openContract: true, homeOnList: true })).toMatch(/already open/);
  });

  it("ends as terminated only with a place to go, and as closed only once closing is confirmed", () => {
    const work = initialWork("financed").map((w) => view(w.workstream, [up(1, { ...w.input })]));
    expect(endContractError("terminated", "Inspection found foundation damage", null, work)).toMatch(/Search or Offer/);
    expect(endContractError("terminated", "Inspection found foundation damage", "search", work)).toBeNull();
    expect(endContractError("closed", "Funded and recorded", null, work)).toMatch(/closing as confirmed/);
    const closed = work.map((w) => w.workstream === "closing" ? view("closing", [up(1, {}), up(2, { state: "confirmed", source: "Smith Law", confirmedOn: "2026-09-22" })]) : w);
    expect(endContractError("closed", "Funded and recorded", null, closed)).toBeNull();
  });

  it("gives a cash purchase no lender milestones (REQ-STATE-04)", () => {
    const cash = initialWork("cash");
    for (const w of cash.filter((x) => x.workstream === "financing" || x.workstream === "appraisal")) {
      expect(w.input.state).toBe("not-applicable");
      expect(w.input.note).toMatch(/Cash/);
    }
    expect(initialWork("financed").every((w) => w.input.state === "not-started")).toBe(true);
  });
});

describe("a client's done is a report (REQ-UX-02, AT20)", () => {
  it("lets the client report their own part and nothing else", () => {
    expect(workError("not-started", "client", { state: "reported", owner: "client" }, "client")).toBeNull();
    expect(workError("not-started", "client", { state: "confirmed", owner: "client", source: "me", confirmedOn: "2026-09-20" }, "client")).toMatch(/your agent records/);
    expect(workError("waiting", "other", { state: "reported", owner: "other", ownerName: "Lender" }, "client")).toMatch(/not yours/);
    expect(workError("confirmed", "client", { state: "reported", owner: "client" }, "client")).toMatch(/already settled/);
  });

  it("records earnest money as sent, not received, until the holder confirms", () => {
    const reported = view("earnest-money", [up(1, { owner: "client", ownerName: null }), up(2, { state: "reported", owner: "client", ownerName: null, byKind: "client", by: "Devon", at: "2026-09-22T16:00:00Z" })]);
    expect(reported.state).toBe("reported");
    expect(workLine(reported, "Kaleb")).toMatch(/Reported sent on Sep 22\. Not confirmed received until the holder says so/);
    expect(workSummary([reported])).toMatch(/0 of 1 confirmed/);
  });

  it("confirms only with a named source and the day they said it", () => {
    expect(workError("reported", "client", { state: "confirmed", owner: "client" }, "agent")).toMatch(/who confirmed/);
    expect(workError("reported", "client", { state: "confirmed", owner: "client", source: "Smith Law, the holder" }, "agent")).toMatch(/day they confirmed/);
    expect(workError("reported", "client", { state: "confirmed", owner: "client", source: "Smith Law", confirmedOn: "2026-09-30" }, "agent", NOW)).toMatch(/future/);
    expect(workError("reported", "client", { state: "confirmed", owner: "client", source: "Smith Law", confirmedOn: "2026-09-23" }, "agent", NOW)).toBeNull();
  });
});

describe("nothing is on track, only last confirmed (REQ-UX-04, AT21)", () => {
  it("says a lender update gone quiet was last confirmed, and that an update is awaited", () => {
    const quiet = view("financing", [up(1, {}), up(2, { state: "in-progress", source: "Dana at Peach Mortgage", confirmedOn: "2026-09-10" })]);
    expect(quiet.stale).toBe(true);
    const line = workLine(quiet, "Kaleb");
    expect(line).toBe("Last confirmed Sep 10, by Dana at Peach Mortgage. Waiting for an update.");
    expect(line).not.toMatch(/on track/i);
  });

  it("reads a recent one with its date and source", () => {
    const fresh = view("financing", [up(1, {}), up(2, { state: "in-progress", source: "Dana at Peach Mortgage", confirmedOn: "2026-09-21" })]);
    expect(fresh.stale).toBe(false);
    expect(workLine(fresh, "Kaleb")).toBe("Under way. Last update Sep 21, from Dana at Peach Mortgage.");
  });

  it("does not count the row that opened the contract as anybody's word", () => {
    const opened = view("title", [up(1, { state: "in-progress", owner: "other", ownerName: "Smith Law" })]);
    expect(opened.lastWord).toBeNull();
    expect(workLine(opened, "Kaleb")).toMatch(/Waiting for confirmation. Nobody has given an update yet/);
  });

  it("never says on track, in any state", () => {
    for (const state of ["not-started", "in-progress", "waiting", "blocked", "reported", "confirmed", "not-applicable"] as const) {
      const v = view("appraisal", [up(1, {}), up(2, { state, source: "Lender", confirmedOn: "2026-09-22", note: "note" })]);
      expect(workLine(v, "Kaleb")).not.toMatch(/on track|on schedule|all good/i);
    }
  });
});

describe("dates are Georgia's, not UTC's", () => {
  it("keeps 9pm on the 23rd in Georgia on the 23rd, so tomorrow cannot be recorded", () => {
    const evening = new Date("2026-09-24T01:00:00Z");
    expect(marketDay(evening)).toBe("2026-09-23");
    expect(workError("in-progress", "other", { state: "in-progress", owner: "other", ownerName: "Dana", confirmedOn: "2026-09-24" }, "agent", evening)).toMatch(/future/);
    expect(workError("in-progress", "other", { state: "in-progress", owner: "other", ownerName: "Dana", confirmedOn: "2026-09-23" }, "agent", evening)).toBeNull();
  });
});

describe("workstream rules", () => {
  it("wants a name for someone else, a reason to block and a reason it does not apply", () => {
    expect(workError(null, null, { state: "waiting", owner: "other" }, "agent")).toMatch(/Name who/);
    expect(workError(null, null, { state: "blocked", owner: "agent" }, "agent")).toMatch(/what is blocking/);
    expect(workError(null, null, { state: "not-applicable", owner: "agent" }, "agent")).toMatch(/does not apply/);
  });

  it("counts confirmed items and names the open ones, blocked marked, without a percentage", () => {
    const vs = [
      view("inspection", [up(1, {}), up(2, { state: "confirmed", source: "ABC Inspections", confirmedOn: "2026-09-20" })]),
      view("financing", [up(1, {}), up(2, { state: "blocked", note: "Needs two more pay stubs", confirmedOn: "2026-09-22" })]),
      view("appraisal", [up(1, { state: "not-applicable", note: "Cash" })]),
      view("title", [up(1, {})]),
    ];
    expect(workSummary(vs)).toBe("1 of 3 confirmed. Still open: financing (blocked) and title.");
  });
});
