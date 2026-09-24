/**
 * Where a journey is, and what is under way (blueprint v4, W07; REQ-STATE-01
 * to 06, REQ-UX-02 to 04; journey contracts B11 to B16).
 *
 * Three records, each history rather than a field that gets overwritten:
 *
 *   STAGE and STATUS. Stage is where the buying is (Prepare, Search, Tour &
 *     evaluate, Offer, Under contract, Close, Own); status is whether the
 *     journey is going at all (active, paused, completed, cancelled). They are
 *     separate because pausing the search does not pause a contract. Each
 *     change is an event with a reason and the person who recorded it, and
 *     the current value is the latest event. Nothing moves a stage on its
 *     own: not elapsed time, not a checked task, not a suggestion (STATE-05).
 *
 *   CONTRACT ATTEMPTS. Recording an executed contract on a home opens one and
 *     moves the journey to Under contract. It ends as closed (the journey
 *     moves to Own) or terminated (back to Search or Offer), and the attempt
 *     with everything recorded against it stays (STATE-06).
 *
 *   WORKSTREAMS. Under contract, eight things run at once, each with its own
 *     owner and state (STATE-04). A finished inspection says nothing about the
 *     loan. A cash purchase marks the lender's work as not applying rather
 *     than inventing milestones for it.
 *
 * Two rules decide whether any of this can be trusted:
 *
 *   A client saying "done" is a report, not a confirmation (UX-02). Earnest
 *     money is received when the holder says so, not when the buyer says they
 *     sent it.
 *   Nothing is "on track". A status has a source and a date, and when the
 *     date is old the screen says when it was last confirmed and that an
 *     update is awaited (UX-04).
 *
 * Pure, like every rule in lib/core.
 */

import { TOUR_TIMEZONE } from "./tour";

/** Today's date where the agent works, as YYYY-MM-DD. At 9pm in Georgia it is
 *  already tomorrow in UTC, and "confirmed tomorrow" must not be recordable. */
