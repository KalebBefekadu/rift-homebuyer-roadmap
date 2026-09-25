import Link from "next/link";
import { Mark } from "@/components/rift/icons";

export type SiteSide = "home" | "buy" | "sell" | "abroad";

const CHIP: Record<SiteSide, string | null> = { home: null, buy: "Buyers", sell: "Sellers", abroad: "From abroad" };

const NAV: Record<SiteSide, { href: string; label: string }[]> = {
  home: [
    { href: "/buy", label: "Buying" },
    { href: "/sell", label: "Selling" },
    { href: "/abroad", label: "From abroad" },
  ],
  buy: [
    { href: "/buy/programs", label: "Georgia programs" },
    { href: "/buy/how", label: "How it works" },
  ],
  sell: [
    { href: "/sell/unclaimed", label: "Money you may be losing" },
    { href: "/sell/how", label: "How it works" },
  ],
  abroad: [
    { href: "/abroad/how", label: "How it works" },
  ],
};

/**
 * The one header for every public page (Blueprint v5 §4.2).
 *
 * The mark always goes home to the side the person is on. The action on the
 * right is secondary on purpose: the page's own primary action is the one
 * the eye should land on (§4.4), so this is `.btn-s` unless a page has no
 * primary action of its own.
 */
export function SiteHeader({ side, current, action }: {
  side: SiteSide;
  /** The address of this page, so its own link is marked rather than live. */
  current?: string;
  action?: { href: string; label: string };
}) {
  const home = side === "home" ? "/" : `/${side}`;
  const chip = CHIP[side];
  return (
    <header className="site-head">
      <div className="shell-w between site-head-in">
        <Link href={home} className="row gap-2" aria-label={chip ? `Rift for ${chip.toLowerCase()}` : "Rift home"}>
          <Mark size={20} />
          <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
          {chip ? <span className="chip chip-brand hide-xs">{chip}</span> : null}
        </Link>
        <nav className="row gap-4 site-nav" aria-label="Main">
          {NAV[side].map((n) => (
            <Link key={n.href} href={n.href} className="hide-sm" aria-current={current === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
          {action ? <Link href={action.href} className="btn btn-s btn-sm">{action.label}</Link> : null}
        </nav>
      </div>
    </header>
  );
}
