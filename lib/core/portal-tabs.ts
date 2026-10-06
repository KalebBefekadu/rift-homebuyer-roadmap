/**
 * The client portal's tabs (Blueprint v5 §7.2, manual review WS11.2).
 *
 * The journey was one long page of up to nine sections, so on a phone the
 * thing a client came back for (usually a document or an offer) was a long
 * scroll away. A client returns for one thing; each tab is that one thing.
 *
 * §7.2 names the tabs Today, Homes, Journey, Money, Documents, Help. "Journey"
 * is shown as "Offers" here: the only section that would sit under it is the
 * offers, and the contract's progress already lives on Today, where the
 * client looks for what is due. A tab named after what is in it needs no
 * explaining.
 *
 * The tab is in the address (`?tab=homes`), not in browser state, so a link
 * in an email can open the right one, Back works, and the server renders only
 * what that tab shows.
 */

export type PortalTab = "today" | "homes" | "offers" | "money" | "documents" | "help";

export const PORTAL_TABS: readonly PortalTab[] = ["today", "homes", "offers", "money", "documents", "help"];

export const TAB_LABEL: Record<PortalTab, string> = {
  today: "Today",
  homes: "Homes",
  offers: "Offers",
  money: "Money",
  documents: "Documents",
  help: "Help",
};

/**
 * Which tab each in-page place is on. Today's "Go to it" links and older
 * links ending in `#homes` still land where they point, on the right tab.
 */
const TAB_OF: Record<string, PortalTab> = {
  "under-contract": "today",
  "moving-in": "today",
  priorities: "homes",
  homes: "homes",
  offers: "offers",
  money: "money",
  pricing: "money",
  proceeds: "money",
  documents: "documents",
  help: "help",
};

export const tabOf = (anchor: string): PortalTab => TAB_OF[anchor] ?? "today";

/** A link to a place on the journey page, relative so it works in the agent's preview too. */
export const placeHref = (anchor: string) => `?tab=${tabOf(anchor)}#${anchor}`;

/**
 * The tab to show. Anything unknown, or a tab this member cannot see (a
 * seller has no Homes, a member without "Price and fees" no Money), is Today
 * rather than an error: an old link should still open the journey.
 */
export function pickTab(raw: unknown, available: readonly PortalTab[]): PortalTab {
  const t = typeof raw === "string" ? (raw as PortalTab) : null;
  return t && available.includes(t) ? t : "today";
}
