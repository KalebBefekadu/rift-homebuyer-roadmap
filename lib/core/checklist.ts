/**
 * The journey as a checklist that gets executed (Blueprint v5 §8.6; Kaleb,
 * review of the second Operations mock-up: "not a note, a system that should
 * be executed like a checklist: an automation, a task the agent does, a task
 * a transaction coordinator does and marks done").
 *
 * Each stage of lib/core/progress.ts holds steps taken from the journey
 * contracts (B01 to B20, S01 to S18), and every step names who does it:
 * Rift, the agent, the coordinator, the client, or an outside professional
 * (product.md: every task names its owner; journey-contracts.md §1: one
 * accountable person).
 *
 * Three things keep it honest rather than decorative:
 *
 *   A step Rift cannot do yet is the agent's. The mock-up showed Rift
 *     preparing kickoffs and reading contracts; almost none of that exists,
 *     and "Rift does it" beside something nobody does is the "Rift is
 *     watching" claim UX-04 forbids without a live monitor. `live` says which
 *     Rift steps really run today; the rest show as the agent's, "until Rift
 *     can".
 *
 *   Nothing is done without a named party and a day (rule 9). A step
 *     someone else must confirm asks who confirmed it. A client's word is a
 *     report, not a confirmation (UX-02). A stage the journey has passed is
 *     not assumed done: its unrecorded steps say "not recorded".
 *
 *   The ten workstreams under contract are steps too, and their state is
 *     the workstream's. They are updated in one place (Where it stands), so
 *     the checklist and Transactions cannot disagree about one deal.
 *
 * Marks are history, like every other record on a journey: a step is undone
 * by recording that it was reopened, with a reason (journey-contracts §1:
 * undo is a compensating event).
 *
 * Pure, like every rule in lib/core. lib/db/checklist.ts is the only writer.
 */

import { STAGES, marketDay, type Stage, type Workstream, type WorkState } from "./progress";

/** Who does a step. "tc" is the transaction coordinator. */
export type Doer = "rift" | "you" | "tc" | "client" | "pro";

/** How Rift runs a step: on its own (internal only), or prepared for the agent's approval. */
export type RiftMode = "auto" | "approve";

export interface Step {
  id: string;
  stage: Stage;
  title: string;
  doer: Doer;
  mode?: RiftMode;
  /** For Rift's steps: it really runs today. Otherwise it is the agent's until it does. */
  live?: boolean;
  /** The outside professional, for doer "pro": "Lender", "Closing attorney". */
  pro?: string;
  /** Who has to say it happened before it counts as done (rule 9), when that is not whoever did it. */
  confirms?: string;
  /** A client or an outside party sees it, so Rift may only prepare it (AUTO-01). */
  external?: boolean;
  /** The agent's in every autonomy mode; no setting hands it to anyone else. */
  protected?: boolean;
  /** Under contract: the workstream this step settles. Its state is the workstream's. */
  stream?: Workstream;
  /** The journey contract it comes from, so the step can be traced back. */
  ref: string;
}

export const DOER_LABEL: Record<Doer, string> = {
  rift: "Rift",
  you: "You",
  tc: "Coordinator",
  client: "Client",
  pro: "Outside pro",
};

const B = (stage: Stage, ref: string, id: string, title: string, doer: Doer, more: Partial<Step> = {}): Step =>
  ({ id: `b-${id}`, stage, ref, title, doer, ...more });
const S = (stage: Stage, ref: string, id: string, title: string, doer: Doer, more: Partial<Step> = {}): Step =>
  ({ id: `s-${id}`, stage, ref, title, doer, ...more });

