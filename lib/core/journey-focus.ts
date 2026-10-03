/**
 * What a journey needs from the agent right now, and where it stands.
 *
 * The workspace used to know only about the household, contract dates,
 * workstreams and the lead's free-text next action, so a journey whose
 * search was approved but never set up in Matrix, or whose counter was
 * waiting for an answer, said "Nothing is waiting on you here". Every part
 * of the journey that can need the agent now reports in one list, in one
 * order: what has gone wrong first, then what is his to do, then what he is
 * only waiting on. Each item names the tab where it is dealt with, so the
 * header and the overview can link straight there and the tabs can say how
 * many things wait inside them.
 *
 * Like every rule in lib/core this is pure: the page reads, this decides.
 * Nothing here is a number a customer sees, so no figure is produced.
 */

import type { BidStatus } from "./bid";
import type { JourneyStatus, Side, Stage } from "./progress";
import type { SearchStatus } from "./search";
import type { TourStatus } from "./tour";

export type Severity = "neg" | "warn" | "info";

export interface Attention {
  key: string;
  severity: Severity;
  /** One short word for the chip, so the state is never colour alone (rule 10). */
  word: string;
  text: string;
  detail?: string;
  /** The tab where it is dealt with, or null for something with no tab (the lead's own next action). */
  tab: string | null;
}

export interface FocusInput {
  side: Side;
  stage: Stage;
  status: JourneyStatus;
  /** Why it was paused, from the status change that paused it. */
  statusReason: string | null;
  nobodyInvited: boolean;
  missedDates: { id: string; label: string; when: string }[];
  uncheckedDates: { id: string; label: string }[];
  blocked: { label: string; note: string | null }[];
  /** The page's suggestion that the stage is behind the offers. Never moves anything. */
  stageNudge: string | null;
  /** A buyer's Matrix search status, or null when it was not read. */
  search: SearchStatus | null;
  tours: { id: string; address: string; status: TourStatus; blocked: string | null; overdue: boolean }[];
  bids: { id: string; address: string; status: BidStatus; nextStep: string; final: boolean }[];
  /** A sale's listing: where it stands and what is left on the launch list. */
  listing: { status: "preparing" | "live" | "withdrawn"; checklistLeft: number; showingsToUpdate: number } | null;
  sellerOffers: { unreleased: number; chosen: boolean } | null;
  prep: { id: string; title: string; dueOn: string | null }[] | null;
  leadNext: { text: string; due: string | null } | null;
  /** Today in Georgia, as a day. */
  today: string;
}

const RANK: Record<Severity, number> = { neg: 0, warn: 1, info: 2 };
const MS_DAY = 86_400_000;
const daysFrom = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / MS_DAY);

