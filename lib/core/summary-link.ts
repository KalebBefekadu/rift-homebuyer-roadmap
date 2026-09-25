/**
 * Read-only summary links (ACCESS-02, Blueprint v5 §7.2). Pure: no I/O.
 *
 * A member chooses which parts to show. Each part is one or two sections of
 * their own records page, so a summary never words anything differently from
 * what the member sees. Nothing with money in it can be chosen yet: a figure
 * forwarded beyond the household is the one thing that cannot be taken back.
 */

import type { Scope } from "./journey";

export type SummaryPart = "stage" | "dates" | "homes";
export const SUMMARY_PARTS: SummaryPart[] = ["stage", "dates", "homes"];

export const PART_LABEL: Record<SummaryPart, string> = {
  stage: "Where the move stands",
  dates: "The checked contract dates",
  homes: "The homes on the list, and showings",
};

/** Which records sections each part shows. */
export const PART_SECTIONS: Record<SummaryPart, string[]> = {
  stage: ["Where things stand"],
  dates: ["Contract dates"],
  homes: ["Homes", "Showings"],
};

export const EXPIRY_DAYS = [7, 30, 90] as const;

/** A member may share only what they can see themselves. */
export function partsAllowed(scopes: readonly Scope[]): SummaryPart[] {
  return SUMMARY_PARTS.filter((p) => p !== "homes" || scopes.includes("homes"));
}

export function summaryError(parts: unknown, label: unknown, days: unknown, scopes: readonly Scope[]): string | null {
  if (!Array.isArray(parts) || parts.length === 0) return "Choose at least one part to share";
  const allowed = partsAllowed(scopes);
  if (parts.some((p) => !allowed.includes(p as SummaryPart))) return "You can only share what you can see yourself";
  if (new Set(parts).size !== parts.length) return "Choose each part once";
  if (typeof label !== "string" || !label.trim() || label.trim().length > 80) return "Say who it is for, in under 80 characters";
  if (!EXPIRY_DAYS.includes(Number(days) as (typeof EXPIRY_DAYS)[number])) return "Choose how long it lasts";
  return null;
}

/** The only shape a token can have; anything else opens nothing without a lookup. */
export const isSummaryToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export type LinkState = "live" | "expired" | "revoked";

export interface SummaryLinkView { id: string; label: string; parts: SummaryPart[]; expiresAt: string; state: LinkState; createdAt: string }
export function linkState(l: { expiresAt: string; revokedAt: string | null }, now = new Date()): LinkState {
  if (l.revokedAt) return "revoked";
  return Date.parse(l.expiresAt) <= now.getTime() ? "expired" : "live";
}

/**
 * No money leaves in a summary. The sections chosen carry none by design, but
 * a workstream line can include the agent's own note, and a note can contain
 * a figure. Any dollar amount is replaced, and the page says amounts are left
 * out, so the reader is not misled into thinking there were none.
 */
export const withoutMoney = (line: string) => line.replace(/\$\s?\d[\d,]*(\.\d+)?(\s?[kKmM]\b)?/g, "[amount not shared]");
