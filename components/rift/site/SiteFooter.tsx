import Link from "next/link";
import { Mark } from "@/components/rift/icons";
import { valuesFor } from "@/lib/core/values";

/**
 * The one footer for every public page (Blueprint v5 §4.2, Kaleb R1).
 *
 * The front door and the buyer landing each had their own, and both were out
 * of line: the landing's set `padding: 26px 0 60px` on `.shell-w`, which
 * zeroed the side gutter the rest of the page sits in, so its columns ran to
 * the window edge. This one sits in the same grid as the content above it,
 * with the same columns on every page, and the values listed come from the
 * one catalogue (lib/core/values.ts) so the footer cannot link to a tool that
 * does not exist.
 */
export function SiteFooter() {
  const cols = [
    {
      title: "Buying",
      links: [
        ...valuesFor("buy").map((v) => ({ href: v.href, label: v.name })),
        { href: "/buy/programs", label: "Georgia programs" },
        { href: "/buy/how", label: "How it works" },
      ],
    },
    {
      title: "Selling",
      links: [
        ...valuesFor("sell").map((v) => ({ href: v.href, label: v.name })),
        { href: "/sell/how", label: "How it works" },
      ],
    },
    {
      title: "Rift",
      links: [
        { href: "/abroad", label: "Buying from abroad" },
        { href: "/offer", label: "Submit an offer" },
        { href: "/book", label: "Book a call" },
        { href: "/privacy", label: "What we keep" },
        { href: "/app/sign-in", label: "Client sign in" },
      ],
    },
  ];

  return (
    <footer className="site-foot">
      <div className="shell-w site-foot-grid">
        <div className="site-foot-brand" style={{ maxWidth: 360 }}>
          <Link href="/" className="row gap-2" aria-label="Rift home">
            <Mark size={18} />
            <span className="mark-name" style={{ fontSize: 17 }}>Rift</span>
          </Link>
          <p className="t-sm c-3" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Guided by Kaleb Befekadu, Peachtree Cardinal, Georgia. Using Rift costs you nothing.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} className="col" aria-label={c.title}>
            <div className="kicker">{c.title}</div>
            {c.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </nav>
        ))}
      </div>
      <div className="shell-w site-foot-base">
        <p className="t-xs c-4" style={{ lineHeight: 1.6, maxWidth: 760 }}>
          Every figure is a planning estimate from your answers and published Georgia terms, not a
          lending commitment, approval, or valuation, and not tax or legal advice.
        </p>
      </div>
    </footer>
  );
}
