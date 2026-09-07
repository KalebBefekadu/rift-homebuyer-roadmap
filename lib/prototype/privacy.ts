"use client";

/**
 * Client-side privacy actions.
 *
 * The policy itself — what is kept, for how long, and the exact consent wording
 * — lives in `lib/core/privacy.ts`, because the server writes that text to the
 * consent record and the browser renders it, and a promise shown to somebody
 * must be the same string that is stored as evidence of it.
 *
 * What is left here is the part that can only happen in a browser: acting on a
 * deletion request, and reporting what is currently on this device.
 */

import { clearEvents } from "./telemetry";
import { clearAttribution } from "./attribution";
import { CONSENT_VERSION, PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";

export { RETENTION, CONSENT_VERSION, PHONE_CONSENT, EMAIL_NOTE } from "@/lib/core/privacy";
export type { RetentionRule } from "@/lib/core/privacy";

export interface ConsentRecord {
  channel: "email" | "phone";
  version: string;
  text: string;
  at: string;
}

export function recordConsent(channel: "email" | "phone"): ConsentRecord {
  return {
    channel,
    version: CONSENT_VERSION,
    text: channel === "phone" ? PHONE_CONSENT : EMAIL_NOTE,
    at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Deletion
 * ------------------------------------------------------------------ */

const OWNED_KEYS = ["rift.attr", "rift.events", "rift.funnel.buy", "rift.funnel.sell"];

/** Everything this browser holds, gone. No confirmation theatre, no soft delete. */
export function forgetMe() {
  try {
    clearEvents();
    clearAttribution();
    for (const k of OWNED_KEYS) window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function heldLocally(): { key: string; label: string; present: boolean }[] {
  const map: Record<string, string> = {
    "rift.attr": "Where you came from",
    "rift.events": "Which questions you saw",
    "rift.funnel.buy": "Buyer funnel edits",
    "rift.funnel.sell": "Seller funnel edits",
  };
  if (typeof window === "undefined") return [];
  return OWNED_KEYS.map((k) => ({
    key: k,
    label: map[k],
    present: (() => { try { return window.localStorage.getItem(k) !== null; } catch { return false; } })(),
  }));
}