/** "due today", "3 days overdue", "due in 4 days": days only, never an invented hour. */
export function dueWords(day: string, today: string): { text: string; days: number } {
  const days = daysFrom(today, day);
  const text = days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue`
    : days === 0 ? "due today"
      : days === 1 ? "due tomorrow"
        : `due in ${days} days`;
  return { text, days };
}

/**
 * How long ago something was recorded, in days: "today", "yesterday",
 * "3 days ago". Past a month it stops being a useful way to read, so the
 * caller gets null and shows the date. Both sides are read in Georgia's day,
 * so a record made at 11 pm is "today" at 11 pm and "yesterday" at 1 am.
 */
export function agoWords(day: string, today: string): string | null {
  const days = daysFrom(day, today);
  if (days < 0) return days === -1 ? "tomorrow" : days >= -30 ? `in ${-days} days` : null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return days <= 30 ? `${days} days ago` : null;
}

const MAX_ITEMS = 12;

export function journeyAttention(i: FocusInput): Attention[] {
  /* A finished journey has nothing owed. The page says how it ended instead. */
  if (i.status === "completed" || i.status === "cancelled") return [];
  if (i.status === "paused") {
    return [{
      key: "paused", severity: "info", word: "Paused", tab: "contract",
      text: i.statusReason ? `Paused: ${i.statusReason}` : "Paused, with no reason recorded",
      detail: "Nothing is chased while it is paused. Resume it on the Contract tab when they are ready.",
    }];
  }

  const out: Attention[] = [];
  const add = (a: Attention) => { out.push(a); };

  if (i.nobodyInvited) {
    add({ key: "invite", severity: "warn", word: "Household", tab: "household",
      text: `Invite the ${i.side === "buy" ? "buyer" : "seller"}: nobody can sign in yet`,
      detail: "Make an invitation link and send it yourself." });
  }
  for (const d of i.missedDates) add({ key: `missed:${d.id}`, severity: "neg", word: "Passed", tab: "contract", text: `${d.label}: the date has passed, record what happened`, detail: d.when });
  for (const w of i.blocked) add({ key: `blocked:${w.label}`, severity: "neg", word: "Blocked", tab: "contract", text: `${w.label} is blocked`, detail: w.note ?? undefined });
  for (const d of i.uncheckedDates) {
    add({ key: `check:${d.id}`, severity: "warn", word: "Check", tab: "contract", text: `Check ${d.label} against the contract`,
      detail: `Not checked against the document, so the ${i.side === "buy" ? "buyer" : "seller"} does not see it.` });
  }
  if (i.stageNudge) add({ key: "nudge", severity: "warn", word: "Stage", tab: "contract", text: i.stageNudge });

  /* A buyer's search matters until there is a contract; after that it is history. */
  const searching: Stage[] = ["prepare", "search", "tour", "offer"];
  if (i.side === "buy" && i.search && searching.includes(i.stage)) {
    switch (i.search) {
      case "manual-action-needed": add({ key: "search", severity: "warn", word: "Matrix", tab: "search", text: "Set up the approved search in Matrix, then record it" }); break;
      case "update-pending": add({ key: "search", severity: "warn", word: "Matrix", tab: "search", text: "The brief changed since Matrix was set up: review it and update Matrix" }); break;
      case "awaiting-approval": add({ key: "search", severity: "warn", word: "Brief", tab: "search", text: "Review the brief and approve it as a search" }); break;
      case "unknown": add({ key: "search", severity: "warn", word: "Unknown", tab: "search", text: "The Matrix search status could not be read: open it to check" }); break;
      case "draft": if (i.stage === "prepare" || i.stage === "search") add({ key: "search", severity: "warn", word: "Brief", tab: "search", text: "Write the brief: there is no search without it" }); break;
      default: break;
    }
  }

  for (const t of i.tours) {
    const where = t.address;
    if (t.blocked) add({ key: `tour:${t.id}`, severity: "neg", word: "Showing", tab: "homes", text: `${where}: this showing cannot go ahead`, detail: t.blocked });
    else if (t.overdue) add({ key: `tour:${t.id}`, severity: "warn", word: "Showing", tab: "homes", text: `${where}: the time has passed, record what happened` });
    else if (t.status === "changed") add({ key: `tour:${t.id}`, severity: "warn", word: "Showing", tab: "homes", text: `${where}: the time changed, confirm the new one with the buyer` });
    else if (t.status === "requested") add({ key: `tour:${t.id}`, severity: "warn", word: "Showing", tab: "homes", text: `${where}: request it in ShowingTime, then record that you did` });
    else if (t.status === "awaiting-confirmation") add({ key: `tour:${t.id}`, severity: "info", word: "Waiting", tab: "homes", text: `${where}: waiting for ShowingTime to confirm a time` });
  }

  const waitingOn: BidStatus[] = ["awaiting", "submitted"];
  for (const b of i.bids) {
    if (b.final) continue;
    add({ key: `bid:${b.id}`, severity: waitingOn.includes(b.status) ? "info" : "warn", word: waitingOn.includes(b.status) ? "Waiting" : "Offer", tab: "offers", text: `${b.address}: ${b.nextStep}` });
  }

  if (i.side === "sell") {
    if (i.listing?.status === "preparing" && i.listing.checklistLeft > 0 && (i.stage === "price-launch" || i.stage === "market")) {
      add({ key: "launch", severity: "warn", word: "Launch", tab: "listing", text: `${i.listing.checklistLeft} launch step${i.listing.checklistLeft === 1 ? "" : "s"} left before it can go live` });
    }
    if (i.listing && i.listing.showingsToUpdate > 0) {
      add({ key: "showings", severity: "info", word: "Showings", tab: "listing", text: `${i.listing.showingsToUpdate} showing${i.listing.showingsToUpdate === 1 ? "" : "s"} to confirm or record feedback on` });
    }
    if (i.sellerOffers?.unreleased) {
      const n = i.sellerOffers.unreleased;
      add({ key: "release", severity: "warn", word: "Offers", tab: "seller-offers", text: `${n} offer${n === 1 ? "" : "s"} not yet shown to the seller`, detail: "An offer the seller has not seen cannot be chosen." });
    }
    if (i.sellerOffers?.chosen && i.stage === "offers") {
      add({ key: "chosen", severity: "warn", word: "Offers", tab: "seller-offers", text: "They chose an offer: the paperwork is next, and the contract is recorded once it is executed" });
    }
    for (const p of i.prep ?? []) {
      if (!p.dueOn) continue;
      const d = dueWords(p.dueOn, i.today);
      if (d.days <= 3) add({ key: `prep:${p.id}`, severity: d.days < 0 ? "neg" : "warn", word: d.days < 0 ? "Overdue" : "Preparation", tab: "prep", text: `${p.title}: ${d.text}` });
    }
  }

  if (i.leadNext) {
    const d = i.leadNext.due ? dueWords(i.leadNext.due, i.today) : null;
    add({
      key: "lead", tab: null, word: d && d.days < 0 ? "Overdue" : d && d.days === 0 ? "Today" : "Yours",
      severity: d && d.days < 0 ? "neg" : d && d.days === 0 ? "warn" : "info",
      text: i.leadNext.text, detail: d ? `Your next action, ${d.text}` : "Your next action",
    });
  }

  return out
    .map((a, n) => ({ a, n }))
    .sort((x, y) => RANK[x.a.severity] - RANK[y.a.severity] || x.n - y.n)
    .map((x) => x.a)
    .slice(0, MAX_ITEMS);
}

/** How many things inside each tab need the agent: only what is wrong or his to do, never what he is waiting on. */
export function tabCounts(items: Attention[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of items) if (a.tab && a.severity !== "info") out[a.tab] = (out[a.tab] ?? 0) + 1;
  return out;
}

/** What the stage is for, when nothing is wrong: the job at this point, and where it is done. */
const FOCUS: Record<Side, Partial<Record<Stage, { text: string; tab: string }>>> = {
  buy: {
    prepare: { text: "Get the buyer agreement signed, then move them to Search.", tab: "contract" },
    search: { text: "Keep the brief and the Matrix search current, and add homes that fit.", tab: "homes" },
    tour: { text: "Arrange showings and record what the buyer thought of each.", tab: "homes" },
    offer: { text: "Work the offer with the household, version by version.", tab: "offers" },
    "under-contract": { text: "Run the contract's workstreams and dates to closing.", tab: "contract" },
    close: { text: "Walkthrough, closing and keys.", tab: "contract" },
    own: { text: "Closed. Nothing is open on this journey.", tab: "history" },
  },
  sell: {
    prepare: { text: "Finish the preparation plan and record the property, then price it.", tab: "prep" },
    "price-launch": { text: "Agree the price with the seller and finish the launch checklist.", tab: "listing" },
    market: { text: "Show the home, record feedback, and write the weekly review.", tab: "listing" },
    offers: { text: "Record every offer and release them to the seller to choose.", tab: "seller-offers" },
    "under-contract": { text: "Run the contract's workstreams and dates to closing.", tab: "contract" },
    close: { text: "Closing, possession and keys.", tab: "contract" },
    continue: { text: "Sold. Nothing is open on this journey.", tab: "history" },
  },
};

export function stageFocus(side: Side, stage: Stage): { text: string; tab: string } | null {
  return FOCUS[side][stage] ?? null;
}
