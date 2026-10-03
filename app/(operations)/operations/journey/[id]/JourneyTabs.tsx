"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import s from "./journey.module.css";

/**
 * The tab bar. It scrolls inside itself when the tabs do not fit (a phone, or
 * a sale's ten tabs on a laptop), so the current tab is brought into view on
 * arrival: otherwise opening Contract on a phone shows Overview, Search and
 * Homes, and the tab you are on is somewhere off to the right.
 */
export function JourneyTabs({ tabs, current }: { tabs: { id: string; href: string; label: string; count?: number }[]; current: string }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const on = bar.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const el = bar.current;
    if (!on || !el) return;
    /* Scroll the bar itself, never the page. */
    el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
  }, [current]);

  return (
    <nav ref={bar} className={s.tabs} aria-label="Journey">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={s.tab} aria-current={t.id === current ? "page" : undefined}>
          {t.label}
          {t.count ? <span className={s.badge} aria-label={`${t.count} need${t.count === 1 ? "s" : ""} you`}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
