/**
 * Contract dates (blueprint v4 W09; REQ-DATE-01 to 03; AT26 to AT29).
 *
 * A deadline is a history of revisions, like everything under contract. Each
 * revision says where the date comes from (the term, the document, the page),
 * how it was reached (written as a date, or counted from a trigger by a named
 * rule), whether a time was stated, in which time zone, and whether the agent
 * has checked it against the document. The current revision is the latest.
 *
 * Four rules:
 *
 *   A DATE WITHOUT A TIME STAYS A DATE (AT26). If the contract says "October
 *     3" and no time, Rift stores a date and never an instant: no midnight,
 *     no 5 PM, no countdown in hours. It is due that day and past the next.
 *   ONLY NAMED RULES ARE COUNTED (AT28). Counting "10 days after the binding
 *     agreement date" is done by a rule with a name and a version, listed
 *     below. None of them is presented as THE Georgia rule: which one a
 *     contract uses is the agent's to confirm against the contract, and the
 *     revision records that they did (REQ-DATE-02).
 *   AN UNCHECKED DATE IS A TASK, NOT A PROMISE. Until the agent marks a date
 *     checked against the document, the buyer does not see it and the agent
 *     sees a task to check it.
 *   A MISSED DATE IS AN URGENT ITEM, NOT A CONCLUSION (AT29). Rift never says
 *     a right was waived, a contract ended, or an extension took effect. The
 *     item stays until the agent records what actually happened.
 *
 * Reminders are not stored. They are read from the current revision whenever
 * a page asks, so an amendment that moves a date cannot leave a reminder for
 * the old one behind (AT27).
 *
 * Pure.
 */

import { zonedToUtc, TOUR_TIMEZONE } from "./tour";
import { marketDay } from "./progress";

export type DeadlineKind = "contractual" | "target";
export const KIND_LABEL: Record<DeadlineKind, string> = {
  contractual: "In the contract",
  target: "Your own target",
};

export type RuleId = "as-written" | "calendar-days-v1" | "business-days-v1";
export const RULES: Record<RuleId, { label: string; explain: string }> = {
  "as-written": {
    label: "The date as written",
    explain: "The date (and time, if one is stated) exactly as it appears in the document. Nothing is calculated.",
  },
  "calendar-days-v1": {
    label: "Calendar days after a date",
    explain: "Counts every day, weekends and holidays included. Day 1 is the day after the trigger date.",
  },
  "business-days-v1": {
    label: "Business days after a date",
    explain: "Counts Monday to Friday, skipping US federal holidays as observed. Day 1 is the first business day after the trigger date. Confirm this matches how the contract defines a business day.",
  },
};
export const RULE_IDS = Object.keys(RULES) as RuleId[];

export type RevisionState = "active" | "met" | "removed";

export interface DeadlineInput {
  rule: RuleId;
  /** For "as-written": the date in the document. */
  date?: string | null;
  /** HH:MM, only when the document states a time. */
  time?: string | null;
  timezone?: string;
  /** For counted rules. */
  triggerLabel?: string | null;
  triggerDate?: string | null;
  days?: number | null;
  sourceTerm: string;
  sourcePage?: string | null;
  sourceDocumentId?: string | null;
  verified: boolean;
  note?: string | null;
}

export const LABEL_MAX = 120;
export const TERM_MAX = 200;
export const NOTE_MAX = 500;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isDay = (s: string | null | undefined): s is string => !!s && DAY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function validZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/* ------------------------------------------------------------------ *
 * Counting
 * ------------------------------------------------------------------ */

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** The nth weekday (0 Sunday) of a month, or the last one when n is -1. */
function nthWeekday(year: number, month: number, dow: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const date = 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
    return new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  const back = (last.getUTCDay() - dow + 7) % 7;
  return new Date(Date.UTC(year, month, last.getUTCDate() - back)).toISOString().slice(0, 10);
}

/** A fixed-date holiday falling on a weekend is observed on the Friday before or the Monday after. */
function observed(day: string): string {
  const w = weekday(day);
  return w === 6 ? addDays(day, -1) : w === 0 ? addDays(day, 1) : day;
}

