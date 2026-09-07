"use client";

/**
 * Rift prototype — first-touch attribution.
 *
 * Deliberately modest. The brief was "strong, not best in the world", and the
 * difference between those two is roughly the difference between one afternoon
 * and one quarter. What is here answers the only questions a solo agent
 * actually acts on: which campaign sent this person, what page they landed on,
 * and how long they took to come back.
 *
 * What is NOT here, on purpose: cross-device identity resolution, view-through
 * attribution, multi-touch weighting models. Those cost real money to build and
 * would be spent on measurement instead of on the value the measurement exists
 * to prove (benchmark.md, D1 criterion 1.5 targets a 3, not a 4).
 *
 * Nothing here is personal data. No IP, no fingerprint, no cross-site id.
 */

import { useEffect, useState } from "react";

export interface Touch {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  /** Path they landed on, without the query string. */
  landing: string;
  /** Referring host only — never the full referring URL. */
  referrer: string;
  at: string;
}

export interface Attribution {
  first: Touch;
  last: Touch;
  visits: number;
}

const KEY = "rift.attr";

const PARAM_MAP: Record<string, keyof Touch> = {
  utm_source: "source", utm_medium: "medium",
  utm_campaign: "campaign", utm_content: "content",
};

function classify(p: URLSearchParams, referrer: string) {
  if (p.get("utm_source")) return null;
  if (p.get("gclid")) return { source: "google", medium: "cpc" };
  if (p.get("fbclid")) return { source: "facebook", medium: "paid-social" };
  if (p.get("ref")) return { source: p.get("ref")!, medium: "referral" };
  if (!referrer) return { source: "direct", medium: "none" };
  if (/google|bing|duckduckgo/.test(referrer)) return { source: referrer, medium: "organic" };
  return { source: referrer, medium: "referral" };
}

export function captureTouch(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const p = new URLSearchParams(window.location.search);
    let host = "";
    try { host = document.referrer ? new URL(document.referrer).hostname : ""; } catch { host = ""; }
    if (host === window.location.hostname) host = "";

    const fallback = classify(p, host);
    const touch: Touch = {
      source: fallback?.source ?? p.get("utm_source") ?? "direct",
      medium: fallback?.medium ?? p.get("utm_medium") ?? "none",
      campaign: p.get("utm_campaign") ?? "—",
      content: p.get("utm_content") ?? "—",
      landing: window.location.pathname,
      referrer: host || "—",
      at: new Date().toISOString(),
    };
    for (const [k, field] of Object.entries(PARAM_MAP)) {
      const v = p.get(k);
      if (v) (touch[field] as string) = v;
    }

    const raw = window.localStorage.getItem(KEY);
    const prev = raw ? (JSON.parse(raw) as Attribution) : null;

    /* First touch never moves. That is the whole point of first touch — an
       agent who re-attributes a referral to the retargeting ad that caught it
       on the way back will keep buying retargeting and stop asking for
       referrals. */
    const next: Attribution = prev
      ? { first: prev.first, last: touch, visits: prev.visits + 1 }
      : { first: touch, last: touch, visits: 1 };

    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function readAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch { return null; }
}

export function clearAttribution() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Captures on first paint of any public page. Invisible to the visitor. */
export function useCaptureTouch() {
  useEffect(() => { captureTouch(); }, []);
}

/** Reads what this browser recorded. Studio-side only. */
export function useAttribution() {
  const [a, setA] = useState<Attribution | null>(null);
  useEffect(() => { setA(readAttribution()); }, []);
  return a;
}

export const describeTouch = (t: Touch) =>
  t.campaign !== "—" ? `${t.source} · ${t.campaign}` : `${t.source}${t.medium !== "none" ? ` · ${t.medium}` : ""}`;
