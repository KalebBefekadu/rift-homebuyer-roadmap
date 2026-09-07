"use client";

/**
 * Rift prototype — retention and consent.
 *
 * People hand this product their savings balance, their timeline and the name
 * of the person they are buying with, before they have agreed to anything.
 * Being able to state plainly what happens to that — and to act on a request to
 * delete it in one click — is not a compliance chore here. It is the same
 * argument the whole product makes: show them the truth before asking for
 * something.
 *
 * Not legal advice. The consent wording below is written to be honest and
 * specific; counsel should review it before it collects a real phone number.
 */

import { clearEvents } from "./telemetry";
import { clearAttribution } from "./attribution";

/* ------------------------------------------------------------------ *
 * Retention
 * ------------------------------------------------------------------ */

export interface RetentionRule {
  id: string;
  what: string;
  keptFor: string;
  why: string;
  thenWhat: string;
}

export const RETENTION: RetentionRule[] = [
  {
    id: "unconverted",
    what: "An assessment nobody ever came back to",
    keptFor: "18 months",
    why: "A buyer on a 'nine to eighteen months' answer is still inside their own stated timeline. Deleting at ninety days would throw away the person the product was built for.",
    thenWhat: "Deleted outright — not anonymised, not archived.",
  },
  {
    id: "abandoned",
    what: "A part-finished assessment with no contact details",
    keptFor: "30 days",
    why: "Long enough to resume on the same device, short enough that it is not a collection of strangers' finances.",
    thenWhat: "Deleted outright.",
  },
  {
    id: "client",
    what: "The record of someone we actually worked with",
    keptFor: "As required by Georgia licence law",
    why: "Transaction records are not ours to discard. The retention period is set by the state and the brokerage, not by us.",
    thenWhat: "Retained per brokerage policy, then destroyed on their schedule.",
  },
  {
    id: "analytics",
    what: "Funnel measurement — which question people stop on",
    keptFor: "24 months",
    why: "Carries the question id and the time spent, never the answer. We know someone stopped on the savings question; we do not know what they typed.",
    thenWhat: "Aggregated counts survive, individual event rows do not.",
  },
  {
    /* Added because the panel was silent about it, and a retention list that
       omits one category is not a retention list — it is a selection. This
       record is also the only thing that can later prove the contact was
       lawful, which is why it outlives the relationship it came from. */
    id: "consent",
    what: "A record of what you agreed to, and the exact wording you agreed to",
    keptFor: "The relationship, then five years",
    why: "It is the evidence that we were allowed to contact you at all. Keeping the wording rather than a reference to it means we cannot quietly change what you agreed to after the fact.",
    thenWhat: "Deleted with the rest of the record.",
  },
];

/* ------------------------------------------------------------------ *
 * Consent
 * ------------------------------------------------------------------ */

/**
 * US telemarketing rules require prior express WRITTEN consent before an
 * autodialed or prerecorded marketing call or text. A pre-ticked box is not
 * consent, and consent bundled into a terms-of-service link is not consent
 * either — it has to be a separate, unticked, specific agreement, and the exact
 * wording shown has to be retained alongside the record.
 *
 * Which is also why the phone number is optional here. Email costs nothing to
 * offer and carries none of this.
 */
export const CONSENT_VERSION = "2026-09-01";

export const PHONE_CONSENT =
  "I agree that Kaleb Befekadu and Rift may call and text me at this number about my " +
  "enquiry, including with an automatic dialling system or a prerecorded message. " +
  "I understand this is not a condition of buying or selling anything, that message " +
  "and data rates may apply, and that I can stop it any time by replying STOP.";

export const EMAIL_NOTE =
  "We email you your readout and tell you when something in it changes. No newsletter, " +
  "no list, and nothing sold on. One click unsubscribes.";

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
