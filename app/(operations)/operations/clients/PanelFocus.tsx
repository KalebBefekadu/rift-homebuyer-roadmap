"use client";

import { useEffect, useRef } from "react";

/**
 * On a narrow screen the panel opens above the list, out of sight from where
 * the name was tapped, so choosing somebody looked like nothing happening.
 * Brings it into view there; beside the list, where it is already visible,
 * it does nothing.
 */
export function PanelFocus({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 1100px)").matches) ref.current?.scrollIntoView({ block: "start" });
  }, [id]);
  return <div ref={ref} className={className} style={{ scrollMarginTop: 8 }}>{children}</div>;
}