export const BUY_STEPS: Step[] = [
  B("prepare", "B01", "summary", "Summarise what they did before the first call", "rift", { mode: "auto", live: true }),
  B("prepare", "B01", "call", "First call: goals, timing, who decides", "you"),
  B("prepare", "B01", "plan", "Turn the call notes into their plan", "rift", { mode: "approve", external: true }),
  B("prepare", "B02", "agree-prep", "Prepare the buyer agreement in Remine", "tc"),
  B("prepare", "B02", "agree-send", "Send the buyer agreement for signature", "you", { protected: true, external: true }),
  B("prepare", "B02", "agree-sign", "Sign the buyer agreement", "client", { confirms: "E-signature record" }),
  B("prepare", "B01", "household", "Invite the household and set who sees what", "tc"),
  B("prepare", "B03", "preapproval", "Pre-approval letter", "pro", { pro: "Lender", confirms: "Lender" }),

  B("search", "B04", "priorities", "Say what is a must and what is a nice-to-have", "client"),
  B("search", "B04", "brief", "Review the search brief", "you"),
  B("search", "B04", "matrix", "Set up the saved search in Matrix", "tc", { confirms: "Matrix" }),
  B("search", "B05", "matrix-watch", "Check each morning that the search ran; flag any change they ask for", "rift", { mode: "auto" }),

  B("tour", "B05", "react", "React to the homes on the shortlist", "client"),
  B("tour", "B06", "tour-book", "Book the showings", "tc", { confirms: "Listing agent" }),
  B("tour", "B06", "tour-plan", "Send the tour plan and reminders", "rift", { mode: "approve", external: true }),
  B("tour", "B06", "feedback", "Say what they thought after each showing", "client"),
  B("tour", "B07", "facts", "Gather the facts on a home they are serious about, and what is unknown", "rift", { mode: "auto" }),
  B("tour", "B07", "before", "Before-you-offer review with them", "you"),

  B("offer", "B08", "strategy", "Agree the offer: price, terms, what to ask for", "you"),
  B("offer", "B09", "offer-prep", "Prepare the offer in Remine; check parties and exhibits", "tc"),
  B("offer", "B09", "offer-sign", "Sign the offer", "client", { confirms: "E-signature record" }),
  B("offer", "B09", "offer-send", "Deliver the offer to the listing agent", "you", { external: true }),
  B("offer", "B10", "offer-watch", "Watch the response deadline; remind you two hours before", "rift", { mode: "auto" }),
  B("offer", "B10", "offer-bind", "Confirm it is binding: signed by both sides and delivered", "you", { confirms: "Listing agent" }),

  B("under-contract", "B11", "uc-read", "Read the signed contract into dates and tasks", "rift", { mode: "approve" }),
  B("under-contract", "B11", "uc-dates", "Check every date against the signed contract", "you"),
  B("under-contract", "B11", "uc-kickoff", "Send the under-contract kickoff to the buyers and lender", "rift", { mode: "approve", external: true }),
  B("under-contract", "B12", "em", "Earnest money to the holder", "client", { confirms: "Closing attorney", stream: "earnest-money" }),
  B("under-contract", "B13", "inspect-book", "Book the inspection", "tc"),
  B("under-contract", "B14", "inspect", "Inspection findings: what to ask the seller for", "you", { confirms: "Listing agent", stream: "inspection" }),
  B("under-contract", "B15", "appraisal", "Appraisal ordered and done", "pro", { pro: "Lender", confirms: "Lender", stream: "appraisal" }),
  B("under-contract", "B15", "loan", "Loan approval, through to clear to close", "pro", { pro: "Lender", confirms: "Lender", stream: "financing" }),
  B("under-contract", "B16", "title", "Title search, and clear title", "pro", { pro: "Closing attorney", confirms: "Closing attorney", stream: "title" }),
  /* Live: a workstream with no word for STALE_DAYS says so on the journey and on Today. */
  B("under-contract", "B11", "chase", "Tell you when an outside party has gone quiet for 7 days", "rift", { mode: "auto", live: true }),

  B("close", "B16", "insurance", "Homeowner's insurance the lender accepts", "client", { confirms: "Lender", stream: "insurance" }),
  B("close", "B14", "repairs", "Agreed repairs done, with receipts", "pro", { pro: "Listing agent", confirms: "Listing agent", stream: "repairs" }),
  B("close", "B16", "settle", "Settlement statement", "pro", { pro: "Closing attorney", confirms: "Closing attorney" }),
  B("close", "B16", "settle-check", "Check the settlement statement against the contract", "tc"),
  B("close", "B18", "wire", "Send the closing instructions and the wire-fraud warning", "rift", { mode: "approve", external: true }),
  B("close", "B17", "walk", "Final walkthrough against the agreed repairs", "you", { stream: "walkthrough" }),
  B("close", "B18", "closing", "Closing: signed, funded, recorded", "pro", { pro: "Closing attorney", confirms: "Closing attorney", stream: "closing" }),
  B("close", "B18", "keys", "Hand over the keys", "you", { stream: "possession" }),

  B("own", "B19", "handoff", "Send the home handoff: utilities, address change, their documents", "rift", { mode: "approve", external: true }),
  B("own", "B19", "two-weeks", "Two weeks after move-in: ask how it went, then for a review", "rift", { mode: "approve", external: true }),
  B("own", "B19", "homestead", "Homestead exemption reminder, before the county's deadline", "rift", { mode: "approve", external: true }),
  B("own", "B20", "year", "One year in their home: a note from you", "rift", { mode: "approve", external: true }),
];

