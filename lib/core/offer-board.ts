/**
 * Every live offer, on both sides, as one list (the Offers page).
 *
 * Offers lived in three places and the page called Offers showed only one of
 * them: the ones that came in through the public form. A buyer's counter
 * waiting on a household, a seller's three offers with one never shown to
 * them, a seller's choice nobody had answered, were all reachable only by
 * opening the right journey. The agent's question on this page is not "what
 * arrived" but "what is waiting, and on whom, and by when", so each source is
 * reduced to the same item: who, which home, the terms in a line, where it
 * stands, what needs answering, who has to answer, and by what day.
 *
 * Pure, like the rest of lib/core: the reads are lib/db/offer-board.ts. Every
 * figure shown is an arithmetic on recorded terms; nothing here estimates.
 */

import { money } from "./compute";
import { daysUntil, georgiaDay } from "./day";
import { BID_FINANCING_LABEL, BID_STATUS_LABEL, bidView, FINAL, type BidResponse, type BidStatus, type BidStep } from "./bid";
import { financingLabel } from "./offers";

export type Waiting = "you" | "client" | "other side" | "seller";
export type Tone = "pos" | "warn" | "neg" | "acc" | "info" | "none";
export type Side = "buying" | "selling" | "inbound";

export interface OfferItem {
  key: string;
  side: Side;
  person: string;
  personHref: string | null;
  /** Where the offer is worked: the journey tab, or this page's detail. */
  href: string;
  address: string;
  /** The terms in a line, in words. */
  terms: string;
  stands: { word: string; tone: Tone };
  /** What needs answering, as a sentence. */
  needs: string;
  waitingOn: Waiting;
  /** The day it has to be answered by, and where that date comes from. */
  by: { day: string; basis: string | null } | null;
  /** When it started or arrived, an ISO timestamp, for "3 days ago". */
  since: string | null;
  /** An inbound offer that is on one of the agent's own listings. */
  onListing: { person: string; href: string } | null;
}

export const WAITING_LABEL: Record<Waiting, string> = {
  you: "You",
  client: "Your client",
  "other side": "The other side",
  seller: "The seller",
};

/** The day an offer's deadline falls on, in Georgia. A timestamp is that day there, not in London. */
const dayOf = (v: string) => (v.length > 10 ? georgiaDay(new Date(v)) : v);

/* ------------------------------------------------------------------ *
 * A buyer's offer
 * ------------------------------------------------------------------ */

const BID_TONE: Record<BidStatus, Tone> = {
  drafting: "none", countered: "acc", awaiting: "warn", instructed: "acc", disagreement: "neg", changes: "warn",
  stopped: "neg", prepared: "info", signed: "info", submitted: "info", accepted: "pos", rejected: "none", expired: "none", withdrawn: "none",
};

/** Who has to move next on a buyer's offer. */
const BID_WAITING: Record<BidStatus, Waiting> = {
  drafting: "you", countered: "you", awaiting: "client", instructed: "you", disagreement: "client", changes: "you",
  stopped: "you", prepared: "you", signed: "you", submitted: "other side", accepted: "you",
  rejected: "you", expired: "you", withdrawn: "you",
};

export interface BidInput {
  journeyId: string;
  leadId: string;
  person: string;
  address: string;
  steps: BidStep[];
  responses: BidResponse[];
  agentFirst: string;
  /** A contract is already recorded on this home, so an accepted offer has nothing left to do. */
  hasContract: boolean;
  createdAt: string;
}

/**
 * A buyer's offer as a board item, or null once it has nothing left for
 * anybody to do (rejected, expired, withdrawn, or accepted with its contract
 * recorded). "Accepted" without a contract is still live: it is the agent's
 * to record, and an acceptance nobody wrote down is how a deal goes missing.
 */
export function bidItem(b: BidInput): OfferItem | null {
  const v = bidView(b.steps, b.responses, b.agentFirst);
  if (FINAL.includes(v.status) && !(v.status === "accepted" && !b.hasContract)) return null;
  if (!v.terms) return null;

  const t = v.terms;
  const respondBy = t.respondBy ? dayOf(t.respondBy) : null;
  return {
    key: `bid:${b.journeyId}:${b.address}`,
    side: "buying",
    person: b.person,
    personHref: `/operations/lead/${b.leadId}`,
    href: `/operations/journey/${b.journeyId}?tab=offers`,
    address: b.address,
    terms: [
      money(t.price),
      BID_FINANCING_LABEL[t.financing],
      v.version > 1 ? `version ${v.version}${v.origin === "theirs" ? ", their counter" : ""}` : null,
    ].filter(Boolean).join(" · "),
    stands: { word: BID_STATUS_LABEL[v.status], tone: BID_TONE[v.status] },
    needs: v.nextStep,
    waitingOn: BID_WAITING[v.status],
    by: respondBy ? { day: respondBy, basis: t.respondBySource ?? null } : null,
    since: b.steps[0]?.at ?? b.createdAt,
    onListing: null,
  };
}

