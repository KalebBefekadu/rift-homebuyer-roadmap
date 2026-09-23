import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { signOut } from "./actions";

/**
 * The bar across the top of every Studio screen.
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
  current: "today" | "clients" | "calendar" | "offers" | "referrals" | "questions" | "settings" | "add";
}) {
  const nav = [
    { key: "today", href: "/studio", label: "Today" },
    { key: "clients", href: "/studio/clients", label: "People" },
    { key: "calendar", href: "/studio/calendar", label: "What’s coming" },
    { key: "offers", href: "/studio/offers", label: "Offers in" },
    { key: "referrals", href: "/studio/referrals", label: "Advocacy" },
  ] as const;

  return (
    <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
      <div className="shell-w between" style={{ height: 56 }}>
        <div className="row gap-2">
          <Link href="/studio" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name hide-sm" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <span className="chip chip-out t-2xs hide-sm">Studio</span>

          <nav className="row gap-1" style={{ marginLeft: 6 }}>
            {nav.map((n) => (
              <Link key={n.key} href={n.href} className="row" style={{
                height: 28, padding: "0 10px", borderRadius: 7, fontSize: 13,
                fontWeight: current === n.key ? 600 : 500,
                color: current === n.key ? "var(--ink)" : "var(--ink-3)",
                background: current === n.key ? "var(--sunk)" : "transparent",
              }}>{n.label}</Link>
            ))}
          </nav>
        </div>

        <div className="row gap-2">
          <Link href="/studio/add" className="btn btn-p btn-sm">Add someone</Link>
          <Link href="/studio/questions" className="btn btn-g btn-sm" title="Your questions">
            <Ico.doc size={14} />
          </Link>
          {/* Carries its own warning. Six decisions the product cannot make for
              him, and until he has made them this badge is the only thing that
              says so: on every screen, now, rather than on one of them. */}
          <Link href="/studio/settings" className="btn btn-g btn-sm" title="Your decisions">
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
