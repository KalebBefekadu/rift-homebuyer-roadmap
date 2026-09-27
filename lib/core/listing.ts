/**
 * Listing and launch, showings and weekly reviews for a sale (S06 to S09).
 *
 * The launch checklist is what has been done, each by name: photos,
 * measurements, the copy reviewed, disclosures, access arranged. "Live" is a
 * fact with the MLS link, recorded by the agent; syndication to other sites
 * is a separate fact, and its absence is a delay, never a failed listing.
 * How to get into the home is never recorded here: only that access is
 * arranged.
 *
 * Showings are counted as they happened. Feedback is counted over the
 * showings that are done, with the denominator said ("2 of 5 gave
 * feedback"); a showing with no feedback is no feedback, never a good sign.
 * A weekly review is the agent's reading of licensed figures and the
 * feedback, and the seller's decision to keep or change the strategy.
 * Nothing here says a price is why there are no offers.
 *
 * Pure: no I/O.
 */

import { money } from "./compute";

export type ListingKind =
  | "photos" | "measurements" | "copy" | "disclosures" | "access"
  | "mls-live" | "syndicated" | "price-change" | "withdrawn" | "relisted";

export const LISTING_LABEL: Record<ListingKind, string> = {
  photos: "Photos",
  measurements: "Measurements",
  copy: "Listing copy reviewed",
  disclosures: "Disclosures",
  access: "Access arranged",
  "mls-live": "Live on the MLS",
  syndicated: "Showing on other sites",
  "price-change": "Price changed",
  withdrawn: "Withdrawn",
  relisted: "Relisted",
};

/** Done before launch: the checklist S06 asks for. */
export const LAUNCH_CHECKLIST: ListingKind[] = ["photos", "measurements", "copy", "disclosures", "access"];

export interface ListingEvent { kind: ListingKind; detail: string; url: string | null; price: number | null; by: string; at: string }

export type ShowingState = "requested" | "confirmed" | "done" | "cancelled";
export const SHOWING_LABEL: Record<ShowingState, string> = { requested: "Requested", confirmed: "Confirmed", done: "Done", cancelled: "Cancelled" };
export type Interest = "none" | "some" | "strong" | "offer-likely";
export const INTEREST_LABEL: Record<Interest, string> = { none: "No interest", some: "Some interest", strong: "Strong interest", "offer-likely": "Offer likely" };

export interface ShowingRow { key: string; startsAt: string; state: ShowingState; showingAgent: string | null; feedback: string | null; interest: Interest | null; by: string; at: string }
export interface Showing extends ShowingRow { history: ShowingRow[] }

export interface Review { weekOf: string; metrics: string | null; summary: string; decision: "keep" | "change" | "undecided"; decisionNote: string | null; by: string; at: string }

/** The launch checklist: each item done (with its latest record) or not. */
export function checklist(events: ListingEvent[]): { kind: ListingKind; label: string; done: ListingEvent | null }[] {
  return LAUNCH_CHECKLIST.map((k) => ({ kind: k, label: LISTING_LABEL[k], done: [...events].reverse().find((e) => e.kind === k) ?? null }));
}

export type ListingStatus = "preparing" | "live" | "withdrawn";

/** Where the listing stands, from its history. */
export function listingStatus(events: ListingEvent[]): { status: ListingStatus; live: ListingEvent | null; price: number | null; syndicated: boolean } {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let status: ListingStatus = "preparing";
  let live: ListingEvent | null = null;
  let price: number | null = null;
  let syndicated = false;
  for (const e of sorted) {
    if (e.kind === "mls-live" || e.kind === "relisted") { status = "live"; live = e; }
    if (e.kind === "withdrawn") { status = "withdrawn"; syndicated = false; }
    if (e.kind === "syndicated" && status === "live") syndicated = true;
    if (e.kind === "price-change") price = e.price;
  }
  return { status, live, price, syndicated };
}

/** Why a listing event may not be recorded, or null. */
export function listingError(e: { kind: string; detail: string; url: string | null; price: number | null }, events: ListingEvent[]): string | null {
  if (!(e.kind in LISTING_LABEL)) return "Choose what happened";
  if (e.detail.trim().length < 3) return "Say what was done, and by whom";
  if (e.detail.trim().length > 300) return "Keep it under 300 characters";
  if (e.kind === "access" && /\b(code|lockbox|combo|password|pin)\b.*\d/i.test(e.detail)) return "Record that access is arranged, never the code itself";
  if (e.kind === "mls-live" && !e.url?.startsWith("https://")) return "Give the MLS link that shows it is live";
  if (e.url && (!e.url.startsWith("https://") || e.url.length > 500)) return "Give a full https link";
  if (e.kind === "price-change" && (e.price === null || !Number.isFinite(e.price) || e.price < 10_000)) return "Give the new list price";
  if (e.kind !== "price-change" && e.price !== null) return "Only a price change carries a price";
  const status = listingStatus(events).status;
  if (e.kind === "syndicated" && status !== "live") return "It has to be live on the MLS first";
  if (e.kind === "withdrawn" && status !== "live") return "Only a live listing can be withdrawn";
  if (e.kind === "relisted" && status !== "withdrawn") return "Relist follows a withdrawal";
  if (e.kind === "mls-live" && status === "live") return "It is already live";
  return null;
}

