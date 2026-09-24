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
import { STAGE_LABEL, isSettled, ownerText, workLine, type Progress, type WorkstreamView } from "./progress";

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
  /** The open contract's workstreams, or none. */
  work: WorkstreamView[];
  /** The relationship's plan, as the agent wrote it for the client. Empty for a viewer. */
  plan: PlanItem[];
  briefToConfirm: boolean;
  showingsToAnswer: string[];
  /** Offers whose current version is waiting on this person's instruction: the home's address. */
  offersToAnswer?: string[];
}

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

  /* 2. Decisions for this person. An offer waiting on them comes first: it
     usually has a deadline the listing side set. */
  for (const address of input.offersToAnswer ?? []) {
    items.push({
      kind: "decision", title: `Your offer on ${address}`,
      detail: `Tell ${agentFirst} how to proceed on the current terms. Your answer is an instruction, not a signature.`, anchor: "offers",
    });
  }
  if (input.briefToConfirm) {
    items.push({
      kind: "decision", title: "Check your search priorities",
      detail: `They changed. Say whether they are right so ${agentFirst} can update the search.`, anchor: "priorities",
    });
  }
  for (const address of input.showingsToAnswer) {
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
  for (const w of work.filter((x) => x.owner === "client" && !isSettled(x.state) && x.state !== "blocked" && x.state !== "reported")) {
    items.push({ kind: "yours", title: w.label, detail: workLine(w, agentFirst), anchor: "under-contract" });
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

  return { where: whereLine(progress, agentFirst), items, nothingOwed };
}

function whereLine(p: Progress, agentFirst: string): string {
  const stage = STAGE_LABEL[p.stage];
  switch (p.status) {
    case "paused": return `Paused at ${stage}. Anything under contract keeps its dates; ${agentFirst} will pick the rest back up with you.`;
    case "completed": return "Completed. The home is yours.";
    case "cancelled": return `This move was stopped at ${stage}. Talk to ${agentFirst} if that is not what you expected.`;
    default: return `Now: ${stage}.`;
  }
}
