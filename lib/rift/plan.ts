"use client";

/**
 * The plan taking shape (Blueprint v5 §5.5): as a person finishes values, a
 * small summary builds up on this device (target price, cash needed, monthly
 * cost, programs to check). It is the thing "Save my plan" keeps.
 *
 * Same lifetime as the answers store: thirty days on this device, then gone.
 */

export interface PlanEntry {
  tool: string;
  /** Short label: "Cash to close". */
  label: string;
  /** The headline, as shown: "$24,788". */
  figure: string;
  /** The answer page, with its answers, so it can be reopened. */
  href: string;
  at: number;
}

const KEY = "rift.plan.v1";
const TTL_MS = 30 * 86_400_000;

export function readPlan(): PlanEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PlanEntry[];
    const fresh = Array.isArray(list) ? list.filter((e) => e && Date.now() - e.at < TTL_MS) : [];
    return fresh;
  } catch {
    return [];
  }
}

/** Adds or replaces this value's entry, most recent last. */
export function rememberValue(e: Omit<PlanEntry, "at">): PlanEntry[] {
  const list = [...readPlan().filter((x) => x.tool !== e.tool), { ...e, at: Date.now() }];
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* still shown, just not kept */ }
  return list;
}

export function clearPlan() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
