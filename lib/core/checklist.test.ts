import { describe, expect, it } from "vitest";
import { BUY_STEPS, SELL_STEPS, assignableTo, assignmentError, checklist, markError, recordError, stepById, type Assignable, type StepMark } from "./checklist";
import { STAGES, WORKSTREAMS } from "./progress";

const mark = (seq: number, state: StepMark["state"], more: Partial<StepMark> = {}): StepMark =>
  ({ seq, state, byName: null, doneOn: null, note: null, by: "Kaleb", at: "2026-09-20T12:00:00Z", ...more });
const TODAY = new Date("2026-09-26T15:00:00Z");

describe("the checklists", () => {
  const both = [...BUY_STEPS, ...SELL_STEPS];

  it("have steps in all seven stages on both sides, each traced to a journey contract, once", () => {
    for (const book of [BUY_STEPS, SELL_STEPS]) expect(new Set(book.map((s) => s.stage))).toEqual(new Set(STAGES));
    for (const s of both) expect(s.ref, s.id).toMatch(/^[BS]\d\d$/);
    expect(new Set(both.map((s) => s.id)).size).toBe(both.length);
    /* The database checks the same shape; a step id it refuses is a step nobody can tick. */
    for (const s of both) expect(s.id, s.id).toMatch(/^[bs]-[a-z0-9-]{1,40}$/);
  });

  it("never let Rift send what a client or outside party sees on its own (AUTO-01)", () => {
    for (const s of both.filter((x) => x.doer === "rift")) {
      expect(s.mode, s.id).toBeDefined();
      if (s.external) expect(s.mode, s.id).toBe("approve");
    }
  });

  it("keep agreements, offer presentation and price opinions with the agent", () => {
    const kept = both.filter((s) => s.protected);
    for (const s of kept) expect(s.doer, s.id).toBe("you");
    expect(kept.map((s) => s.id).sort()).toEqual(["b-agree-send", "s-agree-send", "s-present", "s-price"]);
  });

  it("settle each of the ten workstreams with exactly one buyer step", () => {
    for (const w of WORKSTREAMS) expect(BUY_STEPS.filter((s) => s.stream === w), w).toHaveLength(1);
  });

  it("name the professional behind every outside step, and who confirms it (rule 9)", () => {
    for (const s of both.filter((x) => x.doer === "pro")) {
      expect(s.pro, s.id).toBeTruthy();
      expect(s.confirms, s.id).toBeTruthy();
    }
  });
});

describe("where each step stands", () => {
  it("gives the agent every Rift step that does not run yet, and says so (UX-04)", () => {
    const view = checklist("buy", "prepare", new Map(), null);
    const plan = view.find((v) => v.step.id === "b-plan")!;
    expect(plan.doer).toBe("you");
    expect(plan.doerNote).toBe("until Rift can");
    const summary = view.find((v) => v.step.id === "b-summary")!;
    expect(summary.doer).toBe("rift");
    expect(summary.doerNote).toBeNull();
  });

  it("shows a Rift step that really runs as running, with nothing to tick", () => {
    const chase = checklist("buy", "close", new Map(), null).find((v) => v.step.id === "b-chase")!;
    expect(chase).toMatchObject({ state: "doing", note: "Runs on its own", doer: "rift" });
    expect(checklist("buy", "prepare", new Map(), null).find((v) => v.step.id === "b-chase")!.state).toBe("todo");
  });

  it("does not assume a passed stage was done: its unrecorded steps say so", () => {
    const view = checklist("buy", "tour", new Map(), null);
    expect(view.find((v) => v.step.id === "b-call")!.state).toBe("not-recorded");
    expect(view.find((v) => v.step.id === "b-react")!.state).toBe("todo");
    expect(view.find((v) => v.step.id === "b-strategy")!.state).toBe("todo");
  });

  it("takes a workstream step's state and last word from the workstream", () => {
    const view = checklist("buy", "under-contract", new Map(), [
      { workstream: "appraisal", state: "confirmed", lastWord: { on: "2026-09-22", from: "Priya Nair, the lender" }, note: "At value" },
      { workstream: "title", state: "blocked", lastWord: null, note: "A 2019 lien is still recorded" },
    ]);
    const appraisal = view.find((v) => v.step.id === "b-appraisal")!;
    expect(appraisal).toMatchObject({ state: "done", by: "Priya Nair, the lender", on: "2026-09-22", fromWorkstream: true });
    expect(view.find((v) => v.step.id === "b-title")!.state).toBe("blocked");
  });

  it("reads the latest mark, and a reopened step is open again with the reason", () => {
    const marks = new Map([["b-call", [
      mark(1, "done", { byName: "Kaleb", doneOn: "2026-09-10" }),
      mark(2, "reopened", { note: "They want a second call with both of them" }),
    ]]]);
    const call = checklist("buy", "prepare", marks, null).find((v) => v.step.id === "b-call")!;
    expect(call.state).toBe("todo");
    expect(call.note).toContain("second call");
    expect(call.history).toHaveLength(2);
  });
});