/** The seller's checklist: specified now, used when the seller journey is built (v5 §9, D08). */
export const SELL_STEPS: Step[] = [
  S("prepare", "S01", "summary", "Summarise their selling plan before the first call", "rift", { mode: "auto", live: true }),
  S("prepare", "S01", "call", "First call: timing, priorities, where they move next", "you"),
  S("prepare", "S02", "record", "Pull the property record: county, HOA, permits", "tc"),
  S("prepare", "S03", "agree-prep", "Prepare the listing agreement in Remine", "tc"),
  S("prepare", "S03", "agree-send", "Send the listing agreement for signature", "you", { protected: true, external: true }),
  S("prepare", "S03", "agree-sign", "Sign the listing agreement", "client", { confirms: "E-signature record" }),
  S("prepare", "S03", "disclosure", "Fill in the seller's property disclosure", "client"),
  S("prepare", "S04", "price", "Your price opinion, from comparables you choose", "you", { protected: true }),
  S("prepare", "S05", "ready", "Get the home ready: the agreed fixes", "client"),

  S("search", "S06", "photos", "Book photos and measurements", "tc", { confirms: "Photographer" }),
  S("search", "S06", "copy", "Draft the listing description", "rift", { mode: "approve" }),
  S("search", "S06", "listing-check", "Check the listing facts and photos", "client"),
  S("search", "S07", "publish", "Publish the listing in the MLS", "you", { external: true, confirms: "MLS" }),
  S("search", "S07", "live", "Check the listing is live and reads correctly", "rift", { mode: "auto" }),

  S("tour", "S08", "showings", "Confirm showing requests in ShowingTime", "tc"),
  S("tour", "S08", "feedback", "Collect showing feedback, and count who never answered", "rift", { mode: "auto" }),
  S("tour", "S09", "weekly", "Weekly update to the seller: showings, feedback, what is unknown", "rift", { mode: "approve", external: true }),
  S("tour", "S09", "strategy", "Weekly strategy check with the seller", "you"),

  /* Live: the offer page takes every offer, and the offers are ranked by what reaches the seller. */
  S("offer", "S10", "receive", "Receive every offer and read its PDF; never discard one", "rift", { mode: "auto", live: true }),
  S("offer", "S10", "check", "Check each offer's terms against its PDF", "you"),
  S("offer", "S10", "compare", "Work out what each offer leaves the seller, after costs", "rift", { mode: "auto", live: true }),
  S("offer", "S10", "present", "Present every offer to the seller", "you", { protected: true, external: true }),
  S("offer", "S11", "decide", "Decide: accept, counter or decline", "client"),
  S("offer", "S11", "counter", "Prepare the counter or acceptance in Remine", "tc"),
  S("offer", "S11", "bind", "Confirm it is binding: signed by both sides and delivered", "you", { confirms: "Buyer's agent" }),

  S("under-contract", "S12", "uc-read", "Read the signed contract into dates and tasks", "rift", { mode: "approve" }),
  S("under-contract", "S12", "uc-dates", "Check every date against the signed contract", "you"),
  S("under-contract", "S12", "em", "Confirm the buyer's earnest money reached the holder", "tc", { confirms: "Closing attorney" }),
  S("under-contract", "S13", "requests", "Go through the buyer's repair requests with the seller", "you"),
  S("under-contract", "S14", "buyer-loan", "Appraisal and the buyer's loan, from their side", "pro", { pro: "Buyer's lender", confirms: "Buyer's agent" }),
  S("under-contract", "S14", "title", "Title and payoff", "pro", { pro: "Closing attorney", confirms: "Closing attorney" }),

  S("close", "S16", "proceeds", "Check the settlement statement against the estimate", "tc"),
  S("close", "S15", "repairs", "Finish the agreed repairs and keep the receipts", "client"),
  S("close", "S15", "move", "Move out; leave the keys and codes", "client"),
  S("close", "S17", "closing", "Closing: signed, funded, recorded", "pro", { pro: "Closing attorney", confirms: "Closing attorney" }),

  S("own", "S18", "records", "Send their records and the final figures", "rift", { mode: "approve", external: true }),
  S("own", "S18", "next", "Ask about the next home; link a buying journey if there is one", "you"),
  S("own", "S18", "two-weeks", "Two weeks on: how did it go, then a review", "rift", { mode: "approve", external: true }),
];

