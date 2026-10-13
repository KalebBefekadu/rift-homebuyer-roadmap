import { canRespond, type Role, type Scope, type Side } from "./journey";
import type { PortalTab } from "./portal-tabs";

/**
 * Telling a client something new is waiting in their portal (manual review
 * WS11.5). Before this, a home, an offer to answer, a change to their
 * priorities or a pricing opinion appeared in the portal and nobody was told,
 * so clients had to remember to look.
 *
 * Pure: who is told about what, what the email says, and how often. The
 * sending is lib/db/notices.ts.
 *
 * The email names the kind of thing and links to the tab it is on. It never
 * carries an address, a price or a document: an inbox is read on shared
 * screens and forwarded, and the portal is where those are shown to a person
 * who has signed in.
 */

export type NoticeKind = "home" | "offer" | "priorities" | "pricing" | "proceeds" | "yours" | "date";

interface Rule {
  /** Only members who can see the thing are told about it; null when no scope gates it. */
  scope: Scope | null;
  /** null: either side. */
  side: Side | null;
  /** Only buyers and co-buyers (sellers on a sale) see the contract and the plan's steps. */
  respondOnly?: boolean;
  tab: PortalTab;
  /** "Kaleb added ...", finished in the email. */
  what: string;
  /** Whether it asks them for an answer, which the subject says. */
  asks: boolean;
  /** A subject of its own, after the agent's first name, when neither of the two fits. */
  subject?: string;
}

export const NOTICE: Record<NoticeKind, Rule> = {
  home: { scope: "homes", side: "buy", tab: "homes", what: "added a home to your list", asks: false },
  offer: { scope: "money", side: "buy", tab: "offers", what: "has an offer for you to look at and answer", asks: true },
  priorities: { scope: "search", side: "buy", tab: "homes", what: "wrote down your search priorities for you to check", asks: true },
  pricing: { scope: "money", side: "sell", tab: "money", what: "shared a pricing opinion on your home for you to answer", asks: true },
  proceeds: { scope: "money", side: "sell", tab: "money", what: "updated what you would keep from the sale", asks: false },
  /* The contract phase had no notice at all (audit portals-2026-10, item 3):
     insurance becoming theirs, a step put on them with a date, all appeared
     on Today and nobody was told, in the stretch with the most deadlines. A
     workstream or a plan step the agent puts on the client. */
  yours: { scope: null, side: null, respondOnly: true, tab: "today", what: "put something on your list to do", asks: false, subject: "put something on your list in Rift" },
  /* A checked contract date of theirs, two days out or less (decision 4),
     only while the business rule clientDateReminders is on. The email names
     no date and no deadline: the portal does, behind their sign-in. */
  date: { scope: null, side: null, respondOnly: true, tab: "today", what: "has a contract date of yours coming up in the next two days", asks: false, subject: "has a contract date of yours coming up" },
};

/**
 * One email per person per kind in this window. Six homes added in a row is
 * one email; a home today and another tomorrow is two. Long enough to absorb
 * a working session, short enough that a new thing the next day is said.
 */
export const NOTICE_WINDOW_HOURS = 6;

export function noticeDue(lastAt: string | null, now: Date = new Date()): boolean {
  if (!lastAt) return true;
  const t = Date.parse(lastAt);
  return !Number.isFinite(t) || now.getTime() - t >= NOTICE_WINDOW_HOURS * 3_600_000;
}

/** Who is told: joined, not removed, on this side, and able to see the thing. */
export function shouldTell(kind: NoticeKind, m: { side: Side; scopes: Scope[]; joined: boolean; revoked: boolean; role?: Role }): boolean {
  const r = NOTICE[kind];
  if (!m.joined || m.revoked) return false;
  if (r.side && m.side !== r.side) return false;
  if (r.scope && !m.scopes.includes(r.scope)) return false;
  /* A viewer sees neither the contract's work nor the plan's steps (clientProgress). */
  if (r.respondOnly && !(m.role && canRespond(m.role))) return false;
  return true;
}

/**
 * Whether a workstream update puts something on the client to do: theirs,
 * and still open. Recording "confirmed" on their insurance is news, not a
 * task, and is not emailed as one.
 */
export function workIsTheirs(input: { owner: string; state: string }): boolean {
  return input.owner === "client" && !["confirmed", "not-applicable", "reported"].includes(input.state);
}

export interface NoticeEmail {
  to: string;
  name: string | null;
  agentName: string;
  journeyLabel: string;
  kind: NoticeKind;
  /** The journey page on this site, without the tab. */
  journeyUrl: string;
}

/** How far ahead, in days, a contract date of theirs is reminded. */
export const REMIND_DAYS = 2;

/**
 * Which checked contract dates to remind the household about: on an open
 * contract, still active, not passed, due within REMIND_DAYS, and for work
 * the client owns. A date nobody has checked against the document is never
 * said (REQ-DATE-02), and one that belongs to the lender is the lender's.
 */
export function datesToRemind(contracts: {
  journeyId: string; outcome: unknown | null;
  work: { workstream: string; owner: string }[];
  dates: { id: string; kind: string; workstream: string | null; view: { verified: boolean; missed: boolean; state: string; days: number | null } }[];
}[]): { journeyId: string; deadlineId: string }[] {
  const out: { journeyId: string; deadlineId: string }[] = [];
  for (const c of contracts) {
    if (c.outcome) continue;
    for (const d of c.dates) {
      const v = d.view;
      if (d.kind !== "contractual" || !v.verified || v.missed || v.state !== "active" || v.days === null) continue;
      if (v.days < 0 || v.days > REMIND_DAYS) continue;
      if (!d.workstream || c.work.find((w) => w.workstream === d.workstream)?.owner !== "client") continue;
      out.push({ journeyId: c.journeyId, deadlineId: d.id });
    }
  }
  return out;
}

