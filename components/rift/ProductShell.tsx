"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ico, Mark } from "./icons";
import { Track } from "./Track";

type V = "buy" | "sell";

const NAV: Record<V, { href: string; label: string }[]> = {
  buy: [
    { href: "/prototype/buy", label: "What you'll need" },
    { href: "/prototype/buy/assistance", label: "Assistance" },
    { href: "/prototype/buy/how", label: "How it works" },
  ],
  sell: [
    { href: "/prototype/sell", label: "What you'll keep" },
    { href: "/prototype/sell/unclaimed", label: "Unclaimed value" },
    { href: "/prototype/sell/how", label: "How it works" },
  ],
};

const COPY: Record<V, { name: string; cta: string; start: string; other: string; otherHref: string }> = {
  buy: { name: "Rift for buyers", cta: "Get my numbers", start: "/prototype/buy/start", other: "Selling instead?", otherHref: "/prototype/sell" },
  sell: { name: "Rift for sellers", cta: "Estimate my net", start: "/prototype/sell/start", other: "Buying instead?", otherHref: "/prototype/buy" },
};

export function ProductShell({ v, children }: { v: V; children: React.ReactNode }) {
  const path = usePathname();
  const c = COPY[v];
  return (
    <div className={v}>
      <Track />
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.84)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 62 }}>
          <Link href={NAV[v][0].href} className="row gap-2">
            <Mark size={21} />
            <span className="mark-name" style={{ fontSize: 20 }}>Rift</span>
            <span className="chip chip-brand hide-sm">{v === "buy" ? "Buyers" : "Sellers"}</span>
          </Link>
          <nav className="row hide-sm" style={{ gap: 2 }}>
            {NAV[v].map((l) => (
              <Link key={l.href} href={l.href} className="btn btn-g btn-sm"
                style={{ color: path === l.href ? "var(--ink)" : "var(--ink-2)", background: path === l.href ? "var(--sunk)" : undefined }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="row gap-1">
            <Link href="/prototype/app" className="btn btn-g btn-sm hide-sm">Sign in</Link>
            <Link href={c.start} className="btn btn-brand btn-sm">{c.cta}</Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 96 }}>
        <div className="shell-w" style={{ padding: "36px 0 96px" }}>
          <div className="between wrap gap-4" style={{ alignItems: "flex-start" }}>
            <div style={{ maxWidth: 300 }}>
              <div className="row gap-2">
                <Mark size={19} />
                <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
              </div>
              <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
                {c.name}. Guided by Kaleb Befekadu in Georgia. Every figure is a planning
                estimate, not a lending commitment, approval, or valuation.
              </p>
              <Link href={c.otherHref} className="btn btn-s btn-sm" style={{ marginTop: 14 }}>
                {c.other} <Ico.arrowR size={13} />
              </Link>
            </div>
            <div className="row gap-5 wrap" style={{ alignItems: "flex-start" }}>
              <div className="col gap-2">
                <div className="t-2xs w6 c-4" style={{ letterSpacing: ".08em", textTransform: "uppercase" }}>This product</div>
                {NAV[v].map((l) => <Link key={l.href} href={l.href} className="t-xs c-3">{l.label}</Link>)}
                <Link href={c.start} className="t-xs c-3">Start</Link>
              </div>
              <div className="col gap-2">
                <div className="t-2xs w6 c-4" style={{ letterSpacing: ".08em", textTransform: "uppercase" }}>Rift</div>
                <Link href="/prototype/kaleb" className="t-xs c-3">About Kaleb</Link>
                <Link href="/prototype/offer" className="t-xs c-3">Submit an offer</Link>
                <Link href="/prototype/app" className="t-xs c-3">Sign in</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
