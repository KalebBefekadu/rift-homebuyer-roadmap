/**
 * The buying and selling process as a checklist that gets executed, for the
 * Operations mock-up (Blueprint v5 §8, D15).
 *
 * Kaleb's review of the second mock-up: the journey read like a set of notes,
 * where the process should be a system that runs, "like a checklist: an
 * automation, something the agent does, something a transaction coordinator
 * does and marks done." The product documents already say so and the mock-up
 * had not shown it:
 *
 *   - Every task names its owner: customer, agent, Rift, or outside
 *     professional (product.md, customer command center; vision.md principle 6),
 *     and one accountable person (journey-contracts.md §1).
 *   - The human transaction coordinator now works inside Rift (vision.md).
 *   - Canonical stages stay fixed; playbooks customise execution inside them,
 *     and each playbook runs manually, with approval, or automatically
 *     (product.md, Lifecycle Playbooks).
 *   - Internal preparation and reminders may run on their own; anything a
 *     client or outside party sees waits for the agent's approval (AUTO-01).
 *   - Some actions are the agent's in every mode: presenting an offer, sending
 *     an agreement, a price opinion, a legal or lending conclusion (product.md,
 *     autonomy settings).
 *   - Nothing is confirmed without a named party (rule 9), and a client saying
 *     "done" is a report, not a confirmation (UX-02).
 *
 * The steps come from the journey contracts (B01 to B20, S01 to S18), grouped
 * into the seven stages of lib/core/progress.ts. The ten workstreams under
 * contract are steps here too, each tied to its workstream, so the
 * Transactions grid and the checklist cannot disagree about one deal.
 *
 * Pure data and pure functions: no React, no I/O.
 */

import { STAGES, type Stage, type Workstream, type WorkState } from "@/lib/core/progress";
import { BUY_STEPS, SELL_STEPS, DOER_LABEL, type Step } from "@/lib/core/checklist";

/* The steps themselves are the product's (lib/core/checklist.ts), so the
   mock-up and the built journey cannot drift apart. What stays here is the
   mock-up's own: made-up names and how its made-up journeys stand. */
export { BUY_STEPS as BUY_PLAYBOOK, SELL_STEPS as SELL_PLAYBOOK, DOER_LABEL } from "@/lib/core/checklist";
export type { Doer, RiftMode, Step } from "@/lib/core/checklist";

/** The coordinator in the made-up business. */
export const COORDINATOR = "Meron";

export const playbookFor = (side: "buy" | "sell") => (side === "buy" ? BUY_STEPS : SELL_STEPS);

/* ------------------------------------------------------------------ *
 * A step on one journey
 * ------------------------------------------------------------------ */

/** Rule 10: each has an icon and a word on screen. "ready" is prepared by Rift and waiting for you. */
export type StepState = "todo" | "doing" | "ready" | "waiting" | "reported" | "blocked" | "done" | "skip";

export const STEP_WORD: Record<StepState, string> = {
  todo: "To do",
  doing: "In progress",
  ready: "Ready for you",
  waiting: "Waiting",
  reported: "Reported, not confirmed",
  blocked: "Blocked",
  done: "Done",
  skip: "Not needed",
};

export interface StepMark {
  state: StepState;
  /** Who did it, or who confirmed it (rule 9). */
  by?: string;
  on?: string;
  note?: string;
  due?: string;
}

/** The workstream's own words, carried onto its step, so one deal reads the same in both places. */
const FROM_WORK: Record<WorkState, StepState> = {
  "not-started": "todo", "in-progress": "doing", waiting: "waiting", blocked: "blocked",
  reported: "reported", confirmed: "done", "not-applicable": "skip",
};

export interface JourneyForSteps {
  side: "buy" | "sell";
  stage: Stage;
  household: { name: string }[];
  story: { stage: Stage; at: string }[];
  work?: { stream: Workstream; state: WorkState; note?: string; due?: string; word?: string }[];
  checks?: Record<string, StepMark>;
}

/** Who did a step when the record only says it was done: the doer, or who confirms it. */
function doneBy(step: Step, j: JourneyForSteps): string {
  if (step.confirms) return step.confirms;
  if (step.doer === "client") return j.household.map((h) => h.name.split(" ")[0]).join(" and ");
  if (step.doer === "tc") return COORDINATOR;
  if (step.doer === "pro") return step.pro ?? "Outside pro";
  return DOER_LABEL[step.doer];
}

/**
 * Every step of the journey's checklist with where it stands.
 *
 * A stage the client has passed is done unless the journey says otherwise.
 * The client cannot be past a stage with its steps open, but stages are not a
 * wizard: a step there can still be recorded as not needed. A workstream step
 * takes the workstream's state and last word, whatever stage it sits in.
 */
export function stepsFor(j: JourneyForSteps): { step: Step; mark: StepMark }[] {
  const now = STAGES.indexOf(j.stage);
  return playbookFor(j.side).map((step) => {
    const w = step.stream ? j.work?.find((x) => x.stream === step.stream) : undefined;
    if (w) {
      const [who, on] = (w.word ?? "").split(", ");
      return {
        step,
        mark: { state: FROM_WORK[w.state], note: w.note, due: w.due, ...(w.state === "confirmed" ? { by: who, on } : {}) },
      };
    }
    const set = j.checks?.[step.id];
    if (set) return { step, mark: set };
    if (STAGES.indexOf(step.stage) < now) {
      return { step, mark: { state: "done", by: doneBy(step, j), on: j.story.find((x) => x.stage === step.stage)?.at } };
    }
    return { step, mark: { state: "todo" } };
  });
}

/** Still open: to do, in progress, ready, waiting, reported or blocked. */
export const isOpen = (s: StepState) => s !== "done" && s !== "skip";
