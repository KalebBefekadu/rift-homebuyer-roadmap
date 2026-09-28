"use client";

/**
 * Prototype persistence for the business rules. localStorage stands in for
 * `rift_business_rules`, which the product's Settings writes (lib/db/settings.ts).
 *
 * Here rather than in lib/core/settings.ts, which is the domain layer and does
 * no I/O. The validation both stores share, `mergeRules`, stays there.
 */

import { DEFAULT_RULES, mergeRules, type BusinessRules } from "@/lib/core/settings";

const KEY = "rift.rules";

export function readRules(): BusinessRules {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_RULES;
    return mergeRules(JSON.parse(raw) as Partial<Record<keyof BusinessRules, unknown>>);
  } catch { return DEFAULT_RULES; }
}

export function writeRule<K extends keyof BusinessRules>(k: K, v: BusinessRules[K]["value"]) {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(KEY, JSON.stringify({ ...saved, [k]: v }));
    window.dispatchEvent(new CustomEvent("rift:rules"));
  } catch { /* ignore */ }
}

export function resetRules() {
  try { window.localStorage.removeItem(KEY); window.dispatchEvent(new CustomEvent("rift:rules")); } catch { /* ignore */ }
}

/** Rules still sitting on their default. Shown so "unset" and "chosen" differ. */
export function undecided(): (keyof BusinessRules)[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]).filter((k) => saved[k] === undefined);
  } catch { return Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]; }
}
