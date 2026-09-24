import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { signOut } from "./actions";

/**
 * The bar across the top of every Operations screen.
 *
 * "Operations" is the name the blueprint v4 specification gives this surface
 * (§2): the agent's view of what needs his judgement. Blueprint v5 moved the
 * addresses from /studio to /operations; next.config.ts redirects the old ones.
 *
 * Extracted the moment there was a second screen to put it on. A header
 * duplicated is a header that drifts: the settings badge counting undecided
 * rules would have been on one page and not the other within a week, and the
 * page missing it is the one where nothing tells him a decision is outstanding.
 *
 * `current` only decides which link is not a link. A nav item that navigates to
 * the page you are already on is a small lie about what will happen.
 */
export function StudioHeader({ agentName, undecided = 0, current }: {
  agentName: string;
  undecided?: number;
  current: "today" | "clients" | "search" | "calendar" | "offers" | "referrals" | "pilot" | "questions" | "settings" | "add";
}) {
  const nav = [
    { key: "today", href: "/operations", label: "Today" },
    { key: "clients", href: "/operations/clients", label: "Relationships" },
    { key: "search", href: "/operations/search", label: "Search" },
    { key: "offers", href: "/operations/offers", label: "Offers" },
    { key: "calendar", href: "/operations/calendar", label: "Calendar" },
    { key: "referrals", href: "/operations/referrals", label: "Advocacy" },
    { key: "pilot", href: "/operations/pilot", label: "Pilot" },
  ] as const;

  return (
    <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
      {/* Wraps rather than running off the side: at 200% zoom a laptop is
          640px wide, and a header that scrolls sideways hides "Sign out". */}
      <div className="shell-w between" style={{ minHeight: 56, flexWrap: "wrap", rowGap: 8, paddingBlock: 8 }}>
        <div className="row gap-2">
          <Link href="/operations" className="row gap-2" aria-label="Rift Operations, Today">
            <Mark size={19} />
            <span className="mark-name hide-sm" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <span className="chip chip-out t-2xs hide-sm">Operations</span>

          {/* The right-hand group wraps below when there is no room, so the
              menu may use the width; past that it scrolls, never the page. */}
          <nav className="row gap-1" style={{ marginLeft: 6, overflowX: "auto", maxWidth: "calc(100vw - 80px)" }} aria-label="Operations">
            {nav.map((n) => (
              <Link key={n.key} href={n.href} className="row" style={{
                height: 28, padding: "0 9px", borderRadius: 7, fontSize: 13, whiteSpace: "nowrap",
                fontWeight: current === n.key ? 600 : 500,
                color: current === n.key ? "var(--ink)" : "var(--ink-3)",
                background: current === n.key ? "var(--sunk)" : "transparent",
              }}>{n.label}</Link>
            ))}
          </nav>
        </div>

        <div className="row gap-2">
          <Link href="/operations/add" className="btn btn-p btn-sm">Add someone</Link>
          <Link href="/operations/questions" className="btn btn-g btn-sm" title="Your questions">
            <Ico.doc size={14} />
          </Link>
          {/* Carries its own warning. Six decisions the product cannot make for
              him, and until he has made them this badge is the only thing that
              says so: on every screen, now, rather than on one of them. */}
          <Link href="/operations/settings" className="btn btn-g btn-sm" title="Your decisions">
            <Ico.set size={14} />
            {undecided ? <span className="chip chip-warn t-2xs">{undecided}</span> : null}
          </Link>
          <span className="t-xs c-4 hide-sm">{agentName}</span>
          <form action={signOut}>
            <button className="btn btn-g btn-sm" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
