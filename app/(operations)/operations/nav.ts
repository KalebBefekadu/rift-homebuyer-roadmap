/**
 * Where Operations goes (Blueprint v5 §8.3): the main places first, then the
 * smaller ones. One list, read by the sidebar, the quick switcher and the
 * keyboard shortcuts, so a page added to one is in all three.
 */

export interface Place {
  href: string;
  label: string;
  /** The second key after "g", when it has one. */
  key?: string;
}

export const MAIN: Place[] = [
  { href: "/operations", label: "Today", key: "t" },
  { href: "/operations/clients", label: "Relationships", key: "r" },
  { href: "/operations/search", label: "Search", key: "s" },
  { href: "/operations/transactions", label: "Transactions", key: "x" },
  { href: "/operations/offers", label: "Offers", key: "o" },
  { href: "/operations/calendar", label: "Calendar", key: "c" },
];

export const MORE: Place[] = [
  { href: "/operations/outbox", label: "Outbox" },
  { href: "/operations/referrals", label: "Advocacy" },
  { href: "/operations/reports", label: "Reports" },
  { href: "/operations/programs", label: "Programs" },
  { href: "/operations/questions", label: "Questions" },
  { href: "/operations/settings", label: "Settings" },
];

/** Whether a place is the one being looked at, or holds it (a journey is under Search). */
export function isCurrent(href: string, path: string): boolean {
  if (href === "/operations") return path === "/operations";
  if (href === "/operations/clients" && path.startsWith("/operations/lead/")) return true;
  if (href === "/operations/search" && path.startsWith("/operations/journey/")) return true;
  return path === href || path.startsWith(`${href}/`);
}

/** Pages the quick switcher can jump to, matched in the browser. */
export function placesMatching(q: string): Place[] {
  const t = q.trim().toLowerCase();
  const all = [...MAIN, ...MORE, { href: "/operations/add", label: "Add someone" }];
  return t ? all.filter((p) => p.label.toLowerCase().includes(t)) : all;
}
