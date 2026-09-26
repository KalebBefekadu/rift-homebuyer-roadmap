import { describe, expect, it } from "vitest";
import { JOURNEYS } from "@/lib/prototype/ops-mock";
import { BUY_PLAYBOOK, SELL_PLAYBOOK, isOpen, playbookFor, stepsFor } from "@/lib/prototype/ops-playbook";
import { STAGES, WORKSTREAMS } from "./progress";

/* The journey as a checklist that gets executed (Kaleb's review of the second
   mock-up). The product's rules about who may do what are what make it a
   system rather than a to-do list, so they are checked here, not left to
   the screen. */
describe("the buying and selling checklists", () => {
  const both = [...BUY_PLAYBOOK, ...SELL_PLAYBOOK];

  it("has steps in all seven stages, on both sides", () => {
    for (const book of [BUY_PLAYBOOK, SELL_PLAYBOOK]) {
      expect(new Set(book.map((s) => s.stage))).toEqual(new Set(STAGES));
    }
  });

  it("traces every step to a journey contract, once", () => {
    for (const s of both) expect(s.ref, s.id).toMatch(/^[BS]\d\d$/);
    expect(new Set(both.map((s) => s.id)).size).toBe(both.length);
  });

  it("never lets Rift send anything a client or outside party sees on its own (AUTO-01)", () => {
    for (const s of both.filter((x) => x.doer === "rift")) {
      expect(s.mode, s.id).toBeDefined();
      if (s.external) expect(s.mode, s.id).toBe("approve");
    }
  });

  it("keeps agreements, offer presentation and price opinions with the agent in every mode", () => {
    const kept = both.filter((s) => s.protected);
    for (const s of kept) expect(s.doer, s.id).toBe("you");
    expect(kept.map((s) => s.id).sort()).toEqual(["b-agree-send", "s-agree-send", "s-present", "s-price"]);
  });

  it("settles each of the ten workstreams with exactly one buyer step", () => {
    for (const w of WORKSTREAMS) expect(BUY_PLAYBOOK.filter((s) => s.stream === w).map((s) => s.id), w).toHaveLength(1);
  });

  it("names the professional behind every outside step, and who confirms it (rule 9)", () => {
    for (const s of both.filter((x) => x.doer === "pro")) {
      expect(s.pro, s.id).toBeTruthy();
      expect(s.confirms, s.id).toBeTruthy();
    }
  });
});

describe("each journey's checklist in the mock-up", () => {
  it("only records steps that are on the journey's checklist", () => {
    for (const j of JOURNEYS) {
      const ids = new Set(playbookFor(j.side).map((s) => s.id));
      for (const id of Object.keys(j.checks ?? {})) expect(ids.has(id), `${j.id} ${id}`).toBe(true);
    }
  });

  it("has nothing open in a stage the client has passed, and nothing done in one they have not reached", () => {
    for (const j of JOURNEYS) {
      const now = STAGES.indexOf(j.stage);
      for (const { step, mark } of stepsFor(j)) {
        const at = STAGES.indexOf(step.stage);
        if (at < now) expect(isOpen(mark.state), `${j.id} ${step.id}`).toBe(false);
        if (at > now) expect(mark.state, `${j.id} ${step.id}`).not.toBe("done");
      }
    }
  });

  it("says who did every done step and when (rule 9)", () => {
    for (const j of JOURNEYS) for (const { step, mark } of stepsFor(j)) {
      if (mark.state !== "done") continue;
      expect(mark.by, `${j.id} ${step.id}`).toBeTruthy();
      expect(mark.on, `${j.id} ${step.id}`).toBeTruthy();
    }
  });

  it("leaves something open where every client is now", () => {
    for (const j of JOURNEYS) {
      expect(stepsFor(j).some(({ step, mark }) => step.stage === j.stage && isOpen(mark.state)), j.id).toBe(true);
    }
  });

  it("gives the coordinator something to do, so the list on Today is not empty", () => {
    const open = JOURNEYS.flatMap((j) => stepsFor(j).filter(({ step, mark }) =>
      step.doer === "tc" && isOpen(mark.state) && STAGES.indexOf(step.stage) <= STAGES.indexOf(j.stage)));
    expect(open.length).toBeGreaterThan(0);
  });
});
