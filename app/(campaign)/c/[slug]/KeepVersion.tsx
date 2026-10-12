"use client";

import { useEffect } from "react";

/**
 * A visitor stays on the version they started on (CAMP-03): the address
 * gets the version it rendered, so a reload, a back button or a shared link
 * shows the same page even after a newer version is published. Replaced in
 * place, so it adds no history entry.
 */
export function KeepVersion({ version }: { version: number }) {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("v") === String(version)) return;
      url.searchParams.set("v", String(version));
      window.history.replaceState(window.history.state, "", url.toString());
    } catch { /* an old browser keeps the address it has */ }
  }, [version]);
  return null;
}
