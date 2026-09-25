"use client";

import type { Answers } from "@/lib/core/asks";
import type { InputKey } from "@/lib/core/values";

/**
 * Answers given to the values, kept on this device so the next value never
 * asks them again (Blueprint v5 §5.1).
 *
 * Anonymous progress on one device expires and can be reset (LEAD-06). Thirty
 * days: long enough to come back after a weekend of thinking about it, short
 * enough that a shared or borrowed computer does not keep somebody's income
 * indefinitely. Restoring elsewhere needs "Save my plan" (§5.5).
 *
 * Storage can be missing or refuse (private windows, blocked site data); every
 * read and write is wrapped, and the values work without it, they just ask
 * again.
 */

const KEY = "rift.answers.v1";
const TTL_MS = 30 * 86_400_000;

interface Stored { at: number; a: Answers }

export function readAnswers(): Answers {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.at !== "number" || Date.now() - s.at > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return {};
    }
    return s.a ?? {};
  } catch {
    return {};
  }
}

export function writeAnswers(patch: Answers): Answers {
  const merged = { ...readAnswers(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), a: merged } satisfies Stored));
  } catch { /* the page still works; the next value asks again */ }
  return merged;
}

export function clearAnswers() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

export function answeredKeys(a: Answers): Set<InputKey> {
  return new Set(Object.keys(a).filter((k) => a[k as InputKey] !== undefined) as InputKey[]);
}
