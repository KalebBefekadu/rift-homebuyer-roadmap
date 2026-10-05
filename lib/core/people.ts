/**
 * Reading a person on Relationships and on their record.
 *
 * Every helper here exists because the screen was getting one of these wrong
 * by computing it inline: a closed client flagged "Call today" from a funnel
 * band four months old, a referral labelled "Added by hand", an overdue step
 * drawn exactly like a future one, "1 months ago". Pure: no React, no I/O.
 */

import { daysBetween, georgiaDay, showDay } from "./day";
import { TERMINAL, type ManagedLead, type Stage } from "./pipeline";
import type { Band } from "./lead";

/* ------------------------------------------------------------------ *
 * Words for codes
 * ------------------------------------------------------------------ */

const SOURCE_LABEL: Record<string, string> = {
  funnel: "From the funnel",
  manual: "Added by hand",
  referral: "Referred",
  import: "Imported",
  equb: "Equb seat request",
};

/** Whether a person arrived through a public page (the funnel, or the Equb page shown as its own source). */
export const fromVisitor = (source: string): boolean => source === "funnel" || source === "equb";

/** The source a person is known by, as a phrase. An unknown code is shown as itself rather than guessed at. */
export const sourceLabel = (source: string): string => SOURCE_LABEL[source] ?? source;

/**
 * Whether the funnel band still means anything.
 *
 * The band is the funnel's triage at the moment somebody arrived: call today,
 * this week, and so on. It is an instruction about picking them UP. Once they
 * have a stage the agent is working them and the band is history; showing a
 * red "Call today" beside a client who closed in June is an instruction nobody
 * should follow. Archived people are not being picked up by anyone either.
 */
export const bandIsLive = (p: Pick<ManagedLead, "band" | "stage" | "archivedAt">): p is typeof p & { band: Band } =>
  Boolean(p.band) && !p.stage && !p.archivedAt;

/* ------------------------------------------------------------------ *
 * Time, said the way a person would say it
 * ------------------------------------------------------------------ */

