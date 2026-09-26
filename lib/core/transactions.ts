import { WORKSTREAMS, type Financing, type WorkstreamView } from "./progress";
import type { DeadlineView } from "./deadline";

/**
 * Every deal under contract, one row each (Blueprint v5 §8.4, Transactions).
 *
 * The journey page is where one deal is worked; this is where the agent sees
 * all of them at once and picks which to open. Pure: the database module
 * gathers the facts, and everything a row claims is decided here, where it is
 * tested.
 *
 * Nothing here says a deal is fine. A row with nothing to flag says
 * "Nothing flagged", which is what is true: nobody has reported a problem,
 * not that there is none (UX-04).
 */

export interface DealDate {
  label: string;
  workstream: string | null;
  view: DeadlineView;
}

export interface DealInput {
  journeyId: string;
  person: string;
  address: string;
  financing: Financing;
  /** When the contract was recorded. */
  contractedAt: string;
  work: WorkstreamView[];
  dates: DealDate[];
}

export type FlagTone = "neg" | "warn";
export interface Flag { tone: FlagTone; text: string }

export interface DealRow extends DealInput {
  /** The closing date, when one is recorded. */
  closing: { when: string; days: number | null; verified: boolean } | null;
  /** The soonest date still to come or still to be dealt with, other than closing. */
  next: { label: string; when: string; days: number | null; missed: boolean; verified: boolean } | null;
  confirmed: number;
  applicable: number;
  /** What needs a look, worst first. */
  flags: Flag[];
}

const isClosing = (d: DealDate) => d.workstream === "closing" || /\bclos(e|ing)\b/i.test(d.label);

export function dealRow(d: DealInput): DealRow {
  const active = d.dates.filter((x) => x.view.state === "active");
  const byDue = [...active].sort((a, b) => a.view.current.dueDate.localeCompare(b.view.current.dueDate));
  const closingDate = byDue.find(isClosing) ?? null;
  const nextDate = byDue.find((x) => x !== closingDate) ?? null;

  const flags: Flag[] = [];
  for (const x of byDue.filter((y) => y.view.missed)) flags.push({ tone: "neg", text: `${x.label}: date passed, nothing recorded` });
  for (const w of d.work.filter((y) => y.state === "blocked")) flags.push({ tone: "neg", text: `${w.label}: blocked${w.note ? `, ${w.note}` : ""}` });
  for (const x of byDue.filter((y) => !y.view.missed && !y.view.verified)) flags.push({ tone: "warn", text: `${x.label}: not checked against the contract` });
  for (const w of d.work.filter((y) => y.state === "reported")) flags.push({ tone: "warn", text: `${w.label}: reported done, not confirmed` });
  for (const w of d.work.filter((y) => y.stale && y.state !== "blocked")) {
    flags.push({ tone: "warn", text: `${w.label}: ${w.daysSinceWord === null ? "no word yet" : `no word for ${w.daysSinceWord} days`}` });
  }

  const shown = WORKSTREAMS.map((s) => d.work.find((w) => w.workstream === s)).filter((w): w is WorkstreamView => Boolean(w));
  return {
    ...d,
    work: shown,
    closing: closingDate ? { when: closingDate.view.when, days: closingDate.view.days, verified: closingDate.view.verified } : null,
    next: nextDate ? {
      label: nextDate.label, when: nextDate.view.when, days: nextDate.view.days,
      missed: nextDate.view.missed, verified: nextDate.view.verified,
    } : null,
    confirmed: shown.filter((w) => w.state === "confirmed").length,
    applicable: shown.filter((w) => w.state !== "not-applicable").length,
    flags,
  };
}

/**
 * Deals with a problem first, then by closing, soonest first; a deal with no
 * closing date recorded goes last, because "we do not know when" must not
 * read as "not soon".
 */
export function sortDeals(rows: DealRow[]): DealRow[] {
  const worst = (r: DealRow) => (r.flags.some((f) => f.tone === "neg") ? 0 : 1);
  return [...rows].sort((a, b) =>
    worst(a) - worst(b)
    || (a.closing ? 0 : 1) - (b.closing ? 0 : 1)
    || (a.closing?.days ?? 0) - (b.closing?.days ?? 0)
    || a.contractedAt.localeCompare(b.contractedAt));
}

/** The line at the top of the page: counts, and nothing that is not counted. */
export function dealsSummary(rows: DealRow[]): string {
  if (!rows.length) return "Nothing under contract.";
  const neg = rows.filter((r) => r.flags.some((f) => f.tone === "neg")).length;
  const within = rows.filter((r) => r.closing && r.closing.days !== null && r.closing.days >= 0 && r.closing.days <= 14).length;
  const parts = [`${rows.length} under contract`];
  if (neg) parts.push(`${neg} with something blocked or missed`);
  if (within) parts.push(`${within} closing in the next two weeks`);
  return `${parts.join(", ")}.`;
}
