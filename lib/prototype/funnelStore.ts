"use client";

/**
 * Prototype persistence for funnel edits.
 *
 * localStorage stands in for what would be a per-tenant row in the real thing.
 * It is here so the editor in Studio actually changes the live funnel — an
 * editor whose changes you cannot go and look at is a mock, not a prototype.
 */

import { useCallback, useEffect, useState } from "react";
import { BUY_FUNNEL, SELL_FUNNEL, type Funnel } from "@/lib/core/funnel";

const KEY = (side: "buy" | "sell") => `rift.funnel.${side}`;
const DEFAULTS: Record<"buy" | "sell", Funnel> = { buy: BUY_FUNNEL, sell: SELL_FUNNEL };

export function readFunnel(side: "buy" | "sell"): Funnel {
  if (typeof window === "undefined") return DEFAULTS[side];
  try {
    const raw = window.localStorage.getItem(KEY(side));
    return raw ? (JSON.parse(raw) as Funnel) : DEFAULTS[side];
  } catch {
    return DEFAULTS[side];
  }
}

/**
 * Every save bumps the version and records what changed. Leads carry the
 * version they answered, so an edit can never retroactively rewrite what a
 * person was asked.
 */
export function writeFunnel(f: Funnel, what = "Edited") {
  try {
    const prev = readFunnel(f.side);
    const next: Funnel = {
      ...f,
      version: (prev.version ?? 1) + 1,
      updatedAt: new Date().toISOString().slice(0, 10),
      changes: [{ at: new Date().toISOString().slice(0, 10), what }, ...(prev.changes ?? [])].slice(0, 12),
    };
    window.localStorage.setItem(KEY(f.side), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("rift:funnel", { detail: f.side }));
    return next;
  } catch {
    return f; /* storage unavailable — the default funnel still works */
  }
}

export function resetFunnel(side: "buy" | "sell") {
  try {
    window.localStorage.removeItem(KEY(side));
    window.dispatchEvent(new CustomEvent("rift:funnel", { detail: side }));
  } catch { /* ignore */ }
}

export function isCustomised(side: "buy" | "sell") {
  try { return typeof window !== "undefined" && window.localStorage.getItem(KEY(side)) !== null; }
  catch { return false; }
}

/**
 * Always renders the shipped funnel on the server and on first paint, then
 * swaps in the agent's edits. Anything else is a hydration mismatch.
 */
export function useFunnel(side: "buy" | "sell") {
  const [f, setF] = useState<Funnel>(DEFAULTS[side]);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => { setF(readFunnel(side)); setReady(true); }, [side]);

  useEffect(() => {
    sync();
    const h = () => sync();
    window.addEventListener("rift:funnel", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("rift:funnel", h); window.removeEventListener("storage", h); };
  }, [sync]);

  return { funnel: f, ready, save: (next: Funnel, what?: string) => setF(writeFunnel(next, what)) };
}