/* ------------------------------------------------------------------ *
 * A seller's offers
 * ------------------------------------------------------------------ */

export interface SellerInput {
  leadId: string;
  journeyId: string | null;
  person: string;
  address: string;
  offers: { id: string; from: string; price: number; releasedAt: string | null; createdAt: string }[];
  room: { approvedAt: string | null; approvedFor: string[]; chosenOfferId: string | null; chosenAt: string | null } | null;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * One seller's offers, as one item: how many, and the one thing that is next.
 *
 * Offers are per seller, not per offer, because what needs answering is a
 * step in a process (release them, write a take, wait for the choice, answer
 * the choice) and listing three offers as three rows would repeat that step
 * three times.
 */
export function sellerItem(s: SellerInput): OfferItem | null {
  if (!s.offers.length) return null;
  const released = s.offers.filter((o) => o.releasedAt);
  const unreleased = s.offers.length - released.length;
  const top = s.offers.reduce((best, o) => (o.price > best.price ? o : best));
  const room = s.room;
  const chosen = room?.chosenOfferId ? s.offers.find((o) => o.id === room.chosenOfferId) ?? null : null;
  const takeCurrent = Boolean(room?.approvedAt) && sameSet(room!.approvedFor, released.map((o) => o.id));

  let stands: OfferItem["stands"];
  let needs: string;
  let waitingOn: Waiting;
  let since = s.offers.map((o) => o.createdAt).sort().at(-1) ?? null;

  if (chosen) {
    stands = { word: `They chose ${chosen.from}`, tone: "acc" };
    /* The page the seller used says it too: choosing is not accepting. */
    needs = `${s.person} chose the ${money(chosen.price)} offer. A choice is not an acceptance: answer that offer, then record the contract.`;
    waitingOn = "you";
    since = room?.chosenAt ?? since;
  } else if (unreleased > 0) {
    stands = { word: unreleased === s.offers.length ? "Not shown to them yet" : "Some not shown yet", tone: "warn" };
    needs = `${unreleased} of ${s.offers.length} ${s.offers.length === 1 ? "offer" : "offers"} not released to ${s.person}. Check the terms, then release.`;
    waitingOn = "you";
  } else if (!takeCurrent) {
    stands = { word: "Needs your take", tone: "warn" };
    needs = room?.approvedAt
      ? `The offers they can see changed since you wrote your take. Write it again.`
      : `${s.person} can see ${released.length === 1 ? "the offer" : `all ${released.length} offers`}. Write your recommendation in your own words.`;
    waitingOn = "you";
  } else {
    stands = { word: "With the seller", tone: "info" };
    needs = `Waiting for ${s.person} to choose.`;
    waitingOn = "seller";
    since = room?.approvedAt ?? since;
  }

  return {
    key: `sell:${s.leadId}`,
    side: "selling",
    person: s.person,
    personHref: `/operations/lead/${s.leadId}`,
    href: s.journeyId ? `/operations/journey/${s.journeyId}?tab=seller-offers` : `/operations/lead/${s.leadId}`,
    address: s.address,
    terms: `${s.offers.length} ${s.offers.length === 1 ? "offer" : "offers"} · highest ${money(top.price)}`,
    stands,
    needs,
    waitingOn,
    by: null,
    since,
    onListing: null,
  };
}

/* ------------------------------------------------------------------ *
 * An offer that came in through the public form
 * ------------------------------------------------------------------ */

export interface InboundInput {
  id: string;
  address: string | null;
  from: string;
  firm: string | null;
  price: number;
  financing: string;
  financingOther: string | null;
  at: string;
  submitterLeadId: string | null;
  /** When the agent last answered the person who sent it, if anybody has. */
  repliedAt: string | null;
  /** What the agent recorded on the offer itself, which wins over `repliedAt`. */
  answer?: { answered: boolean; respondBy: string | null } | null;
  listing: { person: string; href: string } | null;
}

/**
 * Whether the sender has had an answer: the lead behind the offer has a human
 * reply recorded since the offer arrived. The offer carries no reply of its
 * own, so the lead's is the only true signal there is, and without one an
 * offer stays "needs a reply" however long ago it was answered by phone.
 */
export const answered = (at: string, repliedAt: string | null) => repliedAt !== null && repliedAt >= at;

export function inboundItem(o: InboundInput): OfferItem {
  const done = o.answer ? o.answer.answered : answered(o.at, o.repliedAt);
  return {
    key: `in:${o.id}`,
    side: "inbound",
    person: o.from + (o.firm ? `, ${o.firm}` : ""),
    personHref: o.submitterLeadId ? `/operations/lead/${o.submitterLeadId}` : null,
    href: `/operations/offers?show=inbound#offer-${o.id}`,
    address: o.address ?? "No address given",
    terms: `${money(o.price)} · ${financingLabel(o.financing, o.financingOther)}`,
    stands: done ? { word: "Replied", tone: "pos" } : { word: "Needs a reply", tone: "warn" },
    needs: done
      ? "You have answered them. Nothing is waiting on you."
      : `Reply to ${o.from.split(",")[0]}: they were told their offer was delivered.`,
    waitingOn: done ? "other side" : "you",
    by: !done && o.answer?.respondBy ? { day: o.answer.respondBy, basis: "the sender's deadline, as you recorded it" } : null,
    since: o.at,
    onListing: o.listing,
  };
}

/* ------------------------------------------------------------------ *
 * Ordering and counting
 * ------------------------------------------------------------------ */

/**
 * What is waiting on the agent first, then by the date it is due: an offer
 * that expires tomorrow outranks one with no date. The rest follow, soonest
 * deadline first, so a counter the household owes an answer on is next in line.
 */
export function orderItems(items: OfferItem[]): OfferItem[] {
  const mine = (i: OfferItem) => (i.waitingOn === "you" ? 0 : 1);
  return [...items].sort((a, b) =>
    mine(a) - mine(b)
    || (a.by?.day ?? "9999-12-31").localeCompare(b.by?.day ?? "9999-12-31")
    || (b.since ?? "").localeCompare(a.since ?? ""));
}

export interface BoardCounts {
  all: number;
  waitingOnYou: number;
  waitingOnOthers: number;
  /** Due within three days, or already past. */
  dueSoon: number;
  buying: number;
  selling: number;
  inbound: number;
}

export function countItems(items: OfferItem[], now: Date = new Date()): BoardCounts {
  return {
    all: items.length,
    waitingOnYou: items.filter((i) => i.waitingOn === "you").length,
    waitingOnOthers: items.filter((i) => i.waitingOn !== "you").length,
    dueSoon: items.filter((i) => i.by && daysUntil(i.by.day, now) <= 3).length,
    buying: items.filter((i) => i.side === "buying").length,
    selling: items.filter((i) => i.side === "selling").length,
    inbound: items.filter((i) => i.side === "inbound").length,
  };
}

/** "Offers on 1402 Briarcliff Rd NE" and "1402 Briarcliff Rd NE, Atlanta, GA" are one home. */
export const streetOf = (address: string) => address.split(",")[0]!.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * The labels a person reads where the page used to print the stored code: a
 * financing of "fha", a closing date of "2026-11-13", a contingency the
 * sender already gave as a number of days. `dueDiligenceDays` is its own
 * field and the same fact also arrives as a contingency string, so the chip
 * is dropped rather than said twice.
 */
export function termChips(o: {
  financing: string; financingOther: string | null; closeOn: string | null; dueDiligenceDays: number | null;
  earnest: number; contingencies: string[];
}, now: Date = new Date()): string[] {
  const chips = [financingLabel(o.financing, o.financingOther)];
  if (o.closeOn) {
    const d = daysUntil(o.closeOn, now);
    chips.push(`Closes ${new Date(`${o.closeOn}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}${d >= 0 && d <= 60 ? ` (in ${d} days)` : ""}`);
  }
  if (o.dueDiligenceDays !== null) chips.push(`${o.dueDiligenceDays} days due diligence`);
  if (o.earnest > 0) chips.push(`${money(o.earnest)} earnest`);
  for (const c of o.contingencies) {
    if (o.dueDiligenceDays !== null && /^due diligence/i.test(c.trim())) continue;
    chips.push(c);
  }
  return chips;
}

