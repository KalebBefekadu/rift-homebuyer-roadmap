/**
 * Who in a household may open a document the agent shared (Blueprint v5
 * §7.2). Pure: no I/O.
 *
 * Offers, counters, contracts, appraisals and lender papers carry the price
 * and the money, so by default they go only to members given the money
 * scope: the line the offer pages already draw, where a member without it
 * sees that there is an offer but not its terms. Disclosures and inspections
 * go to everyone. The agent can choose otherwise for any document.
 */

import type { Family } from "./document";
import type { Scope } from "./journey";

export type Audience = "household" | "money" | "none";
export const AUDIENCES: Audience[] = ["household", "money", "none"];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  household: "Everyone in the household",
  money: "Only those who see money",
  none: "Not shared",
};

const MONEY_FAMILIES: Family[] = ["offer", "counter", "contract", "appraisal", "lender"];

export const defaultAudience = (family: Family): Exclude<Audience, "none"> =>
  MONEY_FAMILIES.includes(family) ? "money" : "household";

/** The decision that holds for each document: the latest row, by time then id. */
export function currentShares(rows: { documentId: string; audience: Audience; at: string; id: string }[]): Map<string, Audience> {
  const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const out = new Map<string, Audience>();
  for (const r of sorted) out.set(r.documentId, r.audience);
  return out;
}

export const mayOpen = (audience: Audience | undefined, scopes: readonly Scope[]) =>
  audience === "household" || (audience === "money" && scopes.includes("money"));
