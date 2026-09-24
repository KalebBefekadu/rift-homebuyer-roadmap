import { addDays, isBusinessDay } from "./deadline";
import { marketDay } from "./progress";
import { SUMMARY_TZ } from "./summary";

/**
 * The pilot's evidence (blueprint v4 W12; implementation plan §8 steps 4
 * and 7).
 *
 * Two questions, answered from what is already recorded:
 *
 *   1. Is the promise kept? D07 promised buyers a reply the same business
 *      day. Each thing a buyer did that needs the agent is paired with the
 *      first thing he recorded in answer, and counted against that promise.
 *      Search setup time (approval to recording the Matrix search) is
 *      measured apart: it is his own work, not a reply.
 *   2. Does the record match the source? Rift cannot see Matrix or the
 *      signed documents. The agent checks, buyer by buyer, and each check is
 *      kept (rift_reconciliations). A check goes stale when the search or the
 *      dates change after it.
 *
 * Nothing here is compared with how things were before Rift: no baseline
 * was recorded, and a number made up to compare with would be worse than
 * none.
 *
 * Pure. Reading the rows is lib/db/pilot.ts.
 */

export const PILOT_TZ = SUMMARY_TZ;

/** The market day an answer is owed by: the day asked, or the next business day after a weekend or holiday. */
export function replyDueDay(askedAt: string): string {
  let day = marketDay(new Date(askedAt), PILOT_TZ);
  for (let i = 0; i < 10 && !isBusinessDay(day); i++) day = addDays(day, 1);
  return day;
}

export type AskKind = "showing" | "work" | "brief-changes" | "brief-proposal" | "offer-answer";

export const ASK_LABEL: Record<AskKind, string> = {
  showing: "Showing requests",
  work: "Work a buyer reported done",
  "brief-changes": "Changes asked for in the search priorities",
  "brief-proposal": "Search priorities a buyer proposed",
  "offer-answer": "Answers on an offer",
};

/** What counts as the answer, in the report's words. */
export const ANSWER_LABEL: Record<AskKind, string> = {
  showing: "the next step you recorded on that showing",
  work: "your next update on that workstream",
  "brief-changes": "your next version of the priorities",
  "brief-proposal": "your next version of the priorities, or an approval",
  "offer-answer": "the next step you recorded on that offer",
};

/** Something a buyer did that needs the agent, and when he first answered it. */
export interface Ask {
  kind: AskKind;
  journeyId: string;
  askedAt: string;
  answeredAt: string | null;
}

export type Timing = "same-day" | "later" | "waiting" | "overdue";

export function timing(a: Ask, now: Date): Timing {
  const due = replyDueDay(a.askedAt);
  if (a.answeredAt) return marketDay(new Date(a.answeredAt), PILOT_TZ) <= due ? "same-day" : "later";
  return marketDay(now, PILOT_TZ) > due ? "overdue" : "waiting";
}

/* ------------------------------------------------------------------ *
 * Pairing
 * ------------------------------------------------------------------ */

export interface PilotRows {
  /** Showings; only ones a member asked for need an answer. */
  stops: { id: string; journeyId: string; byMember: boolean; at: string }[];
  tourSteps: { stopId: string; seq: number; at: string }[];
  work: { transactionId: string; journeyId: string; workstream: string; seq: number; state: string; byMember: boolean; at: string }[];
  briefResponses: { journeyId: string; response: "confirmed" | "changes-requested"; at: string }[];
  revisions: { journeyId: string; byMember: boolean; at: string }[];
  packages: SetupRow[];
  /** told_agent answers are the agent's own record of a call, not something waiting on him. */
  bidAnswers: { bidId: string; journeyId: string; byMember: boolean; at: string }[];
  bidSteps: { bidId: string; at: string }[];
}

export interface SetupRow {
  id: string;
  journeyId: string;
  status: "manual-action-needed" | "active-confirmed" | "paused" | "superseded" | "cancelled";
  approvedAt: string;
  confirmedAt: string | null;
  endedAt: string | null;
}

