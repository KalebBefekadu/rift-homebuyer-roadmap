/**
 * Where Operations goes (Blueprint v5 §8.3): the main places first, then the
 * smaller ones. One list, read by the sidebar, the quick switcher and the
 * keyboard shortcuts, so a page added to one is in all three.
 */

import type { OpsIconName } from "@/components/rift/ops-icons";

export interface Place {
  href: string;
  label: string;
  /** Its mark in the menu: what stands for the word when the menu is closed. */
  icon: OpsIconName;
  /** The second key after "g", when it has one. */
  key?: string;
}

export const MAIN: Place[] = [
  { href: "/operations", label: "Today", icon: "today", key: "t" },
  { href: "/operations/clients", label: "Relationships", icon: "people", key: "r" },
  { href: "/operations/search", label: "Search", icon: "homeSearch", key: "s" },
  { href: "/operations/transactions", label: "Transactions", icon: "contract", key: "x" },
  { href: "/operations/offers", label: "Offers", icon: "tag", key: "o" },
  { href: "/operations/calendar", label: "Calendar", icon: "calendar", key: "c" },
];

export const MORE: Place[] = [
  { href: "/operations/outbox", label: "Outbox", icon: "outbox" },
  { href: "/operations/referrals", label: "Advocacy", icon: "advocacy" },
  { href: "/operations/reports", label: "Reports", icon: "reports" },
  { href: "/operations/campaigns", label: "Campaigns", icon: "campaign" },
  { href: "/operations/programs", label: "Programs", icon: "programs" },
  { href: "/operations/questions", label: "Questions", icon: "questions" },
  { href: "/operations/settings", label: "Settings", icon: "settings" },
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
  const all = [...MAIN, ...MORE, { href: "/operations/add", label: "Add someone", icon: "addPerson" as const }];
  return t ? all.filter((p) => p.label.toLowerCase().includes(t)) : all;
}