describe("recording a step", () => {
  const call = stepById("buy", "b-call")!;
  const preapproval = stepById("buy", "b-preapproval")!;
  const appraisal = stepById("buy", "b-appraisal")!;

  it("needs who did it and the day, never a future day (rule 9)", () => {
    expect(markError(call, "todo", { state: "done" }, TODAY)).toBe("Say who did it");
    expect(markError(call, "todo", { state: "done", byName: "Kaleb" }, TODAY)).toBe("Give the day it happened");
    expect(markError(call, "todo", { state: "done", byName: "Kaleb", doneOn: "2026-09-30" }, TODAY)).toMatch(/future/);
    expect(markError(call, "todo", { state: "done", byName: "Kaleb", doneOn: "2026-09-26" }, TODAY)).toBeNull();
  });

  it("asks who confirmed it when someone else has to", () => {
    expect(markError(preapproval, "todo", { state: "done", doneOn: "2026-09-26" }, TODAY)).toBe('Say who confirmed it, like "Lender"');
  });

  it("records a client's or anyone's say-so as reported, only where confirming is someone else's (UX-02)", () => {
    expect(markError(preapproval, "todo", { state: "reported", byName: "Selam" }, TODAY)).toBeNull();
    expect(markError(call, "todo", { state: "reported", byName: "Selam" }, TODAY)).toMatch(/mark it done/);
  });

  it("leaves workstream steps to their workstream: one place to change one deal", () => {
    expect(markError(appraisal, "todo", { state: "done", byName: "Lender", doneOn: "2026-09-26" }, TODAY)).toMatch(/Where it stands/);
  });

  it("wants a reason to skip or reopen, and only reopens what was recorded", () => {
    expect(markError(call, "todo", { state: "not-needed" }, TODAY)).toBe("Say why it does not apply");
    expect(markError(call, "todo", { state: "reopened", note: "x" }, TODAY)).toMatch(/Only a recorded step/);
    expect(markError(call, "done", { state: "reopened" }, TODAY)).toBe("Say why it is open again");
    expect(markError(call, "done", { state: "reopened", note: "Wrong person" }, TODAY)).toBeNull();
  });
});

describe("who does each step, as the agent sets it", () => {
  const both = [...BUY_STEPS, ...SELL_STEPS];

  it("never hands away a protected step, or the client's or a professional's", () => {
    for (const s of both.filter((x) => x.protected || x.doer === "client" || x.doer === "pro")) expect(assignableTo(s), s.id).toEqual([]);
    expect(assignmentError(stepById("buy", "b-agree-send"), "tc")).toMatch(/stays yours/);
  });

  it("offers Rift only for the steps Rift was designed for (UX-04)", () => {
    expect(assignmentError(stepById("buy", "b-call"), "rift")).toMatch(/nothing built/);
    const riftStep = BUY_STEPS.find((s) => s.doer === "rift")!;
    expect(assignableTo(riftStep)).toContain("rift");
  });

  it("gives a step to the coordinator, and says it was changed", () => {
    const view = checklist("buy", "prepare", new Map(), null, new Map<string, Assignable>([["b-call", "tc"]]));
    expect(view.find((v) => v.step.id === "b-call")).toMatchObject({ doer: "tc", assigned: true });
    expect(view.find((v) => v.step.id === "b-plan")).toMatchObject({ assigned: false });
  });

  it("keeps a Rift step that does not run yet with its new owner, not \"until Rift can\"", () => {
    const planned = BUY_STEPS.find((s) => s.doer === "rift" && !s.live)!;
    const view = checklist("buy", planned.stage, new Map(), null, new Map<string, Assignable>([[planned.id, "tc"]]));
    expect(view.find((v) => v.step.id === planned.id)).toMatchObject({ doer: "tc", doerNote: null });
  });

  it("ignores a stored assignment the step does not allow", () => {
    const view = checklist("buy", "prepare", new Map(), null, new Map<string, Assignable>([["b-agree-send", "tc"]]));
    expect(view.find((v) => v.step.id === "b-agree-send")).toMatchObject({ doer: "you", assigned: false });
  });

  it("lets a coordinator record only the coordinator's steps", () => {
    const view = checklist("buy", "prepare", new Map(), null);
    const tcStep = view.find((v) => v.doer === "tc")!;
    const yours = view.find((v) => v.doer === "you" && !v.step.protected)!;
    expect(recordError(tcStep, "coordinator")).toBeNull();
    expect(recordError(yours, "coordinator")).toMatch(/not assigned/);
    expect(recordError(yours, "agent")).toBeNull();
  });
});