export function marketDay(now = new Date(), timeZone = TOUR_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/* ------------------------------------------------------------------ *
 * Stage and status
 * ------------------------------------------------------------------ */

export type Stage = "prepare" | "search" | "tour" | "offer" | "under-contract" | "close" | "own";
export const STAGES: Stage[] = ["prepare", "search", "tour", "offer", "under-contract", "close", "own"];
export const STAGE_LABEL: Record<Stage, string> = {
  prepare: "Prepare",
  search: "Search",
  tour: "Tour & evaluate",
  offer: "Offer",
  "under-contract": "Under contract",
  close: "Close",
  own: "Own",
};

export type JourneyStatus = "active" | "paused" | "completed" | "cancelled";
export const JOURNEY_STATUSES: JourneyStatus[] = ["active", "paused", "completed", "cancelled"];
export const STATUS_LABEL: Record<JourneyStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REASON_MAX = 500;
export const EVIDENCE_MAX = 300;

export interface JourneyEvent {
  seq: number;
  kind: "stage" | "status";
  from: string;
  to: string;
  reason: string;
  evidence: string | null;
  contractId: string | null;
  by: string;
  at: string;
}

export interface Progress {
  stage: Stage;
  status: JourneyStatus;
  /** When the current stage was recorded. Null while nothing has been. */
  stageSince: string | null;
  statusSince: string | null;
  /** The sequence the next event must carry, for the expected-version check. */
  seq: number;
}

/** The current stage and status, from the history. A journey with none is being prepared and active. */
export function progressOf(events: JourneyEvent[]): Progress {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const stage = [...ordered].reverse().find((e) => e.kind === "stage");
  const status = [...ordered].reverse().find((e) => e.kind === "status");
  return {
    stage: (stage?.to as Stage | undefined) ?? "prepare",
    status: (status?.to as JourneyStatus | undefined) ?? "active",
    stageSince: stage?.at ?? null,
    statusSince: status?.at ?? null,
    seq: ordered.length ? ordered[ordered.length - 1]!.seq : 0,
  };
}

const at = (s: Stage) => STAGES.indexOf(s);

/** What is true when a stage change is asked for. */
export interface StageContext {
  /** A signed agreement in force today (lib/core/representation `standingOf`). */
  covered: boolean;
  coverageNote: string;
  /** An attempt is open: recorded, and not yet closed or terminated. */
  openContract: boolean;
}

/**
 * Why the agent may not move the journey to `to` by hand, or null.
 *
 * Under contract and Own are reached only through the contract record, so
 * the stage and the attempt can never disagree: opening an attempt moves the
 * journey to Under contract, and ending one as closed moves it to Own. While
 * an attempt is open the journey cannot go back before Under contract either;
 * the attempt is ended first, and that says why.
 *
 * Search and every stage after it act on somebody's behalf, so they need a
 * signed agreement in force: the same rule as the pipeline's gate
 * (lib/core/representation `mayAdvance`) until the broker says otherwise
 * (decision D06). Going back never needs one.
 */
export function stageError(p: Progress, to: Stage, input: { reason: string; evidence?: string | null }, ctx: StageContext): string | null {
  if (!STAGES.includes(to)) return "Choose a stage";
  if (p.status === "completed" || p.status === "cancelled") {
    return `This journey is ${p.status}. Reopen it before changing its stage`;
  }
  if (to === p.stage) return `It is already at ${STAGE_LABEL[to]}`;
  if (to === "under-contract") return "Record the contract below. That moves the journey to Under contract";
  if (to === "own") return "Record the contract as closed. That moves the journey to Own";
  if (ctx.openContract && at(to) < at("under-contract")) {
    return "A contract is open. Record how it ended first; that also says where the journey goes next";
  }
  if (to === "close" && !ctx.openContract) return "Close follows a contract. Record the contract first";
  const reason = reasonError(input.reason);
  if (reason) return reason;
  if (to === "close" && !input.evidence?.trim()) {
    return "Say what shows closing is being prepared, like \"Closing set with the attorney for 30 Oct\"";
  }
  if (input.evidence && input.evidence.trim().length > EVIDENCE_MAX) return `Keep the evidence under ${EVIDENCE_MAX} characters`;
  if (at(to) > at(p.stage) && at(to) >= at("search") && !ctx.covered) {
    return `Moving to ${STAGE_LABEL[to]} needs a signed buyer agreement in force. ${ctx.coverageNote}`;
  }
  return null;
}

export function reasonError(reason: string | null | undefined): string | null {
  const r = reason?.trim() ?? "";
  if (r.length < 3) return "Say why, in a few words";
  if (r.length > REASON_MAX) return `Keep the reason under ${REASON_MAX} characters`;
  return null;
}

/**
 * Why the status may not change, or null. Completed means the buying is done,
 * so it follows Own. Anything can be reopened, and anything can be
 * cancelled, with a reason.
 */
export function statusError(p: Progress, to: JourneyStatus, reason: string): string | null {
  if (!JOURNEY_STATUSES.includes(to)) return "Choose a status";
  if (to === p.status) return `It is already ${p.status}`;
  if (to === "completed" && p.stage !== "own") return "A journey is completed once the home is theirs. Record the closing first";
  if (to === "paused" && p.status !== "active") return "Only an active journey can be paused";
  return reasonError(reason);
}

/** The stages a journey has actually been at, from its history. Every journey starts at Prepare. */
export const visitedStages = (events: JourneyEvent[]): Stage[] =>
  ["prepare", ...events.filter((e) => e.kind === "stage").map((e) => e.to as Stage)];

/**
 * How the stage strip reads: what has happened and what is only possible.
 * Never a percentage (UX-03), and a stage is ticked only if the journey was
 * recorded at it: going from Search straight to a contract does not claim
 * that anybody toured or offered through Rift. Those read "skipped".
 */
export function stageStrip(p: Progress, visited: Stage[]): { stage: Stage; label: string; state: "done" | "skipped" | "now" | "ahead" }[] {
  const now = at(p.stage);
  const been = new Set(visited);
  return STAGES.map((s, i) => ({
    stage: s, label: STAGE_LABEL[s],
    state: i === now ? "now" : i > now ? "ahead" : been.has(s) ? "done" : "skipped",
  }));
}

/* ------------------------------------------------------------------ *
 * Contract attempts
 * ------------------------------------------------------------------ */

export type Financing = "financed" | "cash";
export type ContractOutcome = "closed" | "terminated";

export interface ContractInput {
  homeId: string;
  financing: Financing;
  /** What shows it is binding: "Executed purchase agreement, both signatures, 23 Sep". */
  evidence: string;
}

export function contractError(p: Progress, input: ContractInput, ctx: StageContext & { homeOnList: boolean }): string | null {
  if (p.status === "completed" || p.status === "cancelled") return `This journey is ${p.status}. Reopen it first`;
  if (ctx.openContract) return "A contract is already open. Record how it ended before recording another";
  if (!ctx.homeOnList) return "Choose a home on the list";
  if (input.financing !== "financed" && input.financing !== "cash") return "Say whether it is financed or cash";
  const e = input.evidence?.trim() ?? "";
  if (e.length < 3) return "Say what shows the contract is binding, like \"Executed purchase agreement, 23 Sep\"";
  if (e.length > EVIDENCE_MAX) return `Keep it under ${EVIDENCE_MAX} characters`;
  if (!ctx.covered) return `A contract needs a signed buyer agreement in force. ${ctx.coverageNote}`;
  return null;
}

/**
 * Why an open attempt may not end this way, or null.
 *
 * Closed needs the closing workstream confirmed, by someone named, so "it
 * closed" is a fact on file and not a guess from the date. Terminated says
 * where the journey goes: back to Search, or to Offer on another home.
 */
export function endContractError(
  outcome: ContractOutcome, reason: string, backTo: Stage | null, workstreams: WorkstreamView[],
): string | null {
  if (outcome !== "closed" && outcome !== "terminated") return "Say whether it closed or was terminated";
  const r = reasonError(reason);
  if (r) return r;
  if (outcome === "terminated" && backTo !== "search" && backTo !== "offer") return "Say where the journey goes now: Search or Offer";
  if (outcome === "closed") {
    const closing = workstreams.find((w) => w.workstream === "closing");
    if (!closing || closing.state !== "confirmed") {
      return "Record the closing as confirmed first, with who confirmed it";
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Workstreams
 * ------------------------------------------------------------------ */

export type Workstream =
  | "earnest-money" | "inspection" | "financing" | "appraisal" | "title" | "insurance" | "repairs" | "closing";
export const WORKSTREAMS: Workstream[] = [
  "earnest-money", "inspection", "financing", "appraisal", "title", "insurance", "repairs", "closing",
];
export const WORKSTREAM_LABEL: Record<Workstream, string> = {
  "earnest-money": "Earnest money",
  inspection: "Inspection",
  financing: "Financing",
  appraisal: "Appraisal",
  title: "Title",
  insurance: "Insurance",
  repairs: "Repairs",
  closing: "Closing and keys",
};

export type WorkState =
  | "not-started" | "in-progress" | "waiting" | "blocked" | "reported" | "confirmed" | "not-applicable";
export const WORK_STATES: WorkState[] = [
  "not-started", "in-progress", "waiting", "blocked", "reported", "confirmed", "not-applicable",
];
export const WORK_STATE_LABEL: Record<WorkState, string> = {
  "not-started": "Not started",
  "in-progress": "Under way",
  waiting: "Waiting",
  blocked: "Blocked",
  reported: "Reported done, not confirmed",
  confirmed: "Confirmed",
  "not-applicable": "Does not apply",
};

export type Owner = "client" | "agent" | "other";

export interface WorkUpdate {
  seq: number;
  state: WorkState;
  owner: Owner;
  ownerName: string | null;
  /** Who the status came from: "Dana at Peach Mortgage", "Smith Law, the holder". */
  source: string | null;
  /** The day the source said it (YYYY-MM-DD). The agent may record it later. */
  confirmedOn: string | null;
  note: string | null;
  byKind: "agent" | "client";
  by: string;
  at: string;
}

export interface WorkInput {
  state: WorkState;
  owner: Owner;
  ownerName?: string | null;
  source?: string | null;
  confirmedOn?: string | null;
  note?: string | null;
}

/** An open workstream with no word for this long says so, instead of looking fine. */
export const STALE_DAYS = 7;
export const SOURCE_MAX = 160;
export const NOTE_MAX = 500;

/**
 * Who owns each workstream when a contract is recorded, before the agent
 * changes anything. Named by role; the agent puts in the real names.
 * Georgia closes with an attorney, so title and closing sit with one.
 */
export const DEFAULT_OWNER: Record<Workstream, { owner: Owner; ownerName: string | null }> = {
  "earnest-money": { owner: "client", ownerName: null },
  inspection: { owner: "client", ownerName: null },
  financing: { owner: "other", ownerName: "The lender" },
  appraisal: { owner: "other", ownerName: "The lender" },
  title: { owner: "other", ownerName: "The closing attorney" },
  insurance: { owner: "client", ownerName: null },
  repairs: { owner: "agent", ownerName: null },
  closing: { owner: "other", ownerName: "The closing attorney" },
};

/** The first row of each workstream on a new contract. A cash purchase has no lender work to track. */
export function initialWork(financing: Financing): { workstream: Workstream; input: WorkInput }[] {
  return WORKSTREAMS.map((w) => {
    const cashSkips = financing === "cash" && (w === "financing" || w === "appraisal");
    return {
      workstream: w,
      input: cashSkips
        ? { state: "not-applicable", owner: "agent", ownerName: null, note: "Cash purchase: no loan" }
        : { state: "not-started", ...DEFAULT_OWNER[w] },
    };
  });
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Why an update may not be recorded, or null.
 *
 * A client can record one thing: that they did their part ("reported"), on a
 * workstream that is theirs. Confirming is the agent's, with the name of
 * whoever confirmed it and the day they did.
 */
export function workError(current: WorkState | null, currentOwner: Owner | null, input: WorkInput, by: "agent" | "client", today = new Date()): string | null {
  if (!WORK_STATES.includes(input.state)) return "Choose a state";
  if (by === "client") {
    if (input.state !== "reported") return "You can say you have done your part; your agent records the rest";
    if (currentOwner !== "client") return "This one is not yours to do";
    if (current === "confirmed" || current === "not-applicable") return "This is already settled";
    if (current === "reported") return "You already said this is done";
  }
  if (!["client", "agent", "other"].includes(input.owner)) return "Say who owns it";
  if (input.owner === "other" && !input.ownerName?.trim()) return "Name who it is waiting on, like \"Dana at Peach Mortgage\"";
  if (input.ownerName && input.ownerName.trim().length > SOURCE_MAX) return `Keep the name under ${SOURCE_MAX} characters`;
  if (input.source && input.source.trim().length > SOURCE_MAX) return `Keep the source under ${SOURCE_MAX} characters`;
  if (input.note && input.note.trim().length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters`;
  if (input.confirmedOn) {
    if (!ISO_DAY.test(input.confirmedOn) || Number.isNaN(Date.parse(input.confirmedOn))) return "That date could not be read";
    if (input.confirmedOn > marketDay(today)) return "The date they confirmed it cannot be in the future";
  }
  if (input.state === "confirmed" && by === "agent") {
    if (!input.source?.trim()) return "Say who confirmed it, like \"Smith Law, the holder\"";
    if (!input.confirmedOn) return "Give the day they confirmed it";
  }
  if (input.state === "blocked" && !input.note?.trim()) return "Say what is blocking it";
  if (input.state === "not-applicable" && !input.note?.trim()) return "Say why it does not apply, like \"Cash purchase\"";
  return null;
}

export interface WorkstreamView {
  workstream: Workstream;
  label: string;
  state: WorkState;
  owner: Owner;
  ownerName: string | null;
  /** The last time anybody gave word, and who. Null before anybody has. */
  lastWord: { on: string; from: string } | null;
  daysSinceWord: number | null;
  /** Open, not the client's, and no word for STALE_DAYS or more. */
  stale: boolean;
  note: string | null;
  seq: number;
}

const DAY = 86_400_000;
const daysBetween = (fromDay: string, today: Date) =>
  Math.round((Date.parse(marketDay(today)) - Date.parse(fromDay)) / DAY);

export const isSettled = (s: WorkState) => s === "confirmed" || s === "not-applicable";

export function workstreamView(workstream: Workstream, updates: WorkUpdate[], now = new Date()): WorkstreamView {
  const ordered = [...updates].sort((a, b) => a.seq - b.seq);
  const latest = ordered[ordered.length - 1];
  const state = latest?.state ?? "not-started";
  const owner = latest?.owner ?? DEFAULT_OWNER[workstream].owner;
  /* Word comes from a named source on a stated day; failing that, from
     whoever recorded the update, on the day they did. A first row made by
     opening the contract is nobody's word about this workstream. */
  const worded = [...ordered].reverse().find((u) => u.source || u.confirmedOn || u.seq > 1);
  const lastWord = worded ? { on: worded.confirmedOn ?? marketDay(new Date(worded.at)), from: worded.source ?? worded.by } : null;
  const daysSinceWord = lastWord ? daysBetween(lastWord.on, now) : null;
  const open = !isSettled(state) && state !== "not-started";
  return {
    workstream,
    label: WORKSTREAM_LABEL[workstream],
    state,
    owner,
    ownerName: latest?.ownerName ?? DEFAULT_OWNER[workstream].ownerName,
    lastWord,
    daysSinceWord,
    stale: open && owner !== "client" && (daysSinceWord === null || daysSinceWord >= STALE_DAYS),
    note: latest?.note ?? null,
    seq: latest?.seq ?? 0,
  };
}

const SHORT = (day: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** The owner as the reader should see it. `reader` is who is looking. */
export function ownerText(v: Pick<WorkstreamView, "owner" | "ownerName">, reader: "client" | "agent", agentFirst: string): string {
  if (v.owner === "other") return v.ownerName ?? "Someone else";
  if (v.owner === "client") return reader === "client" ? "You" : "The buyer";
  return reader === "agent" ? "You" : agentFirst;
}

/**
 * One sentence on where a workstream stands, for the client. Every sentence
 * carries its source and date or says there is none; none says "on track".
 */
export function workLine(v: WorkstreamView, agentFirst: string): string {
  const who = ownerText(v, "client", agentFirst);
  const word = v.lastWord ? `Last update ${SHORT(v.lastWord.on)}, from ${v.lastWord.from}.` : "No update yet.";
  switch (v.state) {
    case "confirmed":
      return `Confirmed${v.lastWord ? ` by ${v.lastWord.from} on ${SHORT(v.lastWord.on)}` : ""}.`;
    case "not-applicable":
      return `Does not apply${v.note ? `: ${v.note}` : ""}.`;
    case "reported":
      return v.workstream === "earnest-money"
        ? `Reported sent${v.lastWord ? ` on ${SHORT(v.lastWord.on)}` : ""}. Not confirmed received until the holder says so.`
        : `Reported done${v.lastWord ? ` on ${SHORT(v.lastWord.on)}` : ""}. Not confirmed yet.`;
    case "blocked":
      return `Blocked${v.note ? `: ${v.note}` : ""}. ${who === "You" ? "This is yours to sort out" : `${who} is the one to move it`}. ${word}`;
    case "not-started":
      return who === "You" ? "Not started. This one is yours." : `Not started. ${who} will do this part.`;
    default:
      if (v.stale) {
        return v.lastWord
          ? `Last confirmed ${SHORT(v.lastWord.on)}, by ${v.lastWord.from}. Waiting for an update.`
          : "Waiting for confirmation. Nobody has given an update yet.";
      }
      return `${v.state === "waiting" ? `Waiting on ${who === "You" ? "you" : who}` : "Under way"}. ${word}`;
  }
}

/**
 * The count REQ-UX-03 allows: how many required items are confirmed, and by
 * name which are not. No percentage, and the open ones are named so the
 * count cannot suggest they carry equal weight.
 */
export function workSummary(views: WorkstreamView[]): string {
  const required = views.filter((v) => v.state !== "not-applicable");
  const confirmed = required.filter((v) => v.state === "confirmed");
  const open = required.filter((v) => v.state !== "confirmed");
  if (!required.length) return "Nothing is being tracked for this contract.";
  if (!open.length) return `All ${required.length} confirmed.`;
  const names = open.map((v) => `${v.label.toLowerCase()}${v.state === "blocked" ? " (blocked)" : ""}`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]!;
  return `${confirmed.length} of ${required.length} confirmed. Still open: ${list}.`;
}