/** US federal holidays as observed in a year (5 U.S.C. 6103), for business-days-v1. */
export function federalHolidays(year: number): Set<string> {
  const fixed = (m: number, d: number) => observed(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return new Set([
    fixed(1, 1), nthWeekday(year, 0, 1, 3), nthWeekday(year, 1, 1, 3), nthWeekday(year, 4, 1, -1),
    fixed(6, 19), fixed(7, 4), nthWeekday(year, 8, 1, 1), nthWeekday(year, 9, 1, 2),
    fixed(11, 11), nthWeekday(year, 10, 4, 4), fixed(12, 25),
    /* Next year's New Year's Day, observed on Dec 31 when Jan 1 is a Saturday. */
    observed(`${year + 1}-01-01`),
  ]);
}

export const isBusinessDay = (day: string) => {
  const w = weekday(day);
  if (w === 0 || w === 6) return false;
  return !federalHolidays(Number(day.slice(0, 4))).has(day);
};

/** The date a rule gives, or null when the rule cannot give one from these inputs. */
export function countDate(rule: RuleId, input: Pick<DeadlineInput, "date" | "triggerDate" | "days">): string | null {
  if (rule === "as-written") return isDay(input.date) ? input.date : null;
  if (!isDay(input.triggerDate) || !Number.isInteger(input.days) || (input.days ?? 0) < 1) return null;
  if (rule === "calendar-days-v1") return addDays(input.triggerDate, input.days!);
  let day = input.triggerDate;
  let counted = 0;
  while (counted < input.days!) {
    day = addDays(day, 1);
    if (isBusinessDay(day)) counted++;
  }
  return day;
}

/* ------------------------------------------------------------------ *
 * Recording
 * ------------------------------------------------------------------ */

export interface Resolved {
  dueDate: string;
  /** Only when the document states a time. */
  dueTime: string | null;
  timezone: string;
  /** Only when there is a time: a date alone has no instant (AT26). */
  dueAt: string | null;
}

/** Why a revision cannot be recorded, or null. */
export function deadlineError(input: DeadlineInput): string | null {
  if (!RULE_IDS.includes(input.rule)) return "Choose how the date is reached";
  const term = input.sourceTerm?.trim() ?? "";
  if (term.length < 3) return "Say where it comes from in the contract, like \"Paragraph 12, due diligence\"";
  if (term.length > TERM_MAX) return `Keep the source under ${TERM_MAX} characters`;
  if (input.sourcePage && input.sourcePage.length > 40) return "Keep the page reference short";
  if (input.rule === "as-written" && !isDay(input.date)) return "Give the date as it is written";
  if (input.rule !== "as-written") {
    if (!input.triggerLabel?.trim()) return "Say what the days are counted from, like \"Binding agreement date\"";
    if (!isDay(input.triggerDate)) return "Give the date the days are counted from";
    if (!Number.isInteger(input.days) || (input.days ?? 0) < 1 || (input.days ?? 0) > 365) return "Give the number of days, 1 to 365";
  }
  if (input.time && !TIME_RE.test(input.time)) return "Give the time as it is written, like 17:00";
  if (!validZone(input.timezone ?? TOUR_TIMEZONE)) return "That time zone is not one Rift knows";
  if (input.note && input.note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters`;
  return null;
}

/** The date, time and instant a valid input gives. */
export function resolve(input: DeadlineInput): Resolved | null {
  if (deadlineError(input)) return null;
  const dueDate = countDate(input.rule, input)!;
  const timezone = input.timezone ?? TOUR_TIMEZONE;
  const dueTime = input.time ?? null;
  return { dueDate, dueTime, timezone, dueAt: dueTime ? zonedToUtc(dueDate, dueTime, timezone) : null };
}

export function labelError(label: string): string | null {
  const t = label.trim();
  if (t.length < 3) return "Name the date, like \"Due diligence period ends\"";
  if (t.length > LABEL_MAX) return `Keep the name under ${LABEL_MAX} characters`;
  return null;
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

export interface Revision extends Resolved {
  seq: number;
  state: RevisionState;
  rule: RuleId;
  triggerLabel: string | null;
  triggerDate: string | null;
  days: number | null;
  sourceTerm: string;
  sourcePage: string | null;
  sourceDocumentId: string | null;
  amendment: string | null;
  verified: boolean;
  note: string | null;
  by: string;
  at: string;
}

export type Timing = "upcoming" | "due-today" | "past";

export interface DeadlineView {
  state: RevisionState;
  timing: Timing | null;
  /** Whole days to the due date in its own time zone. Negative when past. */
  days: number | null;
  verified: boolean;
  /** "Fri, Oct 3 (no time stated)" or "Fri, Oct 3, 5:00 PM (New York time)". */
  when: string;
  /** Active, contractual, and past: the item that stays urgent until the agent records what happened. */
  missed: boolean;
  current: Revision;
}

const ZONE_NAME = (tz: string) => (tz === "America/New_York" ? "Georgia time" : tz.replace(/_/g, " "));

export function whenText(r: Pick<Resolved, "dueDate" | "dueTime" | "timezone" | "dueAt">): string {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${r.dueDate}T12:00:00Z`));
  if (!r.dueAt || !r.dueTime) return `${day} (no time stated)`;
  const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: r.timezone }).format(new Date(r.dueAt));
  return `${day}, ${t} (${ZONE_NAME(r.timezone)})`;
}

