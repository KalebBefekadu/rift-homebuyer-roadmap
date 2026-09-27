/**
 * The journey workspace's tabs (Blueprint v5 §8.6). The tab is in the
 * address (?tab=), so a link from Today or Transactions opens the right one
 * and back returns to it.
 */

export type Tab = "overview" | "search" | "homes" | "offers" | "contract" | "household" | "history";

export const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  search: "Search",
  homes: "Homes and showings",
  offers: "Offers and documents",
  contract: "Contract",
  household: "Household",
  history: "History",
};

/** A selling journey has no search, homes, offers or contract here yet (§9 waits on the pilot). */
export function tabsFor(buying: boolean): Tab[] {
  return buying
    ? ["overview", "search", "homes", "offers", "contract", "household", "history"]
    : ["overview", "household", "history"];
}

export function tabFrom(raw: string | undefined, buying: boolean): Tab {
  const t = (raw ?? "overview") as Tab;
  return tabsFor(buying).includes(t) ? t : "overview";
}
