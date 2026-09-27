/**
 * The journey workspace's tabs (Blueprint v5 §8.6). The tab is in the
 * address (?tab=), so a link from Today or Transactions opens the right one
 * and back returns to it.
 */

export type Tab = "overview" | "search" | "homes" | "offers" | "contract" | "money" | "household" | "history" | "property";

export const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  search: "Search",
  homes: "Homes and showings",
  offers: "Offers and documents",
  contract: "Contract",
  money: "Money",
  property: "The property",
  household: "Household",
  history: "History",
};

/** A buyer's workspace, or a seller's (Blueprint v5 §9): the seller's own parts arrive in slices. */
export function tabsFor(buying: boolean): Tab[] {
  return buying
    ? ["overview", "search", "homes", "offers", "contract", "money", "household", "history"]
    : ["overview", "property", "contract", "household", "history"];
}

export function tabFrom(raw: string | undefined, buying: boolean): Tab {
  const t = (raw ?? "overview") as Tab;
  return tabsFor(buying).includes(t) ? t : "overview";
}
