/**
 * Today: what matters for this person's move, in a fixed order (blueprint v4
 * §6, "Deterministic next-action policy"; AT19 to AT21).
 *
 *   1. Blockers and anything of theirs past its date. A blocked workstream
 *      leads whatever else has finished: a completed inspection does not make
 *      a stuck loan less stuck (AT19).
 *   2. Decisions waiting on this person: a changed brief to confirm, a home
 *      they saw and have not answered about.
 *   3. Their own next things to do. Every dated one due within a week, not
 *      only the first, so one action never hides a second real deadline.
 *   4. What other people are doing, each with a name and the date of the
 *      last word, and a stale one saying so (AT21).
 *   5. When nothing is owed by them, it says exactly that, and does not claim
 *      everybody else is on schedule.
 *
 * The order is a rule, not a score. It never depends on lead score or
 * commission, and nothing is ranked by what it is worth to the agent.
 *
 * Pure. The inputs are what the page already read.
 */

import { daysUntil, ownerLabel, whenPhrase, type PlanItem } from "./plan";
import { STAGE_LABEL, isSettled, ownerText, workLine, type Progress, type Workstream, type WorkstreamView } from "./progress";
import { buyerDateLine, type DeadlineView } from "./deadline";

export type TodayKind = "blocker" | "overdue" | "decision" | "yours" | "others";

export interface TodayItem {
  kind: TodayKind;
  title: string;
  detail: string;
  /** Where on the page it can be acted on, when it can. */
  anchor: string | null;
}

export interface TodayInput {
  agentFirst: string;
  progress: Progress;
  /** The open contract's workstreams, or none. Once a contract has closed, the
   *  ones still worked after closing (possession). */
  work: WorkstreamView[];
  /** Who confirmed the closing, and the day, once the contract closed (B18). */
  closing?: { on: string; from: string } | null;
  /** The relationship's plan, as the agent wrote it for the client. Empty for a viewer. */
  plan: PlanItem[];
  briefToConfirm: boolean;
  showingsToAnswer: string[];
  /** Offers whose current version is waiting on this person's instruction: the home's address. */
  offersToAnswer?: string[];
  /** The open contract's contractual dates. Only checked ones are ever shown (REQ-DATE-02). */
  contractDates?: { label: string; workstream: Workstream | null; view: DeadlineView }[];
  /** A seller's released offers, when they have not said which one they want yet. */
  offersToChoose?: number;
  /** Released decisions with no outcome yet: the question each asks. */
  decisionsOpen?: string[];
  /** A link to the household's other move that this person is named as handling (STATE-07). */
  dependenciesOnYou?: string[];
}

/** How far ahead a checked contract date appears on Today. */
export const DATES_AHEAD = 14;

export interface Today {
  /** One line on where the journey is. */
  where: string;
  items: TodayItem[];
  /** Said when nothing is owed by this person. Null otherwise. */
  nothingOwed: string | null;
}

const SOON_DAYS = 7;