export const stepsFor = (side: "buy" | "sell") => (side === "buy" ? BUY_STEPS : SELL_STEPS);
export const stepById = (side: "buy" | "sell", id: string) => stepsFor(side).find((s) => s.id === id);

/* ------------------------------------------------------------------ *
 * Marks: what the agent records against a step
 * ------------------------------------------------------------------ */

/**
 * done        it happened; who did or confirmed it, and the day (rule 9)
 * reported    someone says it happened, and nobody who can confirm it has (UX-02)
 * not-needed  it does not apply here, and why
 * reopened    a mark was wrong or things changed; the step is open again, and why
 */
export type MarkState = "done" | "reported" | "not-needed" | "reopened";
export const MARK_STATES: MarkState[] = ["done", "reported", "not-needed", "reopened"];

export interface StepMark {
  seq: number;
  state: MarkState;
  /** Who did it, confirmed it, or says it happened: "Priya Nair, the lender". */
  byName: string | null;
  /** The day it happened (YYYY-MM-DD), which may be before it was recorded. */
  doneOn: string | null;
  note: string | null;
  /** Who recorded it, and when. */
  by: string;
  at: string;
}

export interface MarkInput {
  state: MarkState;
  byName?: string | null;
  doneOn?: string | null;
  note?: string | null;
}

export const NAME_MAX = 160;
export const NOTE_MAX = 500;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Why a mark may not be recorded, or null. `current` is the step's state as
 * the checklist shows it now.
 */
