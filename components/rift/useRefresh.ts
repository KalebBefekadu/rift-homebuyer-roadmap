"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Bring the page up to date after a write, and make sure it happens.
 *
 * `router.refresh()` on the journey pages sometimes never lands. The React
 * build bundled with Next 15.5 renders the refreshed tree, waits on one of its
 * streamed chunks, and loses the wake-up when that chunk resolves: the root
 * stays suspended with nothing scheduled, and the page shows the old data
 * for good. Found on a production build of /operations/journey (about half of all
 * full page loads) by reading React's root state on the hung page: the update
 * rendered, every promise it waited on was fulfilled, nothing pinged it (local
 * walk-through, 23 Sep 2026). Buffering the reply whole always avoided it, so
 * it depends on how the reply streams; nothing in the page's code causes it.
 *
 * So: refresh, and if `stamp` (a summary of what the component shows) has not
 * changed after four seconds, reload the page. Every write that calls this has
 * already been stored and confirmed on screen, so a reload loses nothing,
 * except what exists only in the browser: callers showing a one-time value
 * (an invitation link) pass `reload: false`.
 */
export function useRefresh(stamp: string) {
  const router = useRouter();
  const current = useRef(stamp);
  useEffect(() => { current.current = stamp; }, [stamp]);

  return useCallback((opts?: { reload?: boolean }) => {
    const before = current.current;
    router.refresh();
    if (opts?.reload === false) return;
    window.setTimeout(() => { if (current.current === before) window.location.reload(); }, 4000);
  }, [router]);
}

/** `router.push`, falling back to a full load if the page has not changed. */
export function useGo() {
  const router = useRouter();
  return useCallback((href: string) => {
    const from = window.location.pathname;
    router.push(href);
    window.setTimeout(() => { if (window.location.pathname === from) window.location.assign(href); }, 5000);
  }, [router]);
}
