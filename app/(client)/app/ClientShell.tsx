import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";

export type ClientArea = "today" | "homes" | "search" | "offers" | "documents" | "records";

const AREAS: { a: ClientArea; label: string; href: (id: string) => string }[] = [
  { a: "today", label: "Today", href: (id) => `/app/j/${id}#today` },
  { a: "homes", label: "Homes", href: (id) => `/app/j/${id}#homes` },
  { a: "search", label: "Search", href: (id) => `/app/j/${id}#priorities` },
  { a: "offers", label: "Offers", href: (id) => `/app/j/${id}#offers` },
  { a: "documents", label: "Documents", href: (id) => `/app/j/${id}/documents` },
  { a: "records", label: "Records", href: (id) => `/app/j/${id}/records` },
];

/**
 * The bar across the buyer's pages: where they are, whose, a way between the
 * areas of their move, Help, and a way out (Blueprint v5 §7.2).
 *
 * Help is on every page and needs no script: how to reach the agent, what
 * happens next, and what to do when something looks wrong. The areas are
 * links, the first four to the parts of the journey page, so a phone gets
 * one scrolling page with a way to jump, not six thin ones.
 */
export function ClientShell({ agentName, journey, reach, children }: {
  agentName: string | null;
  journey?: { id: string; active: ClientArea; side: "buy" | "sell" };
  reach?: { email: string | null; phone: string | null };
  children: React.ReactNode;
}) {
  const first = agentName?.trim().split(/\s+/)[0] ?? "your agent";
  const areas = journey ? AREAS.filter((x) => journey.side === "buy" || ["today", "documents", "records"].includes(x.a)) : [];
  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }} className="no-print">
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/app" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <div className="row gap-2">
            {agentName ? <span className="t-xs c-4 hide-sm">With {agentName}</span> : null}
            <details className="client-help">
              <summary className="btn btn-g btn-sm"><Ico.info size={13} />Help</summary>
              <div className="client-help-panel card p-4" role="region" aria-label="Help">
                <div className="t-sm w6">Reaching {agentName ?? "your agent"}</div>
                {reach?.phone || reach?.email ? (
                  <ul className="t-sm" style={{ marginTop: 6, display: "grid", gap: 4 }}>
                    {reach.phone ? <li><a className="u" href={`tel:${reach.phone.replace(/[^\d+]/g, "")}`}>Call or text {reach.phone}</a></li> : null}
                    {reach.email ? <li><a className="u" href={`mailto:${reach.email}`}>Email {reach.email}</a></li> : null}
                  </ul>
                ) : (
                  <p className="t-sm c-3" style={{ marginTop: 6 }}>Reply to any email {first} sent you.</p>
                )}
                <div className="t-sm w6" style={{ marginTop: 12 }}>What happens next</div>
                <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
                  Today shows what needs you, first. When nothing does, it says so, and {first} tells you here when that changes.
                </p>
                <div className="t-sm w6" style={{ marginTop: 12 }}>If something looks wrong</div>
                <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
                  A date, a figure or a document that does not match what you were told: tell {first} before acting on it.
                  Nothing on these pages is a contract, an offer or a loan decision.
                </p>
              </div>
            </details>
            <form action="/app/sign-out" method="post">
              <button className="btn btn-g btn-sm" type="submit">Sign out</button>
            </form>
          </div>
        </div>
        {journey && areas.length ? (
          <nav className="shell-w client-areas" aria-label="Your move">
            {areas.map((x) => (
              <Link key={x.a} href={x.href(journey.id)} aria-current={journey.active === x.a ? "page" : undefined}>{x.label}</Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="shell-w" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 760 }}>{children}</main>
    </>
  );
}
