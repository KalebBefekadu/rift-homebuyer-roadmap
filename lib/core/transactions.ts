/**
 * Every contract at once (Blueprint v5 §8.7): what the Transactions view and
 * Today's "waiting on others" and "upcoming" groups read.
 *
 * The rules are the ones each journey already follows. A date counts only
 * once it is checked against the document, and a missed one stays urgent
 * until somebody records what happened. A workstream with no word for a week
 * says so. Nothing here clears itself or guesses what a date means legally.
 *
 * Pure: no I/O. The read is lib/db/transactions.ts.
 */

import { STALE_DAYS, WORKSTREAM_LABEL, isSettled, type ContractOutcome, type Financing, type Stage, type Workstream, type WorkstreamView } from "./progress";
import type { DeadlineKind, DeadlineView } from "./deadline";

export interface ContractDate {
  id: string;
  label: string;
  kind: DeadlineKind;
  workstream: Workstream | null;
  view: DeadlineView;
}

export interface ContractSummary {
  id: string;
  journeyId: string;
  journeyLabel: string;
  leadId: string;
  person: string;
  address: string;
  financing: Financing;
  stage: Stage;
  recordedAt: string;
  outcome: { outcome: ContractOutcome; at: string } | null;
  work: WorkstreamView[];
  dates: ContractDate[];
}

/** Why a date is on Today, if it is. The same three reasons the journey page gives. */
export type DateWhy = "missed" | "unchecked" | "soon";

export interface DateAttention {
  journeyId: string;
  transactionId: string;
  deadlineId: string;
  person: string;
  address: string;
  label: string;
  when: string;
  why: DateWhy;
  days: number | null;
}

const open = (c: ContractSummary) => !c.outcome;
const active = (d: ContractDate) => d.view.state === "active";

/**
 * Dates on open contracts that need the agent: missed ones, ones not yet
 * checked against the document, and checked ones due within `aheadDays`.
 * Missed first, then unchecked, then soonest.
 */
export function datesNeeding(contracts: ContractSummary[], aheadDays: number): DateAttention[] {
  const out: DateAttention[] = [];
  for (const c of contracts.filter(open)) {
    for (const d of c.dates.filter(active)) {
      const v = d.view;
      const why: DateWhy | null = v.missed ? "missed" : !v.verified ? "unchecked" : v.days !== null && v.days <= aheadDays ? "soon" : null;
      if (!why) continue;
      out.push({ journeyId: c.journeyId, transactionId: c.id, deadlineId: d.id, person: c.person, address: c.address, label: d.label, when: v.when, why, days: v.days });
    }
  }
  const order: Record<DateWhy, number> = { missed: 0, unchecked: 1, soon: 2 };
  return out.sort((a, b) => order[a.why] - order[b.why] || (a.days ?? 0) - (b.days ?? 0));
}

/** The next checked date still ahead on a contract, or null. */
export function nextDate(c: ContractSummary): ContractDate | null {
  return c.dates
    .filter((d) => active(d) && d.view.verified && !d.view.missed && d.view.days !== null && d.view.days >= 0)
    .sort((a, b) => a.view.days! - b.view.days!)[0] ?? null;
}

/** What is wrong on a contract, in words: blocked, missed, unchecked, stale, reported and not confirmed. */
export function contractFlags(c: ContractSummary): string[] {
  const out: string[] = [];
  for (const w of c.work) if (w.state === "blocked") out.push(`${w.label} blocked${w.note ? `: ${w.note}` : ""}`);
  const missed = c.dates.filter((d) => active(d) && d.view.missed);
  if (missed.length) out.push(`${missed.length === 1 ? `${missed[0]!.label} passed` : `${missed.length} dates passed`}, not recorded as met`);
  const unchecked = c.dates.filter((d) => active(d) && !d.view.verified);
  if (unchecked.length) out.push(`${unchecked.length} date${unchecked.length === 1 ? "" : "s"} not checked against the document`);
  const reported = c.work.filter((w) => w.state === "reported");
  if (reported.length) out.push(`${reported.map((w) => w.label).join(", ")} reported done, not confirmed`);
  const stale = c.work.filter((w) => w.stale && !isSettled(w.state) && w.state !== "blocked");
  if (stale.length) out.push(`No word for ${STALE_DAYS}+ days: ${stale.map((w) => w.label).join(", ")}`);
  return out;
}

export interface Waiting {
  journeyId: string;
  transactionId: string;
  person: string;
  address: string;
  workstream: Workstream;
  label: string;
  /** "The lender", "Dana at Peach Mortgage", or the client. */
  on: string;
  state: WorkstreamView["state"];
  lastWord: WorkstreamView["lastWord"];
  stale: boolean;
  /** The day to ask again: a week after the last word, or today when there has been none. */
  checkIn: string;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Open workstreams that someone other than the agent is doing, with the
 * last word and when to ask again (§8.4). The client's own items count: a
 * buyer who has not sent the insurance binder is somebody else's move.
 */
export function waitingOnOthers(contracts: ContractSummary[], today: string): Waiting[] {
  const out: Waiting[] = [];
  for (const c of contracts.filter(open)) {
    for (const w of c.work) {
      if (w.owner === "agent" || isSettled(w.state) || w.state === "not-started" || w.state === "blocked") continue;
      out.push({
        journeyId: c.journeyId, transactionId: c.id, person: c.person, address: c.address, workstream: w.workstream,
        label: WORKSTREAM_LABEL[w.workstream],
        on: w.owner === "client" ? c.person : w.ownerName ?? "Someone else",
        state: w.state, lastWord: w.lastWord, stale: w.stale,
        checkIn: w.lastWord ? addDays(w.lastWord.on, STALE_DAYS) : today,
      });
    }
  }
  return out.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}