const DAY_MS = 86_400_000;

export function deadlineView(revisions: Revision[], kind: DeadlineKind, now = new Date()): DeadlineView {
  const current = [...revisions].sort((a, b) => a.seq - b.seq).at(-1)!;
  const today = marketDay(now, current.timezone);
  const days = Math.round((Date.parse(current.dueDate) - Date.parse(today)) / DAY_MS);
  let timing: Timing | null = null;
  if (current.state === "active") {
    /* A stated time is compared as an instant; a date alone only by the day,
       in its own zone. Neither gets a time it was not given. */
    const past = current.dueAt ? now.getTime() > Date.parse(current.dueAt) : today > current.dueDate;
    timing = past ? "past" : days === 0 ? "due-today" : "upcoming";
  }
  return {
    state: current.state, timing, days: current.state === "active" ? days : null, verified: current.verified,
    when: whenText(current), missed: kind === "contractual" && timing === "past", current,
  };
}

/** How far off a date is, in days only: never hours for a date without a time. */
export function inDays(days: number): string {
  if (days < -1) return `${-days} days ago`;
  if (days === -1) return "yesterday";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** One line for the buyer. Only for checked, contractual dates; a missed one never says what it means legally. */
export function buyerDateLine(label: string, v: DeadlineView, agentFirst: string): string | null {
  if (!v.verified || v.state === "removed") return null;
  if (v.state === "met") return `${label}: done.`;
  if (v.timing === "past") return `${label} was ${v.when}. ${agentFirst} is handling what happens next.`;
  return `${label}: ${v.when}, ${inDays(v.days!)}.`;
}

/* ------------------------------------------------------------------ *
 * Amendments (AT27)
 * ------------------------------------------------------------------ */

export interface AmendmentChange {
  deadlineId: string;
  /** Remove the date (a contingency struck out), or give its new terms. */
  remove: boolean;
  input: DeadlineInput | null;
}

/** Why an amendment cannot be recorded, or null. Every change carries the amendment as its source. */
export function amendmentError(reference: string, changes: AmendmentChange[]): string | null {
  if (reference.trim().length < 3) return "Name the amendment, like \"Amendment 1, executed Oct 2\"";
  if (reference.length > TERM_MAX) return `Keep the amendment's name under ${TERM_MAX} characters`;
  if (!changes.length) return "Choose at least one date the amendment changes";
  if (new Set(changes.map((c) => c.deadlineId)).size !== changes.length) return "Each date can change once in one amendment";
  for (const c of changes) {
    if (c.remove) continue;
    if (!c.input) return "Give the new date";
    const bad = deadlineError(c.input);
    if (bad) return bad;
    if (!c.input.verified) return "An amendment is recorded from the executed document: mark each new date as checked against it";
  }
  return null;
}
