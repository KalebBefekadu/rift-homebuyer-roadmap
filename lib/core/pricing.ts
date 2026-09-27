/**
 * Pricing strategy for a sale (S04). The agent chooses the comparables and
 * approves a value opinion; the seller chooses whether to launch at it.
 *
 * Nothing here predicts a sale price, adjusts a comparable by formula, or
 * promises how long it will take to sell. The range is the agent's, the
 * comparables are the ones the agent chose and says why, and commission and
 * costs are explicit inputs to the scenarios, never a "standard rate".
 *
 * Pure: no I/O.
 */

import { money } from "./compute";
import { sellerNet } from "./seller";

export type CompStatus = "sold" | "pending" | "active";
export const COMP_STATUS_LABEL: Record<CompStatus, string> = { sold: "Sold", pending: "Under contract", active: "For sale now" };

export interface Comp {
  address: string;
  price: number;
  status: CompStatus;
  /** Sold or listed on, YYYY-MM-DD. */
  on: string;
  /** Why it is comparable, and how it differs. */
  note: string;
}

export interface PricingInput {
  listPrice: number;
  low: number;
  high: number;
  comps: Comp[];
  rationale: string;
  reviewOn: string;
}

export interface Opinion extends PricingInput {
  id: string;
  version: number;
  by: string;
  at: string;
  responses: { memberId: string; name: string; response: "agree" | "discuss"; note: string | null; at: string }[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Why an opinion may not be recorded, or null. */
export function pricingError(p: PricingInput, today: string): string | null {
  const ok = (n: number) => Number.isFinite(n) && n >= 10_000 && n <= 20_000_000;
  if (!ok(p.listPrice)) return "Give the list price";
  if (!ok(p.low) || !ok(p.high)) return "Give the low and high ends of your range";
  if (!(p.low <= p.listPrice && p.listPrice <= p.high)) return "The list price has to sit inside your range";
  if (!p.comps.length) return "Add at least one comparable you chose";
  if (p.comps.length > 12) return "Twelve comparables at most";
  for (const c of p.comps) {
    if (c.address.trim().length < 5) return "Give each comparable's address";
    if (!ok(c.price)) return `Give the price for ${c.address.trim() || "each comparable"}`;
    if (!["sold", "pending", "active"].includes(c.status)) return "Say whether each comparable sold, is under contract or is for sale";
    if (!DAY.test(c.on) || c.on > today) return `Give the day ${c.address.trim()} ${c.status === "sold" ? "sold" : "was listed"}`;
    if (c.note.trim().length < 3) return `Say why ${c.address.trim()} is comparable`;
  }
  if (p.rationale.trim().length < 10) return "Say why this price, in a sentence or two";
  if (p.rationale.trim().length > 1500) return "Keep the reasoning under 1,500 characters";
  if (!DAY.test(p.reviewOn) || p.reviewOn < today) return "Choose the day you will review it with them";
  return null;
}

/**
 * The seller's net at the low end, the list price and the high end, on the
 * terms recorded for them. Tradeoffs, not predictions: the page says the
 * market decides the price.
 */
export function scenarios(p: Pick<PricingInput, "low" | "listPrice" | "high">, terms: { owed: number; commissionPct: number | null; credits: number }) {
  return (["low", "listPrice", "high"] as const).map((k) => {
    const price = p[k];
    const n = sellerNet({ price, payoff: terms.owed, county: "", commissionPct: terms.commissionPct });
    const net = n.net - terms.credits;
    return {
      label: k === "low" ? "Low end" : k === "high" ? "High end" : "List price",
      price,
      net,
      text: net < 0 ? `${money(-net)} short at closing` : `About ${money(net)} to you`,
    };
  });
}

/** Where the seller stands on the latest version. */
export function responseLine(o: Opinion): string {
  if (!o.responses.length) return "Nobody in the household has answered this version yet.";
  return o.responses.map((r) => `${r.name} ${r.response === "agree" ? "agreed to launch at it" : "wants to talk first"}${r.note ? `: "${r.note}"` : ""}`).join("; ");
}
