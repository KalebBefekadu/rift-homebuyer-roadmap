import type { Scope, Side } from "./journey";
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

export type NoticeKind = "home" | "offer" | "priorities" | "pricing" | "proceeds";

interface Rule {
  /** Only members who can see the thing are told about it. */
  scope: Scope;
  side: Side;
  tab: PortalTab;
  /** "Kaleb added ...", finished in the email. */
  what: string;
  /** Whether it asks them for an answer, which the subject says. */
  asks: boolean;
}

export const NOTICE: Record<NoticeKind, Rule> = {
  home: { scope: "homes", side: "buy", tab: "homes", what: "added a home to your list", asks: false },
  offer: { scope: "money", side: "buy", tab: "offers", what: "has an offer for you to look at and answer", asks: true },
  priorities: { scope: "search", side: "buy", tab: "homes", what: "wrote down your search priorities for you to check", asks: true },
  pricing: { scope: "money", side: "sell", tab: "money", what: "shared a pricing opinion on your home for you to answer", asks: true },
  proceeds: { scope: "money", side: "sell", tab: "money", what: "updated what you would keep from the sale", asks: false },
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
export function shouldTell(kind: NoticeKind, m: { side: Side; scopes: Scope[]; joined: boolean; revoked: boolean }): boolean {
  const r = NOTICE[kind];
  return m.joined && !m.revoked && m.side === r.side && m.scopes.includes(r.scope);
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