export function markError(step: Step, current: StepState, input: MarkInput, today = new Date()): string | null {
  if (step.stream) return "This one follows its workstream: update it under Where it stands";
  if (!MARK_STATES.includes(input.state)) return "Choose what happened";
  const byName = input.byName?.trim() ?? "";
  const note = input.note?.trim() ?? "";
  if (byName.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters`;
  if (note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters`;
  if (input.doneOn) {
    if (!ISO_DAY.test(input.doneOn) || Number.isNaN(Date.parse(input.doneOn))) return "That date could not be read";
    if (input.doneOn > marketDay(today)) return "It cannot have happened in the future";
  }
  switch (input.state) {
    case "done":
      if (current === "done") return "This is already done";
      if (!byName) return step.confirms ? `Say who confirmed it, like "${step.confirms}"` : "Say who did it";
      if (!input.doneOn) return "Give the day it happened";
      return null;
    case "reported":
      if (!step.confirms) return "Nobody else has to confirm this one: mark it done";
      if (current === "done" || current === "reported") return "This is already recorded";
      if (!byName) return "Say who says it is done";
      return null;
    case "not-needed":
      if (current === "skip") return "This is already marked as not needed";
      if (!note) return "Say why it does not apply";
      return null;
    case "reopened":
      if (!["done", "reported", "skip"].includes(current)) return "Only a recorded step can be reopened";
      if (!note) return "Say why it is open again";
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * The checklist as shown
 * ------------------------------------------------------------------ */

/** Rule 10: each has an icon and a word on screen. */
export type StepState = "todo" | "doing" | "waiting" | "reported" | "blocked" | "done" | "skip" | "not-recorded";

export const STEP_STATE_LABEL: Record<StepState, string> = {
  todo: "To do",
  doing: "Under way",
  waiting: "Waiting",
  reported: "Reported, not confirmed",
  blocked: "Blocked",
  done: "Done",
  skip: "Not needed",
  "not-recorded": "Not recorded",
};

export const isOpen = (s: StepState) => s !== "done" && s !== "skip";

const FROM_WORK: Record<WorkState, StepState> = {
  "not-started": "todo", "in-progress": "doing", waiting: "waiting", blocked: "blocked",
  reported: "reported", confirmed: "done", "not-applicable": "skip",
};

export interface WorkForChecklist {
  workstream: Workstream;
  state: WorkState;
  lastWord: { on: string; from: string } | null;
  note: string | null;
}

export interface StepView {
  step: Step;
  /** Who does it now: a Rift step that does not run yet is the agent's. */
  doer: Doer;
  /** "until Rift can", when Rift is meant to and cannot yet. */
  doerNote: string | null;
  state: StepState;
  by: string | null;
  on: string | null;
  note: string | null;
  /** The state is the workstream's, and is changed there. */
  fromWorkstream: boolean;
  /** The marks behind it, oldest first. */
  history: StepMark[];
}

/**
 * Every step of the journey's checklist with where it stands.
 *
 * `work` is the open contract's workstreams, or null with none. A workstream
 * step with no contract is to do (or not recorded, in a passed stage).
 */
export function checklist(side: "buy" | "sell", stage: Stage, marks: Map<string, StepMark[]>, work: WorkForChecklist[] | null): StepView[] {
  const now = STAGES.indexOf(stage);
  return stepsFor(side).map((step) => {
    const planned = step.doer === "rift" && !step.live;
    const doer: Doer = planned ? "you" : step.doer;
    const doerNote = planned ? "until Rift can" : null;
    const history = [...(marks.get(step.id) ?? [])].sort((a, b) => a.seq - b.seq);
    const passed = STAGES.indexOf(step.stage) < now;
    const base = { step, doer, doerNote, history };

    const w = step.stream ? work?.find((x) => x.workstream === step.stream) : undefined;
    if (w) {
      const state = FROM_WORK[w.state];
      return {
        ...base, state, fromWorkstream: true,
        by: w.lastWord?.from ?? null, on: w.lastWord?.on ?? null, note: w.note,
      };
    }

    const latest = history[history.length - 1];
    /* A Rift step that really runs is running from the stage it belongs to:
       nobody ticks a monitor. */
    if (step.doer === "rift" && step.live && !latest && STAGES.indexOf(step.stage) <= now) {
      return { ...base, state: "doing" as StepState, fromWorkstream: false, by: null, on: null, note: "Runs on its own" };
    }
    if (latest && latest.state !== "reopened") {
      const state: StepState = latest.state === "done" ? "done" : latest.state === "reported" ? "reported" : "skip";
      return { ...base, state, fromWorkstream: Boolean(step.stream), by: latest.byName, on: latest.doneOn, note: latest.note };
    }
    return {
      ...base, fromWorkstream: Boolean(step.stream),
      state: passed ? "not-recorded" : "todo",
      by: null, on: null, note: latest?.state === "reopened" ? `Reopened: ${latest.note}` : null,
    };
  });
}
