/**
 * The next few weeks, across everybody.
 *
 * Pure. Studio's Today screen answers "what do I do now"; this answers "what
 * does the next month look like", which is a different question and the one
 * an agent asks on a Sunday evening.
 *
 * Two things it refuses to do.
 *
 * It does not invent a grid. A month view with twenty-two empty cells is a
 * picture of a calendar, not a calendar: an agent with four things in the
 * next fortnight should see four things. Days with nothing in them are not
 * rendered, and the gaps are named in words instead.
 *
 * It does not merge the two kinds of commitment. A next action is something
 * he promised himself; a plan step is something a CLIENT can see he promised
 * them, on a page they may have open. Those carry different weight and the
 * page says which is which.
 */

import { daysUntil } from "./day";
import type { ContractSummary } from "./transactions";

export type CommitmentKind = "action" | "step" | "date";

export interface Commitment {
  id: string;
  kind: CommitmentKind;
  /** What is owed, in his own words. */
  what: string;
  /** ISO date. Everything here has one: that is what puts it on a calendar. */
  dueOn: string;
  /** Who it is about. */
  personId: string;
  personName: string;
  /** Absent for a contract date read without its side. */
  side?: "buy" | "sell";
  /** True when the client can see this commitment on their own page. */
  visibleToThem: boolean;
  /** Who owes it. Only meaningful for a step. */
  owner?: "client" | "agent" | "other";
  ownerName?: string | null;
  /** A contract date opens its journey's Contract tab, not the person's record. */
  href?: string;
  /** For a contract date: the property, and the date as the contract words it. */
  address?: string;
  whenText?: string;
  /** For a contract date: whether it was checked against the document, which is what lets the client see it. */
  checked?: boolean;
}

export interface AgendaDay {
  date: string;
  /** "Today", "Tomorrow", "Friday", "Fri 3 Oct". */
  label: string;
  /** Negative when the day has passed. */
  daysAway: number;
  items: Commitment[];
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const daysAway = (dueOn: string, today: Date): number => daysUntil(dueOn, today);

/**
 * How a day reads.
 *
 * Named days for the near ones, because "Thursday" is how somebody plans and
 * "Oct 2" is how a database stores. Beyond a week the weekday stops being
 * useful on its own (there are two Thursdays in a fortnight) so the date
 * comes back.
 */
export function dayLabel(dueOn: string, today: Date): string {
  const away = daysAway(dueOn, today);
  if (away === 0) return "Today";
  if (away === 1) return "Tomorrow";
  if (away === -1) return "Yesterday";

  const d = new Date(`${dueOn}T00:00:00Z`);
  const weekday = WEEKDAY[d.getUTCDay()]!;
  if (away > 1 && away < 7) return weekday;

  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const short = `${weekday.slice(0, 3)} ${d.getUTCDate()} ${month}`;
  return away < 0 ? `${short}, overdue` : short;
}

/**
 * Group commitments into the days that actually have something in them.
 *
 * `horizonDays` bounds the forward view. Anything further out is genuinely not
 * this month's problem, and including it would make the page long in exactly
 * the way that stops it being read.
 */
export function buildAgenda(items: Commitment[], today = new Date(), horizonDays = 35): AgendaDay[] {
  const by = new Map<string, Commitment[]>();

  for (const item of items) {
    const away = daysAway(item.dueOn, today);
    /* Overdue is always shown, however far back. Something promised to a
       client three weeks ago and never done does not stop mattering because
       it scrolled off a window. */
    if (away > horizonDays) continue;
    (by.get(item.dueOn) ?? by.set(item.dueOn, []).get(item.dueOn)!).push(item);
  }

  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      label: dayLabel(date, today),
      daysAway: daysAway(date, today),
      /* Within a day, what the client can see comes first. He is more exposed
         on those: they are on a page somebody may have open. */
      items: [...list].sort((a, b) =>
        Number(b.visibleToThem) - Number(a.visibleToThem) || a.what.localeCompare(b.what)),
    }));
}

export interface AgendaSummary {
  overdue: number;
  today: number;
  thisWeek: number;
  /** Of the overdue ones, how many a client can see. */
  overdueAndVisible: number;
  /** Days between now and the horizon with nothing on them at all. */
  clearDays: number;
}

export function summariseAgenda(days: AgendaDay[], horizonDays = 35): AgendaSummary {
  const overdue = days.filter((d) => d.daysAway < 0);
  return {
    overdue: overdue.reduce((n, d) => n + d.items.length, 0),
    today: days.find((d) => d.daysAway === 0)?.items.length ?? 0,
    thisWeek: days.filter((d) => d.daysAway >= 0 && d.daysAway <= 7)
      .reduce((n, d) => n + d.items.length, 0),
    overdueAndVisible: overdue.reduce(
      (n, d) => n + d.items.filter((i) => i.visibleToThem).length, 0),
    /* Counted from the days that HAVE something, so a month with four busy
       days reports thirty-one clear ones rather than rendering them. */
    clearDays: Math.max(0, horizonDays - days.filter((d) => d.daysAway >= 0).length),
  };
}

/**
 * The line at the top.
 *
 * Leads with what a client can see, because that is the commitment with
 * somebody else's attention on it. "Three things are overdue" is a private
 * embarrassment; "two of them are on a page your client can open" is a
 * different fact and the one that decides what he does next.
 */
export function agendaHeadline(s: AgendaSummary): string {
  if (s.overdue > 0) {
    const late = s.overdue === 1 ? "One thing is overdue" : `${s.overdue} things are overdue`;
    if (s.overdueAndVisible === 0) return `${late}.`;
    return s.overdueAndVisible === s.overdue
      ? `${late}, and ${s.overdue === 1 ? "it is" : "they are"} on pages your clients can open.`
      : `${late}; ${s.overdueAndVisible} on a page a client can open.`;
  }
  if (s.today > 0) return s.today === 1 ? "One thing is due today." : `${s.today} things are due today.`;
  if (s.thisWeek > 0) return `Nothing today. ${s.thisWeek} this week.`;
  return "Nothing is due in the next five weeks.";
}

/**
 * Contract dates as calendar entries.
 *
 * The calendar was built from plan steps and next actions only, so a due
 * diligence deadline tomorrow or a closing next week, the dates that carry
 * legal weight, were on Today and nowhere on the month. A date that has passed
 * without being recorded as met stays on the calendar as overdue, however far
 * back, like any promise; a checked date is one the client can see, an
 * unchecked one is the agent's own note until it is checked against the
 * document. Ended contracts have no dates left to keep.
 */
export function contractDateCommitments(contracts: ContractSummary[]): Commitment[] {
  const out: Commitment[] = [];
  for (const c of contracts) {
    if (c.outcome) continue;
    for (const d of c.dates) {
      const v = d.view;
      if (v.state !== "active") continue;
      /* A date that passed and was never contractual is history, not a miss. */
      if (!v.missed && (v.days === null || v.days < 0)) continue;
      out.push({
        id: `date:${d.id}`, kind: "date", what: d.label, dueOn: v.current.dueDate,
        personId: c.leadId, personName: c.person, ...(c.side ? { side: c.side } : {}),
        visibleToThem: v.verified, href: `/operations/journey/${c.journeyId}?tab=contract`,
        address: c.address, whenText: v.when, checked: v.verified,
      });
    }
  }
  return out;
}
