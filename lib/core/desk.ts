/**
 * The agent's Today, in five groups (Blueprint v5 §8.2, §8.4; OPS-02).
 *
 *   Needs attention      passed contract dates, blocked work, jobs that did
 *                        not run, messages that may have sent, overdue
 *                        promises, figure checks past their window, lapsed
 *                        agreements, a stale rate, withheld programs.
 *   Needs your approval  drafts, flagged program pages, figure checks, dates
 *                        not yet checked against the document, a seller's
 *                        chosen offer.
 *   Today                promises due today and follow-ups that need him.
 *   Waiting on others    workstreams and plan steps someone else is doing,
 *                        with the last word and when to ask again.
 *   Upcoming             checked contract dates and promises in the next two
 *                        weeks, agreements running out.
 *
 * Every item says why it is there, who owns it, what it is about, the
 * evidence, when it is due and the next action. The grouping is a rule, not
 * a score: nothing is ranked by what it is worth.
 *
 * Snooze, pin and delegate (OPS-02) are marks laid over the items. A snooze
 * has an owner and a time to come back and never applies to a contract date,
 * because hiding a date's reminder must never look like moving the date. A
 * pin has a reason and an end. A delegation shows as not accepted until
 * somebody says it was.
 *
 * Pure: no I/O. The reads are the page's; the marks are lib/db/desk.ts.
 */

import type { Commitment } from "./agenda";
import type { ContractSummary, DateAttention, Waiting } from "./transactions";
import { LATE_DAYS, type CadenceDue, type PricingAnswer } from "./seller-cadence";

export type Group = "attention" | "approval" | "today" | "waiting" | "upcoming";
export const GROUPS: Group[] = ["attention", "approval", "today", "waiting", "upcoming"];

export const GROUP_LABEL: Record<Group, string> = {
  attention: "Needs attention",
  approval: "Needs your approval",
  today: "Today",
  waiting: "Waiting on others",
  upcoming: "Upcoming",
};

/** The §8.2 question each group answers. */
export const GROUP_QUESTION: Record<Group, string> = {
  attention: "What needs my attention now?",
  approval: "What needs my approval?",
  today: "What is happening today?",
  waiting: "What is waiting on someone else?",
  upcoming: "What deadlines are coming?",
};

/** How far ahead Upcoming looks. */
export const UPCOMING_DAYS = 14;

export type Tone = "neg" | "warn" | "pos" | "none";

export interface DeskItem {
  /** Stable across days, so a snooze or pin finds it again. */
  key: string;
  group: Group;
  title: string;
  why: string;
  owner: string;
  about: { label: string; href: string } | null;
  evidence: string | null;
  due: string | null;
  next: string;
  /** Where the next action is taken. */
  href: string;
  tone: Tone;
  /** A contract date is never snoozed. */
  snoozable: boolean;
  /** Earlier sorts first inside a group. */
  order: number;
}

export interface DeskInput {
  agentFirst: string;
  /** Georgia's calendar day, YYYY-MM-DD. */
  today: string;
  dates: DateAttention[];
  contracts: ContractSummary[];
  waiting: Waiting[];
  commitments: Commitment[];
  touches: { leadId: string; name: string; says: string; channel: string; daysLate: number }[];
  outbox: { id: string; state: "prepared" | "approved" | "failed" | "unknown"; subject: string; to: string }[];
  programFlags: string[];
  /** Records nobody re-verified in time, and who owns re-verifying them (a setting). */
  programsWithheld: { names: string[]; owner: string; withinDays: number };
  reviews: { id: string; who: string; whoId: string; what: string; waitingHours: number; overdue: boolean }[];
  jobProblems: string[];
  lapsing: { id: string; name: string; covered: boolean; note: string }[];
  choices: { leadId: string; name: string; from: string; note: string | null }[];
  rate: { stale: boolean; pct: number; age: string };
  /** A sale's pricing review or weekly listing review that has come due (S04, S09). */
  sales?: CadenceDue[];
  /** Sellers' answers to the current pricing, from their page. */
  pricingAnswers?: PricingAnswer[];
  /** Open links between a sale and a purchase (STATE-07). */
  dependencies?: { id: string; purchaseJourneyId: string; purchaseLabel: string; line: string; owner: string; note: string }[];
}

