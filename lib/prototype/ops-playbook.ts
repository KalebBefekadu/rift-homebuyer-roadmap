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

/** Who does a step. "tc" is the transaction coordinator. */
export type Doer = "rift" | "you" | "tc" | "client" | "pro";

/** How Rift runs a step: on its own, or prepared and waiting for the agent. */
export type RiftMode = "auto" | "approve";

export interface Step {
  id: string;
  stage: Stage;
  title: string;
  doer: Doer;
  /** For Rift's steps. */
  mode?: RiftMode;
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

/** The coordinator in the made-up business. */
export const COORDINATOR = "Meron";

const B = (stage: Stage, ref: string, id: string, title: string, doer: Doer, more: Partial<Step> = {}): Step =>
  ({ id: `b-${id}`, stage, ref, title, doer, ...more });
const S = (stage: Stage, ref: string, id: string, title: string, doer: Doer, more: Partial<Step> = {}): Step =>
  ({ id: `s-${id}`, stage, ref, title, doer, ...more });

export const BUY_PLAYBOOK: Step[] = [
  B("prepare", "B01", "summary", "Summarise what they did before the first call", "rift", { mode: "auto" }),
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
  B("under-contract", "B11", "chase", "Tell you or Meron when an outside party has gone quiet for 7 days", "rift", { mode: "auto" }),

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

export const SELL_PLAYBOOK: Step[] = [
  S("prepare", "S01", "summary", "Summarise their selling plan before the first call", "rift", { mode: "auto" }),
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

  S("offer", "S10", "receive", "Receive every offer and read its PDF; never discard one", "rift", { mode: "auto" }),
  S("offer", "S10", "check", "Check each offer's terms against its PDF", "you"),
  S("offer", "S10", "compare", "Work out what each offer leaves the seller, after costs", "rift", { mode: "auto" }),
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

export const playbookFor = (side: "buy" | "sell") => (side === "buy" ? BUY_PLAYBOOK : SELL_PLAYBOOK);

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
