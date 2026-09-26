/**
 * The Operations quick switcher and keyboard shortcuts (Blueprint v5 §8.3).
 * Pure: the page list, matching, and which key goes where. The component is
 * app/(operations)/operations/Switcher.tsx.
 */

export interface PageEntry { href: string; label: string; words: string }

export const PAGES: PageEntry[] = [
  { href: "/operations", label: "Today", words: "today home needs you" },
  { href: "/operations/clients", label: "Relationships", words: "relationships people clients leads contacts" },
  { href: "/operations/search", label: "Search", words: "search matrix buyers homes" },
  { href: "/operations/transactions", label: "Transactions", words: "transactions contracts deals closing" },
  { href: "/operations/offers", label: "Offers", words: "offers inbound" },
  { href: "/operations/calendar", label: "Calendar", words: "calendar bookings showings" },
  { href: "/operations/add", label: "Add someone", words: "add new person lead create" },
  { href: "/operations/referrals", label: "Reviews and referrals", words: "reviews referrals advocacy" },
  { href: "/operations/pilot", label: "Reports", words: "reports pilot funnel" },
  { href: "/operations/questions", label: "Lead-form questions", words: "questions lead form funnel" },
  { href: "/operations/settings", label: "Settings", words: "settings decisions rules" },
  { href: "/operations/settings?section=steps", label: "Settings: who does each step", words: "checklist steps assign coordinator" },
  { href: "/operations/settings?section=team", label: "Settings: team", words: "team coordinator invite" },
];

/** Pages whose name or words start with every typed word, best first. Blank shows them all. */
export function matchPages(q: string, pages = PAGES): PageEntry[] {
  const parts = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length) return pages;
  const score = (p: PageEntry) => {
    const hay = `${p.label} ${p.words}`.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (!parts.every((w) => hay.some((h) => h.startsWith(w)))) return -1;
    return p.label.toLowerCase().startsWith(parts[0]) ? 2 : 1;
  };
  return pages.map((p) => [p, score(p)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

/** "g" then one of these, like the mock-up. */
export const GO_KEYS: Record<string, string> = {
  t: "/operations",
  r: "/operations/clients",
  s: "/operations/search",
  x: "/operations/transactions",
  o: "/operations/offers",
  c: "/operations/calendar",
  a: "/operations/add",
};

export const SHORTCUT_HELP: [string, string][] = [
  ["Ctrl K or ⌘ K", "Find a person or a page"],
  ["/", "Find, when not typing"],
  ["g then t, r, s, x, o, c, a", "Today, Relationships, Search, Transactions, Offers, Calendar, Add someone"],
  ["?", "These shortcuts"],
  ["Esc", "Close"],
];

/** Typing in a field never triggers a shortcut. */
export function isTypingTarget(t: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!t) return false;
  const tag = (t.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(t.isContentEditable);
}
