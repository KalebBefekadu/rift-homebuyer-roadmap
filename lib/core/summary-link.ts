/**
 * Read-only summary links (Blueprint v5 §7.2, ACCESS-02, decision D03): a
 * way to show someone outside the household where a move stands, without an
 * account and without anything they could act on.
 *
 * What a link may show is its scopes, chosen when it is made, and nothing
 * else: where the move stands, and the contract dates. Never money, notes,
 * documents, homes, names of other people or anything that can be answered.
 * The token is long and random, only its SHA-256 is stored, it expires, and
 * it can be revoked. The page sends no referrer, is never indexed and never
 * cached by anything shared.
 *
 * Pure: no I/O.
 */

export type SummaryScope = "progress" | "dates";
export const SCOPES: SummaryScope[] = ["progress", "dates"];
export const SCOPE_LABEL: Record<SummaryScope, string> = {
  progress: "Where the move stands",
  dates: "Contract dates",
};

/** Days a link lasts unless the agent chooses otherwise. */
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 90;

export interface SummaryLink {
  id: string;
  label: string;
  scopes: SummaryScope[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

/** Scopes from a form, keeping only known ones; none is refused rather than widened. */
export function readScopes(raw: unknown[]): SummaryScope[] {
  return [...new Set(raw.map(String).filter((s): s is SummaryScope => (SCOPES as string[]).includes(s)))];
}

export function expiryFrom(now: Date, days: number): string {
  const d = Math.min(MAX_DAYS, Math.max(1, Math.round(Number.isFinite(days) ? days : DEFAULT_DAYS)));
  return new Date(now.getTime() + d * 86_400_000).toISOString();
}

export type LinkState = "live" | "expired" | "revoked";

export function linkState(l: Pick<SummaryLink, "expiresAt" | "revokedAt">, now = new Date()): LinkState {
  if (l.revokedAt) return "revoked";
  return l.expiresAt <= now.toISOString() ? "expired" : "live";
}

/** A token looks like one the product makes, before anything is looked up. */
export const tokenShape = (t: string) => /^[A-Za-z0-9_-]{32,64}$/.test(t);