const DAY = 86_400_000;
const daysFrom = (today: string, day: string) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
const short = (day: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const lead = (id: string, label: string) => ({ label, href: `/operations/lead/${id}` });
const journey = (id: string, label: string) => ({ label, href: `/operations/journey/${id}` });

export function deskItems(input: DeskInput): DeskItem[] {
  const out: DeskItem[] = [];
  const me = input.agentFirst;
  const push = (i: Omit<DeskItem, "snoozable"> & { snoozable?: boolean }) => out.push({ snoozable: true, ...i });

  /* A seller asking to talk about the price is asking the agent for something. */
  for (const a of (input.pricingAnswers ?? []).filter((x) => x.response === "discuss")) {
    push({ key: `sale-discuss:${a.journeyId}:${a.version}`, group: "approval", title: `${a.by} wants to talk about the price`, why: `Their answer to pricing version ${a.version}, from their page`, owner: me, about: journey(a.journeyId, `${a.person}, ${a.label}`), evidence: a.note ? `“${a.note}”` : null, due: null, next: "Talk it through; a new pricing version answers it", href: `/operations/journey/${a.journeyId}?tab=pricing`, tone: "warn", order: 6 });
  }

  /* A sale's promised reviews: due today, or a whole cycle missed. */
  for (const d of input.sales ?? []) {
    const missed = d.late >= LATE_DAYS;
    const about = journey(d.journeyId, `${d.person}, ${d.label}`);
    const evidence = d.late ? `Due ${short(d.due)}, ${d.late} day${d.late === 1 ? "" : "s"} ago` : "Due today";
    if (d.kind === "weekly-review") {
      push({ key: `sale-week:${d.journeyId}:${d.due}`, group: missed ? "attention" : "today", title: `Weekly review: ${d.label}`, why: "The listing is live, and the seller hears from you every week", owner: me, about, evidence, due: d.due, next: "Record the week's numbers, and ask whether to keep or change course", href: `/operations/journey/${d.journeyId}?tab=listing`, tone: missed ? "neg" : "warn", order: 20 - d.late });
    } else {
      push({ key: `sale-price:${d.journeyId}:${d.version ?? 0}`, group: missed ? "attention" : "today", title: `Review pricing with ${d.person}`, why: `The day pricing version ${d.version} said it would be reviewed with them`, owner: me, about, evidence, due: d.due, next: "Go through it with them, then record the next version with its own review day", href: `/operations/journey/${d.journeyId}?tab=pricing`, tone: missed ? "neg" : "warn", order: 20 - d.late });
    }
  }

  /* Contract dates: missed and unchecked need him now; checked ones are upcoming. */
  for (const d of input.dates) {
    const about = journey(d.journeyId, `${d.person}, ${d.address}`);
    const base = { key: `date:${d.deadlineId}`, owner: me, about, href: `/operations/journey/${d.journeyId}?tab=contract`, snoozable: false };
    if (d.why === "missed") {
      push({ ...base, group: "attention", title: `${d.label} passed`, why: "Contract date, not recorded as met", evidence: d.when, due: d.when, next: "Record what actually happened: met, extended or released", tone: "neg", order: 0 });
    } else if (d.why === "unchecked") {
      push({ ...base, group: "approval", title: `Check ${d.label} against the contract`, why: "Entered, not yet checked against the document, so the client does not see it", evidence: d.when, due: d.when, next: "Open the document and confirm the date", tone: "warn", order: 10 + (d.days ?? 0) });
    } else {
      const today = d.days === 0;
      push({ ...base, group: today ? "today" : "upcoming", title: d.label, why: "Checked contract date", evidence: d.when, due: d.when, next: "Make sure whoever owns it is on track", tone: today ? "warn" : "none", order: d.days ?? 99 });
    }
  }

  for (const c of input.contracts.filter((x) => !x.outcome)) {
    for (const w of c.work.filter((x) => x.state === "blocked")) {
      push({
        key: `work:${c.id}:${w.workstream}`, group: "attention", title: `${w.label} is blocked`, why: "A workstream on an open contract",
        owner: w.owner === "other" ? w.ownerName ?? "Someone else" : w.owner === "client" ? c.person : me,
        about: journey(c.journeyId, `${c.person}, ${c.address}`), evidence: w.note, due: null,
        next: "Clear the block, or tell the buyer what it means", href: `/operations/journey/${c.journeyId}?tab=contract`, tone: "neg", order: 1,
      });
    }
  }

  for (const p of input.jobProblems) {
    push({ key: `job:${p.slice(0, 40).replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}`, group: "attention", title: "A scheduled job needs you", why: "Rift runs these on its own; nothing is retried by itself", owner: me, about: null, evidence: p, due: null, next: "Check the Vercel cron log and Sentry", href: "/operations", tone: "neg", order: 2 });
  }

  for (const m of input.outbox) {
    const about = { label: m.to, href: "/operations/outbox" };
    if (m.state === "unknown") {
      push({ key: `outbox:${m.id}`, group: "attention", title: `May have sent: ${m.subject}`, why: "The provider did not confirm it", owner: me, about, evidence: null, due: null, next: "Check whether it arrived before sending again", href: "/operations/outbox", tone: "neg", order: 3 });
    } else {
      push({ key: `outbox:${m.id}`, group: "approval", title: m.subject, why: m.state === "failed" ? "Did not send; waiting for you to try again or discard" : m.state === "approved" ? "Approved, not sent yet" : "Prepared, not sent (D04)", owner: me, about, evidence: null, due: null, next: m.state === "prepared" ? "Send, edit or discard" : "Send or discard", href: "/operations/outbox", tone: m.state === "failed" ? "warn" : "none", order: 20 });
    }
  }

  for (const r of input.reviews) {
    push({ key: `review:${r.id}`, group: r.overdue ? "attention" : "approval", title: `Check a figure: ${r.what}`, why: r.overdue ? "Asked more than the promised window ago" : "Asked to check a figure", owner: me, about: lead(r.whoId, r.who), evidence: `Waiting ${r.waitingHours}h`, due: null, next: "Confirm it, or say what it should be", href: "#figures", tone: r.overdue ? "neg" : "none", order: 4 });
  }

  if (input.programFlags.length) {
    push({ key: "programs:flagged", group: "approval", title: input.programFlags.length === 1 ? "An official program page changed" : `${input.programFlags.length} official program pages changed`, why: "The weekly check flagged a change; the record is not renewed until you look", owner: me, about: { label: "Programs", href: "/operations/programs" }, evidence: input.programFlags.join(", "), due: null, next: "Say whether each record is still right", href: "/operations/programs", tone: "warn", order: 21 });
  }
  const withheld = input.programsWithheld;
  if (withheld.names.length) {
    /* The task has a name on it: an unowned cadence is not a cadence. */
    push({ key: "programs:withheld", group: "attention", title: `${withheld.names.length} program${withheld.names.length === 1 ? "" : "s"} withheld from buyers`, why: `Not re-verified within ${withheld.withinDays} days, so nobody is shown them; buyers are told some are being re-checked`, owner: withheld.owner, about: { label: "Programs", href: "/operations/programs" }, evidence: withheld.names.join(", "), due: null, next: "Re-verify on Programs, or change the owner or window in Settings", href: "/operations/programs", tone: "warn", order: 6 });
  }

  for (const c of input.choices) {
    push({ key: `choice:${c.leadId}`, group: "approval", title: `${c.name} chose ${c.from}`, why: "A seller chose an offer from their plan page; a choice is not an acceptance", owner: me, about: lead(c.leadId, c.name), evidence: c.note ? `“${c.note}”` : null, due: "Before the buyer's deadline", next: "Prepare the paperwork", href: `/operations/lead/${c.leadId}`, tone: "warn", order: 5 });
  }

  for (const l of input.lapsing) {
    push({ key: `agreement:${l.id}`, group: l.covered ? "upcoming" : "attention", title: l.covered ? `${l.name}'s agreement is running out` : `${l.name}'s agreement has expired`, why: "Representation lapses on a date, not when it is noticed", owner: me, about: lead(l.id, l.name), evidence: l.note, due: null, next: "Renew it, or record that it ended", href: `/operations/lead/${l.id}`, tone: l.covered ? "none" : "neg", order: l.covered ? 50 : 7 });
  }

  if (input.rate.stale) {
    push({ key: "rate:stale", group: "attention", title: `The rate everyone is shown is ${input.rate.pct.toFixed(2)}%`, why: "Every monthly figure depends on it", owner: me, about: null, evidence: input.rate.age, due: null, next: "Record this week's rate: npm run rift:rate -- 6.72", href: "/operations", tone: "warn", order: 8 });
  }

  for (const c of input.commitments) {
    const days = daysFrom(input.today, c.dueOn);
    const theirs = c.kind === "step" && c.owner !== "agent";
    const who = c.owner === "other" ? c.ownerName ?? "Someone else" : c.owner === "client" ? c.personName : me;
    const base = { key: `${c.kind}:${c.id.split(":").pop()}`, title: c.what, owner: who, about: lead(c.personId, c.personName), evidence: c.visibleToThem ? "On their plan, which they can see" : "Your own next action", due: days === 0 ? "Today" : short(c.dueOn), href: `/operations/lead/${c.personId}` };
    if (theirs) {
      if (days <= UPCOMING_DAYS) push({ ...base, group: "waiting", why: `${who} owes this`, next: days < 0 ? "Ask where it is" : "Nothing until it is due", tone: days < 0 ? "warn" : "none", order: days });
      continue;
    }
    if (days < 0) push({ ...base, group: "attention", why: `Owed ${-days} day${days === -1 ? "" : "s"} ago`, next: "Do it, or move it to a date you will keep", tone: "neg", order: 9 });
    else if (days === 0) push({ ...base, group: "today", why: c.visibleToThem ? "Promised to them, due today" : "Your next action, due today", next: "Do it", tone: "warn", order: 1 });
    else if (days <= UPCOMING_DAYS) push({ ...base, group: "upcoming", why: c.visibleToThem ? "Promised to them" : "Your next action", next: "Nothing until then", tone: "none", order: days });
  }

  for (const t of input.touches) {
    push({ key: `touch:${t.leadId}`, group: "today", title: `${t.channel} ${t.name}`, why: t.daysLate > 0 ? `Follow-up ${t.daysLate} day${t.daysLate === 1 ? "" : "s"} late` : "Follow-up due, and it needs you", owner: me, about: lead(t.leadId, t.name), evidence: t.says, due: "Today", next: t.channel === "Call" ? "Call them" : "Send it", href: `/operations/lead/${t.leadId}`, tone: t.daysLate > 0 ? "warn" : "none", order: 2 });
  }

  for (const d of input.dependencies ?? []) {
    push({
      key: `link:${d.id}`, group: "waiting", title: d.line, why: "A purchase that depends on a sale; neither moves the other",
      owner: d.owner, about: journey(d.purchaseJourneyId, d.purchaseLabel), evidence: d.note, due: null,
      next: "Record it met when it is, with what shows it", href: `/operations/journey/${d.purchaseJourneyId}`, tone: "none", order: 50,
    });
  }

  for (const w of input.waiting) {
    const days = daysFrom(input.today, w.checkIn);
    push({
      key: `work:${w.transactionId}:${w.workstream}`, group: "waiting", title: w.label, why: w.stale ? "No word for a week or more" : `With ${w.on}`,
      owner: w.on, about: journey(w.journeyId, `${w.person}, ${w.address}`),
      evidence: w.lastWord ? `Last word ${short(w.lastWord.on)} from ${w.lastWord.from}` : "No word yet",
      due: days <= 0 ? "Check in today" : `Check in ${short(w.checkIn)}`,
      next: days <= 0 ? `Ask ${w.on} where it stands` : "Nothing until then",
      href: `/operations/journey/${w.journeyId}?tab=contract`, tone: w.stale ? "warn" : "none", order: days,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Snooze, pin, delegate (OPS-02)
 * ------------------------------------------------------------------ */

export type MarkKind = "snooze" | "pin" | "delegate" | "accept" | "clear";

export interface Mark {
  key: string;
  kind: MarkKind;
  until: string | null;
  person: string | null;
  reason: string | null;
  by: string;
  at: string;
}

export type ItemMark =
  | { kind: "snoozed"; until: string; owner: string }
  | { kind: "pinned"; until: string; reason: string }
  | { kind: "delegated"; to: string; accepted: boolean };

/**
 * An item's current mark from its history. The latest row wins; a snooze or
 * pin whose time has passed has ended on its own; an acceptance only counts
 * against the delegation it follows.
 */
export function markOf(history: Mark[], now: Date): ItemMark | null {
  const sorted = [...history].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted.at(-1);
  if (!last || last.kind === "clear") return null;
  const t = now.toISOString();
  if (last.kind === "snooze") return last.until && last.until > t ? { kind: "snoozed", until: last.until, owner: last.person ?? "" } : null;
  if (last.kind === "pin") return last.until && last.until > t ? { kind: "pinned", until: last.until, reason: last.reason ?? "" } : null;
  const delegation = [...sorted].reverse().find((m) => m.kind === "delegate");
  if (!delegation) return null;
  return { kind: "delegated", to: delegation.person ?? "", accepted: last.kind === "accept" };
}

/** Why a mark may not be recorded, or null. */
export function markError(key: string, kind: MarkKind, input: { until?: string | null; person?: string | null; reason?: string | null }, now: Date): string | null {
  if (!/^[a-z]+:[A-Za-z0-9:_-]{1,200}$/.test(key)) return "That item cannot be marked";
  const later = (s?: string | null) => Boolean(s && !Number.isNaN(Date.parse(s)) && Date.parse(s) > now.getTime());
  if (kind === "snooze") {
    if (key.startsWith("date:")) return "A contract date is never snoozed; record what happened instead";
    if (!later(input.until)) return "Choose a time to come back to it";
    if (!input.person?.trim()) return "Say who picks it up again";
  }
  if (kind === "pin") {
    if (!later(input.until)) return "Choose when the pin ends";
    if (!input.reason?.trim()) return "Say why it is pinned";
  }
  if ((kind === "delegate" || kind === "accept") && !input.person?.trim()) return kind === "delegate" ? "Say who it goes to" : "Say who accepted it";
  for (const [v, n] of [[input.person, 120], [input.reason, 300]] as const) if (v && v.trim().length > n) return `Keep it under ${n} characters`;
  return null;
}

export type MarkedItem = DeskItem & { mark: ItemMark | null };
export interface DeskGroup { group: Group; items: MarkedItem[]; snoozed: MarkedItem[] }

/**
 * Items with their marks, grouped. Snoozed items leave their group until
 * their time (counted, never silently gone); pinned ones lead it.
 */
export function arrange(items: DeskItem[], marks: Mark[], now: Date): DeskGroup[] {
  const byKey = new Map<string, Mark[]>();
  for (const m of marks) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);
  return GROUPS.map((group) => {
    const withMarks = items.filter((i) => i.group === group).map((i) => ({ ...i, mark: markOf(byKey.get(i.key) ?? [], now) }));
    const visible = withMarks.filter((i) => i.mark?.kind !== "snoozed" || !i.snoozable);
    visible.sort((a, b) => Number(b.mark?.kind === "pinned") - Number(a.mark?.kind === "pinned") || a.order - b.order);
    return { group, items: visible, snoozed: withMarks.filter((i) => !visible.includes(i)) };
  });
}

/* ------------------------------------------------------------------ *
 * Recent activity (§8.4): meaningful changes, and what Rift did on its own
 * ------------------------------------------------------------------ */

export interface Activity { at: string; text: string; href: string; auto: boolean }

export function activity(input: {
  leads: { id: string; name: string | null; email: string | null; side: "buy" | "sell"; createdAt: string }[];
  events: { journeyId: string; journeyLabel: string; kind: "stage" | "status"; toLabel: string; by: string; at: string }[];
  jobs: { label: string; lastRun: { ok: boolean; detail: string | null; finishedAt: string | null; startedAt: string } | null }[];
  sent: { subject: string; to: string; at: string }[];
  choices: { leadId: string; name: string; from: string; at: string }[];
  answers?: PricingAnswer[];
}, now: Date, days = 3): Activity[] {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const out: Activity[] = [];
  for (const l of input.leads) {
    if (l.createdAt < since) continue;
    out.push({ at: l.createdAt, text: `New ${l.side === "buy" ? "buyer" : "seller"} lead: ${l.name ?? l.email ?? "no name given"}`, href: `/operations/lead/${l.id}`, auto: false });
  }
  for (const e of input.events) {
    if (e.at < since) continue;
    out.push({ at: e.at, text: `${e.journeyLabel}: ${e.kind === "stage" ? "moved to" : "now"} ${e.toLabel} (${e.by})`, href: `/operations/journey/${e.journeyId}`, auto: false });
  }
  for (const c of input.choices) {
    if (c.at < since) continue;
    out.push({ at: c.at, text: `${c.name} chose ${c.from}`, href: `/operations/lead/${c.leadId}`, auto: false });
  }
  for (const a of input.answers ?? []) {
    if (a.at < since || a.response !== "agree") continue;
    out.push({ at: a.at, text: `${a.by} agreed to pricing version ${a.version} for ${a.label}`, href: `/operations/journey/${a.journeyId}?tab=pricing`, auto: false });
  }
  for (const s of input.sent) {
    if (s.at < since) continue;
    out.push({ at: s.at, text: `Sent, after your approval: ${s.subject} to ${s.to}`, href: "/operations/outbox", auto: true });
  }
  for (const j of input.jobs) {
    const r = j.lastRun;
    const at = r?.finishedAt ?? r?.startedAt;
    if (!r || !at || at < since) continue;
    out.push({ at, text: `${j.label}: ${r.ok ? "ran" : "failed"}${r.detail ? `, ${r.detail}` : ""}`, href: "/operations", auto: true });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
}