/** "today", "yesterday", "3 days ago", "2 weeks ago", "1 month ago". Counted in Georgia's days. */
export function ago(iso: string, now = new Date()): string {
  const days = daysBetween(georgiaDay(new Date(iso)), georgiaDay(now));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) { const m = Math.floor(days / 30); return `${m} month${m === 1 ? "" : "s"} ago`; }
  const y = Math.floor(days / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

export type DueState = "overdue" | "today" | "soon" | "later";

export interface DueView {
  state: DueState;
  /** "Overdue 4 days", "Due today", "Due tomorrow", "Due in 3 days", "Due Oct 20". */
  label: string;
  /** Days from today; negative once passed. */
  days: number;
}

/**
 * When a next step is owed, compared as calendar days in Georgia. A step due
 * today is not overdue at nine in the morning because the row was written at
 * five the night before.
 */
export function dueView(due: string, now = new Date()): DueView {
  const days = daysBetween(georgiaDay(now), due);
  if (days < 0) return { state: "overdue", days, label: `Overdue ${-days} day${days === -1 ? "" : "s"}` };
  if (days === 0) return { state: "today", days, label: "Due today" };
  if (days === 1) return { state: "soon", days, label: "Due tomorrow" };
  if (days <= 7) return { state: "soon", days, label: `Due in ${days} days` };
  return { state: "later", days, label: `Due ${showDay(due)}` };
}

/* ------------------------------------------------------------------ *
 * Stages by side
 * ------------------------------------------------------------------ */

/**
 * The stages that make sense on each side. The vocabulary in pipeline.ts is
 * one list for both, so a buyer could be moved to "Preparing the property"
 * and a seller to "Searching". Nothing refuses those, so the choice is simply
 * not offered; a person already in an off-side stage keeps it and it is shown.
 */
const BUY_STAGES: Stage[] = ["Exploring", "Building readiness", "Financing", "Ready to shop", "Searching", "Reviewing offers", "Under contract", "Closing", "Closed", "Lost"];
const SELL_STAGES: Stage[] = ["Exploring", "Preparing the property", "Reviewing offers", "Under contract", "Closing", "Closed", "Lost"];

export const stagesFor = (side: "buy" | "sell"): Stage[] => (side === "buy" ? BUY_STAGES : SELL_STAGES);

/** Where somebody new can start. Nobody is added as already lost. */
export const startingStagesFor = (side: "buy" | "sell"): Stage[] => stagesFor(side).filter((s) => s !== "Lost");

export const isTerminal = (stage: string | null): boolean => Boolean(stage) && (TERMINAL as readonly string[]).includes(stage!);

/* ------------------------------------------------------------------ *
 * Narrowing and ordering the list
 * ------------------------------------------------------------------ */

/** Two weeks without a logged call, text, email or meeting. */
export const QUIET_DAYS = 14;

export const STAGE_FILTERS = ["any", "none", "early", "active", "contract", "done"] as const;
export type StageFilter = (typeof STAGE_FILTERS)[number];
export const STAGE_FILTER_LABEL: Record<StageFilter, string> = {
  any: "Any stage",
  none: "Not picked up",
  early: "Getting ready",
  active: "Searching or selling",
  contract: "Under contract or closing",
  done: "Closed or lost",
};
/* Grouped rather than one option per stage: eleven stages in a filter is a
   list nobody reads, and these are the questions actually asked of it. */
const STAGE_GROUP: Record<Exclude<StageFilter, "any" | "none">, readonly string[]> = {
  early: ["Exploring", "Building readiness", "Financing", "Preparing the property", "Ready to shop"],
  active: ["Searching", "Reviewing offers"],
  contract: ["Under contract", "Closing"],
  done: ["Closed", "Lost"],
};

export const NEXT_FILTERS = ["any", "overdue", "week", "none"] as const;
export type NextFilter = (typeof NEXT_FILTERS)[number];
export const NEXT_FILTER_LABEL: Record<NextFilter, string> = {
  any: "Any next step",
  overdue: "Overdue",
  week: "Due in 7 days",
  none: "None set",
};

export const CONTACT_FILTERS = ["any", "recent", "quiet", "never"] as const;
export type ContactFilter = (typeof CONTACT_FILTERS)[number];
export const CONTACT_FILTER_LABEL: Record<ContactFilter, string> = {
  any: "Any last contact",
  recent: `In the last ${QUIET_DAYS} days`,
  quiet: `None in ${QUIET_DAYS} days`,
  never: "Never logged",
};

export const SORTS = ["arrived", "due", "quiet", "name"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = {
  arrived: "Newest first",
  due: "Next step due",
  quiet: "Longest since contact",
  name: "Name",
};

export interface Narrowing {
  stage: StageFilter;
  next: NextFilter;
  contact: ContactFilter;
}

export const pick = <T extends string>(allowed: readonly T[], v: string | undefined, fallback: T): T =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

type Person = Pick<ManagedLead, "id" | "name" | "email" | "stage" | "nextDue" | "createdAt">;

/**
 * Narrow people by stage group, next step and last contact.
 *
 * `contacts` is null when the last-contact read failed. Filtering on it then
 * would drop everyone as "never contacted", so the contact filter is ignored
 * and the page says so.
 */
export function narrowPeople<P extends Person>(people: P[], contacts: Map<string, string> | null, n: Narrowing, now = new Date()): P[] {
  const today = georgiaDay(now);
  return people.filter((p) => {
    if (n.stage === "none" && p.stage) return false;
    if (n.stage !== "any" && n.stage !== "none" && !STAGE_GROUP[n.stage].includes(p.stage ?? "")) return false;

    if (n.next === "none" && p.nextDue) return false;
    if (n.next === "overdue" && !(p.nextDue && p.nextDue < today)) return false;
    if (n.next === "week" && !(p.nextDue && daysBetween(today, p.nextDue) <= 7)) return false;

    if (contacts && n.contact !== "any") {
      const at = contacts.get(p.id);
      if (n.contact === "never" && at) return false;
      if (n.contact !== "never") {
        if (!at) return n.contact === "quiet";
        const quiet = daysBetween(georgiaDay(new Date(at)), today) > QUIET_DAYS;
        if (n.contact === "quiet" && !quiet) return false;
        if (n.contact === "recent" && quiet) return false;
      }
    }
    return true;
  });
}

/**
 * Order people. The roster arrives newest first, so "arrived" keeps it.
 * "quiet" puts never-contacted people first: nobody has been left alone
 * longer than somebody nobody has spoken to.
 */
export function sortPeople<P extends Person>(people: P[], contacts: Map<string, string> | null, sort: Sort): P[] {
  const out = [...people];
  const nameOf = (p: P) => (p.name?.trim() || p.email || "").toLocaleLowerCase();
  if (sort === "name") out.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (sort === "due") out.sort((a, b) => (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999"));
  if (sort === "quiet" && contacts) out.sort((a, b) => (contacts.get(a.id) ?? "").localeCompare(contacts.get(b.id) ?? ""));
  return out;
}

/* ------------------------------------------------------------------ *
 * Somebody already on record
 * ------------------------------------------------------------------ */

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/**
 * People already on record with the same email or phone. Email ignores case
 * and spaces; phone compares digits, with a leading US country code dropped,
 * so "(404) 555-0142" and "+1 404 555 0142" are one number. A phone shorter
 * than seven digits is not compared: it matches too much to mean anything.
 */
export function sameContact<P extends Pick<ManagedLead, "email" | "phone">>(people: P[], email?: string | null, phone?: string | null): P[] {
  const e = (email ?? "").trim().toLowerCase();
  const d = digits(phone);
  return people.filter((p) =>
    (e && (p.email ?? "").trim().toLowerCase() === e) ||
    (d.length >= 7 && digits(p.phone) === d));
}
