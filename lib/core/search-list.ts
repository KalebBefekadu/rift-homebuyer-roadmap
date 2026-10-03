/**
 * The Search page's working list: which journeys are actively searching, and
 * what each one needs from the agent.
 *
 * The list used to be every buying journey, so a buyer who had closed in
 * September showed as "Write the brief" and was counted among the searches
 * that "need something from you". A search is active only while the journey
 * is active (or paused, which is its own named state) and has not yet reached
 * a contract: after Offer, the work is the contract, not the search.
 *
 * Pure: no I/O.
 */

import type { JourneyStatus, Stage } from "./progress";
import type { SearchStatus } from "./search";

export type SearchGroup = "needs" | "running" | "paused";

/** What is his to do, first. A search that is running needs nothing today. */
const ORDER: SearchStatus[] = [
  "manual-action-needed", "update-pending", "awaiting-approval", "unknown", "draft", "paused", "active-confirmed",
];

export const WHAT_NEXT: Record<SearchStatus, string> = {
  "manual-action-needed": "Set it up in Matrix, then record it",
  "update-pending": "The brief changed. Review it and update Matrix",
  "awaiting-approval": "Review the brief and approve it as a search",
  unknown: "Could not be read. Open it to check",
  draft: "Write the brief",
  paused: "Paused in Matrix",
  "active-confirmed": "Nothing to do",
};

/** The stages in which a buyer is still looking. */
const SEARCHING: Stage[] = ["prepare", "search", "tour", "offer"];

export interface SearchListInput {
  stage: Stage;
  status: JourneyStatus;
  statusReason: string | null;
  search: SearchStatus;
}

export interface SearchListing {
  listed: boolean;
  group: SearchGroup;
  /** One line on what it needs, in words. */
  next: string;
  /** Lower is more urgent. Within a group, older work first is the caller's tiebreak. */
  rank: number;
}

export function searchListing(i: SearchListInput): SearchListing {
  const listed = (i.status === "active" || i.status === "paused") && SEARCHING.includes(i.stage);
  /* A paused journey keeps its search but chases nothing: its own group, with its reason. */
  if (i.status === "paused") {
    return { listed, group: "paused", next: i.statusReason ? `Journey paused: ${i.statusReason}` : "Journey paused", rank: ORDER.length };
  }
  const group: SearchGroup = i.search === "active-confirmed" ? "running" : i.search === "paused" ? "paused" : "needs";
  return { listed, group, next: WHAT_NEXT[i.search], rank: ORDER.indexOf(i.search) };
}