export function todayFor(input: TodayInput, today = new Date()): Today {
  const { agentFirst, progress, work, plan } = input;
  const items: TodayItem[] = [];
  const names = { agent: agentFirst };
  const openPlan = plan.filter((i) => !i.doneAt);

  /* 1. Blockers, whoever owns them, then their own items past a date. */
  for (const w of work.filter((x) => x.state === "blocked")) {
    items.push({ kind: "blocker", title: `${w.label} is blocked`, detail: workLine(w, agentFirst), anchor: "under-contract" });
  }
  const overdue = openPlan
    .filter((i) => i.owner === "client" && i.dueOn && daysUntil(i.dueOn, today) < 0)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  for (const i of overdue) {
    items.push({ kind: "overdue", title: i.title, detail: `Was due ${whenPhrase(daysUntil(i.dueOn!, today))}. Yours to do.`, anchor: null });
  }

  /* A contract date that passed is urgent, whoever owns the work. The line
     never says what it means legally (REQ-DATE-03). */
  const dates = (input.contractDates ?? []).filter((d) => d.view.state === "active");
  for (const d of dates.filter((x) => x.view.verified && x.view.missed)) {
    items.push({ kind: "blocker", title: `${d.label} has passed`, detail: buyerDateLine(d.label, d.view, agentFirst)!.replace(`${d.label} was `, "It was "), anchor: "under-contract" });
  }

  /* 2. Decisions for this person. An offer waiting on them comes first: it
     usually has a deadline the listing side set. Once the home is theirs the
     search is over, and a question left open on another home, a brief or a
     showing is not theirs to answer any more (W11). */
  const searching = progress.stage !== "own";
  for (const address of searching ? input.offersToAnswer ?? [] : []) {
    items.push({
      kind: "decision", title: `Your offer on ${address}`,
      detail: `Tell ${agentFirst} how to proceed on the current terms. Your answer is an instruction, not a signature.`, anchor: "offers",
    });
  }
  /* What used to wait only on the plan link (audit portals-2026-10, item 4):
     a seller with offers in front of them is never told nothing is waiting. */
  if (input.offersToChoose) {
    items.push({
      kind: "decision", title: input.offersToChoose === 1 ? "An offer on your home" : `${input.offersToChoose} offers on your home`,
      detail: `Look at what each would leave you, and tell ${agentFirst} which one you want. Choosing is not accepting.`, anchor: "seller-offers",
    });
  }
  for (const q of input.decisionsOpen ?? []) {
    items.push({ kind: "decision", title: q, detail: `${agentFirst} laid out the options. The choice is yours.`, anchor: "decisions" });
  }
  if (searching && input.briefToConfirm) {
    items.push({
      kind: "decision", title: "Check your search priorities",
      detail: `They changed. Say whether they are right so ${agentFirst} can update the search.`, anchor: "priorities",
    });
  }
  for (const address of searching ? input.showingsToAnswer : []) {
    items.push({ kind: "decision", title: `You saw ${address}`, detail: "Would you consider an offer on it?", anchor: "homes" });
  }

  /* 3. Their own next things. Everything dated inside a week, then the next undated one. */
  const mineDated = openPlan
    .filter((i) => i.owner === "client" && i.dueOn && daysUntil(i.dueOn, today) >= 0)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  const soon = mineDated.filter((i) => daysUntil(i.dueOn!, today) <= SOON_DAYS);
  for (const i of soon) {
    items.push({ kind: "yours", title: i.title, detail: `Due ${whenPhrase(daysUntil(i.dueOn!, today))}.`, anchor: null });
  }
  /* A sale and a purchase linked, with this person named as the one moving
     it. It sat above Today with "is handling it" while Today said nothing was
     waiting on them (audit portals-2026-10, item 9). */
  for (const line of input.dependenciesOnYou ?? []) {
    items.push({ kind: "yours", title: line, detail: "You are named as the one handling this.", anchor: null });
  }
  for (const w of work.filter((x) => x.owner === "client" && !isSettled(x.state) && x.state !== "blocked" && x.state !== "reported")) {
    items.push({ kind: "yours", title: w.label, detail: workLine(w, agentFirst), anchor: "under-contract" });
  }
  const upcoming = dates
    .filter((d) => d.view.verified && !d.view.missed && d.view.days !== null && d.view.days <= DATES_AHEAD)
    .sort((a, b) => a.view.days! - b.view.days!);
  const theirs0 = (d: (typeof dates)[number]) => !!d.workstream && work.find((w) => w.workstream === d.workstream)?.owner === "client";
  for (const d of upcoming.filter(theirs0)) {
    items.push({ kind: "yours", title: d.label, detail: buyerDateLine(d.label, d.view, agentFirst)!.replace(`${d.label}: `, "Due "), anchor: "under-contract" });
  }
  if (!soon.length) {
    const next = [...mineDated, ...openPlan.filter((i) => i.owner === "client" && !i.dueOn).sort((a, b) => a.sort - b.sort)][0];
    if (next) {
      items.push({
        kind: "yours", title: next.title,
        detail: next.dueOn ? `Due ${whenPhrase(daysUntil(next.dueOn, today))}.` : "No date set.", anchor: null,
      });
    }
  }

  const owed = items.length > 0;

  for (const d of upcoming.filter((x) => !theirs0(x))) {
    items.push({ kind: "others", title: d.label, detail: buyerDateLine(d.label, d.view, agentFirst)!.replace(`${d.label}: `, "Due "), anchor: "under-contract" });
  }
  if (dates.some((d) => !d.view.verified)) {
    items.push({ kind: "others", title: "Contract dates", detail: `${agentFirst} is checking some of the contract's dates against the documents. They appear here once checked.`, anchor: null });
  }

  /* After closing, keys are the one thing left, and "not recorded yet" is
     worth saying rather than leaving out (B18: possession stays explicit). */
  if (progress.stage === "own") {
    for (const w of work.filter((x) => x.workstream === "possession" && x.state === "not-started" && x.owner !== "client")) {
      items.push({ kind: "others", title: w.label, detail: `Not recorded yet. ${agentFirst} records it when the keys are handed over.`, anchor: "under-contract" });
    }
  }

  /* 4. Everyone else. Workstreams first (they carry dated word), then the plan. */
  /* Only work that is moving or waiting: the not-started rest is in the
     contract list right below, and repeating it here buries what is live. */
  for (const w of work.filter((x) => x.owner !== "client" && !isSettled(x.state) && x.state !== "blocked" && x.state !== "not-started")) {
    items.push({ kind: "others", title: `${w.label}: ${ownerText(w, "client", agentFirst)}`, detail: workLine(w, agentFirst), anchor: "under-contract" });
  }
  for (const w of work.filter((x) => x.owner === "client" && x.state === "reported")) {
    items.push({ kind: "others", title: w.label, detail: workLine(w, agentFirst), anchor: "under-contract" });
  }
  const theirs = openPlan
    .filter((i) => i.owner !== "client")
    .sort((a, b) => (a.dueOn ? 0 : 1) - (b.dueOn ? 0 : 1) || (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.sort - b.sort)
    .slice(0, 5);
  for (const i of theirs) {
    items.push({
      kind: "others", title: i.title,
      detail: `${ownerLabel(i, names, "client")}${i.dueOn ? `, due ${whenPhrase(daysUntil(i.dueOn, today))}` : ""}.`, anchor: null,
    });
  }

  /* 5. Nothing owed: say so, without vouching for anybody else. */
  const nothingOwed = owed
    ? null
    : items.length
      ? "Nothing is waiting on you right now. Below is what others are doing, with the date each last gave word."
      : `Nothing is waiting on you right now. If something seems to be missing, ask ${agentFirst}.`;

  return { where: whereLine(progress, agentFirst, input.closing ?? null), items, nothingOwed };
}

const DAY = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

/**
 * "You own your home" is said only at Own, which only a closed contract with
 * the closing confirmed by someone named can reach: never at the scheduled
 * time, and never because the signing happened (AT34, B18).
 */
function whereLine(p: Progress, agentFirst: string, closing: { on: string; from: string } | null): string {
  const stage = STAGE_LABEL[p.stage];
  if (p.stage === "own" && p.status === "active") {
    return closing ? `You own your home. ${closing.from} confirmed the closing on ${DAY(closing.on)}.` : "You own your home.";
  }
  /* A sale's last stage (STATE-03): sold, and the handover may still be open. */
  if (p.stage === "continue" && p.status === "active") {
    return closing ? `Sold. ${closing.from} confirmed the closing on ${DAY(closing.on)}; keys and possession are recorded separately.` : "Sold. Keys and possession are recorded separately.";
  }
  switch (p.status) {
    case "paused": return `Paused at ${stage}. Anything under contract keeps its dates; ${agentFirst} will pick the rest back up with you.`;
    case "completed": return p.stage === "continue" ? "Completed. The sale is done." : "Completed. The home is yours.";
    case "cancelled": return `This move was stopped at ${stage}. Talk to ${agentFirst} if that is not what you expected.`;
    default: return `Now: ${stage}.`;
  }
}