/* Compared as instants: two timestamps for the same moment can be written differently. */
const ms = (t: string) => Date.parse(t);
const earliest = (times: string[]) => times.reduce<string | null>((best, t) => (best === null || ms(t) < ms(best) ? t : best), null);

/** The first time in `times` strictly after `at`, or null. */
const firstAfter = (at: string, times: string[]) => earliest(times.filter((t) => ms(t) > ms(at)));

const group = <T,>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
};

/** Every buyer action that needs the agent, paired with his first answer. */
export function asksFrom(rows: PilotRows): Ask[] {
  const asks: Ask[] = [];

  const steps = group(rows.tourSteps.filter((s) => s.seq > 1), (s) => s.stopId);
  for (const s of rows.stops) {
    if (!s.byMember) continue;
    asks.push({ kind: "showing", journeyId: s.journeyId, askedAt: s.at, answeredAt: earliest((steps.get(s.id) ?? []).map((x) => x.at)) });
  }

  const streams = group(rows.work, (w) => `${w.transactionId}:${w.workstream}`);
  for (const list of streams.values()) {
    for (const w of list) {
      if (!w.byMember || w.state !== "reported") continue;
      const later = list.filter((x) => x.seq > w.seq && !x.byMember).map((x) => x.at);
      asks.push({ kind: "work", journeyId: w.journeyId, askedAt: w.at, answeredAt: earliest(later) });
    }
  }

  const agentRevisions = group(rows.revisions.filter((r) => !r.byMember), (r) => r.journeyId);
  const approvals = group(rows.packages, (p) => p.journeyId);
  for (const r of rows.briefResponses) {
    if (r.response !== "changes-requested") continue;
    asks.push({ kind: "brief-changes", journeyId: r.journeyId, askedAt: r.at, answeredAt: firstAfter(r.at, (agentRevisions.get(r.journeyId) ?? []).map((x) => x.at)) });
  }
  for (const r of rows.revisions) {
    if (!r.byMember) continue;
    const answers = [
      ...(agentRevisions.get(r.journeyId) ?? []).map((x) => x.at),
      ...(approvals.get(r.journeyId) ?? []).map((x) => x.approvedAt),
    ];
    asks.push({ kind: "brief-proposal", journeyId: r.journeyId, askedAt: r.at, answeredAt: firstAfter(r.at, answers) });
  }

  const bidSteps = group(rows.bidSteps, (s) => s.bidId);
  for (const a of rows.bidAnswers) {
    if (!a.byMember) continue;
    asks.push({ kind: "offer-answer", journeyId: a.journeyId, askedAt: a.at, answeredAt: firstAfter(a.at, (bidSteps.get(a.bidId) ?? []).map((s) => s.at)) });
  }

  return asks.sort((x, y) => ms(x.askedAt) - ms(y.askedAt));
}

/* ------------------------------------------------------------------ *
 * Measures
 * ------------------------------------------------------------------ */

export const hoursBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 3_600_000;

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A duration in the words a person would use: never more precise than it is useful. */
export function durationText(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours < 48) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.round(hours / 24);
  return `${d} days`;
}

export interface ReplyStats {
  kind: AskKind;
  asked: number;
  sameDay: number;
  later: number;
  waiting: number;
  overdue: number;
  /** Over the answered ones, in hours; null when none is answered. */
  medianHours: number | null;
}

export function replyStats(asks: Ask[], now: Date): ReplyStats[] {
  return (Object.keys(ASK_LABEL) as AskKind[]).map((kind) => {
    const mine = asks.filter((a) => a.kind === kind);
    const t = mine.map((a) => timing(a, now));
    return {
      kind,
      asked: mine.length,
      sameDay: t.filter((x) => x === "same-day").length,
      later: t.filter((x) => x === "later").length,
      waiting: t.filter((x) => x === "waiting").length,
      overdue: t.filter((x) => x === "overdue").length,
      medianHours: median(mine.flatMap((a) => (a.answeredAt ? [hoursBetween(a.askedAt, a.answeredAt)] : []))),
    };
  });
}