/** Showings from their rows, each at its latest state. */
export function showingsFrom(rows: ShowingRow[]): Showing[] {
  const by = new Map<string, ShowingRow[]>();
  for (const r of [...rows].sort((a, b) => a.at.localeCompare(b.at))) by.set(r.key, [...(by.get(r.key) ?? []), r]);
  return [...by.values()].map((h) => ({ ...h.at(-1)!, history: h })).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** Why a showing update may not be recorded, or null. */
export function showingError(s: { state: string; startsAt: string; feedback: string | null; interest: string | null }, previous: Showing | null, now: Date): string | null {
  if (!(s.state in SHOWING_LABEL)) return "Choose where the showing stands";
  if (Number.isNaN(Date.parse(s.startsAt))) return "Give when it is";
  if (s.state === "done" && Date.parse(s.startsAt) > now.getTime()) return "A showing is done only after it happened";
  if (s.feedback !== null && s.state !== "done") return "Feedback comes after the showing";
  if (s.interest !== null && !s.feedback) return "Record the feedback the interest came from";
  if (s.interest !== null && !(s.interest in INTEREST_LABEL)) return "Choose the interest they gave";
  if (previous && (previous.state === "cancelled") && s.state !== "cancelled") return "A cancelled showing is a new showing if it is rebooked";
  return null;
}

export interface ShowingCounts { total: number; done: number; upcoming: number; cancelled: number; withFeedback: number; line: string }

/** Counts with their denominators, over a window when given. Never a sentiment score. */
export function showingCounts(list: Showing[], since?: string): ShowingCounts {
  const inWindow = since ? list.filter((s) => s.startsAt >= since) : list;
  const done = inWindow.filter((s) => s.state === "done");
  const withFeedback = done.filter((s) => s.feedback).length;
  const upcoming = inWindow.filter((s) => s.state === "requested" || s.state === "confirmed").length;
  const cancelled = inWindow.filter((s) => s.state === "cancelled").length;
  const line = !inWindow.length ? "No showings yet."
    : `${done.length} showing${done.length === 1 ? "" : "s"} done${upcoming ? `, ${upcoming} booked` : ""}${cancelled ? `, ${cancelled} cancelled` : ""}. ${done.length ? `${withFeedback} of ${done.length} gave feedback; no feedback is not a sign either way.` : ""}`.trim();
  return { total: inWindow.length, done: done.length, upcoming, cancelled, withFeedback, line };
}

/** Why a weekly review may not be recorded, or null. */
export function reviewError(r: { weekOf: string; metrics: string | null; summary: string; decision: string; decisionNote: string | null }, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.weekOf) || r.weekOf > today) return "Choose the week this covers";
  if (r.summary.trim().length < 10) return "Write the account for the seller, in a sentence or two";
  if (r.summary.trim().length > 1500) return "Keep it under 1,500 characters";
  if (/\bbecause of (the )?price\b|\bprice is (the )?(problem|reason)\b|\boverpriced\b/i.test(r.summary)) {
    return "Say what the figures and feedback show; the product never states that price is the reason";
  }
  if (!["keep", "change", "undecided"].includes(r.decision)) return "Record what the seller decided";
  if (r.decision === "change" && !r.decisionNote?.trim()) return "Say what changes";
  return null;
}

/** The line the seller reads about the listing. */
export function listingLine(events: ListingEvent[], showings: Showing[]): string {
  const s = listingStatus(events);
  const counts = showingCounts(showings);
  if (s.status === "preparing") {
    const left = checklist(events).filter((c) => !c.done).map((c) => c.label.toLowerCase());
    return left.length ? `Getting ready to launch. Still to do: ${left.join(", ")}.` : "Ready to launch; going live is recorded when the MLS shows it.";
  }
  if (s.status === "withdrawn") return "Withdrawn from the market for now.";
  return `Live on the MLS${s.price ? ` at ${money(s.price)}` : ""}${s.syndicated ? "" : "; other sites can take a day or two to show it"}. ${counts.line}`;
}