/** The whole promise in one line: of the asks that are due or answered, how many were answered the same business day. */
export function promiseLine(stats: ReplyStats[]): string {
  const due = stats.reduce((n, s) => n + s.sameDay + s.later + s.overdue, 0);
  const kept = stats.reduce((n, s) => n + s.sameDay, 0);
  const waiting = stats.reduce((n, s) => n + s.waiting, 0);
  if (!due && !waiting) return "Nothing from a buyer has needed you yet.";
  const tail = waiting ? ` ${waiting} more ${waiting === 1 ? "is" : "are"} waiting and not late yet.` : "";
  if (!due) return `Nothing is past due.${tail}`;
  return `${kept} of ${due} answered the same business day.${tail}`;
}

export interface SetupStats {
  /** Approved searches recorded as set up in Matrix. */
  recorded: number;
  /** Approved and not recorded yet. */
  waiting: number;
  /** Approved, then replaced or cancelled before anyone recorded it. */
  dropped: number;
  medianHours: number | null;
}

export function setupStats(packages: SetupRow[]): SetupStats {
  const recorded = packages.filter((p) => p.confirmedAt);
  return {
    recorded: recorded.length,
    waiting: packages.filter((p) => p.status === "manual-action-needed").length,
    dropped: packages.filter((p) => !p.confirmedAt && p.status !== "manual-action-needed").length,
    medianHours: median(recorded.map((p) => hoursBetween(p.approvedAt, p.confirmedAt!))),
  };
}

/* ------------------------------------------------------------------ *
 * Reconciliation
 * ------------------------------------------------------------------ */

export type CheckResult = "matches" | "differs" | "none";

export const SEARCH_CHECK_LABEL: Record<CheckResult, string> = {
  matches: "The Matrix search matches the approved one",
  differs: "The Matrix search differs",
  none: "No live search to check",
};

export const DATES_CHECK_LABEL: Record<CheckResult, string> = {
  matches: "The dates match the documents",
  differs: "A date differs from the documents",
  none: "No contract dates to check",
};

export interface Check {
  search: CheckResult;
  dates: CheckResult;
  note: string | null;
  by: string;
  at: string;
}

export type CheckState =
  | { state: "never" }
  | { state: "differs"; check: Check }
  | { state: "changed"; check: Check; what: ("search" | "dates")[] }
  | { state: "current"; check: Check };

/**
 * Where a journey's checking stands. A difference stands until a later check
 * finds a match; a match stands until the search or the dates change after
 * it, and then it says which.
 */
export function checkState(latest: Check | null, changed: { search: string | null; dates: string | null }): CheckState {
  if (!latest) return { state: "never" };
  if (latest.search === "differs" || latest.dates === "differs") return { state: "differs", check: latest };
  const what = (["search", "dates"] as const).filter((k) => changed[k] !== null && ms(changed[k]!) > ms(latest.at));
  return what.length ? { state: "changed", check: latest, what } : { state: "current", check: latest };
}

/** What there is to check on a journey right now. */
export interface Checkable {
  /** A search recorded in Matrix, running or paused. */
  search: boolean;
  /** The open contract has dates still active. */
  dates: boolean;
}

/**
 * Why a check cannot be recorded as given, or null. The answer must fit what
 * there is: "matches" for a search that does not exist would be a check of
 * nothing, and "none" for one that does would skip it quietly.
 */
export function checkError(c: { search: CheckResult; dates: CheckResult; note: string | null }, has: Checkable): string | null {
  const results: CheckResult[] = ["matches", "differs", "none"];
  if (!results.includes(c.search) || !results.includes(c.dates)) return "Choose an answer for the search and for the dates";
  if (!has.search && !has.dates) return "There is nothing to check yet: no search in Matrix and no contract dates";
  if (has.search && c.search === "none") return "Say whether the Matrix search matches";
  if (!has.search && c.search !== "none") return "There is no search recorded in Matrix to check";
  if (has.dates && c.dates === "none") return "Say whether the dates match the documents";
  if (!has.dates && c.dates !== "none") return "There are no contract dates to check";
  if ((c.search === "differs" || c.dates === "differs") && (c.note ?? "").trim().length < 3) return "Say what differed and what you did about it";
  if ((c.note ?? "").trim().length > 1000) return "Keep the note under 1,000 characters";
  return null;
}
