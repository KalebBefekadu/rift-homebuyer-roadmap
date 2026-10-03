/**
 * Comparing offers by what actually reaches the seller.
 *
 * Pure. The whole point of this file is one sentence: THE HIGHEST OFFER IS
 * OFTEN NOT THE BEST ONE, and a seller cannot see that from a stack of PDFs.
 *
 * It is the same argument the rest of the product makes. A list price is not
 * what reaches you; a headline offer is not either. Concessions, a rate buy-
 * down, a repair credit and who pays closing costs all come out of the same
 * number, and the offer that looked $8,000 higher can arrive $3,000 lower.
 *
 * What this file does NOT do is decide. Risk is not a number: a cash offer
 * closing in fourteen days and a financed one closing in forty-five are not
 * comparable on a single axis, and a product that collapses them into a score
 * has made somebody's decision for them while pretending to inform it. So the
 * money is computed and ranked, and everything else is listed beside it,
 * unweighted, for a human to weigh.
 */

import { GA_TRANSFER_TAX_RATE } from "./compute";
import { PAYOFF_FEES, SELLER_SETTLEMENT, proratedTax } from "./seller";

export type Financing = "cash" | "conventional" | "fha" | "va" | "usda" | "other";

export const FINANCING_LABEL: Record<Financing, string> = {
  cash: "Cash",
  conventional: "Conventional",
  fha: "FHA",
  va: "VA",
  usda: "USDA",
  other: "Other",
};

export interface Offer {
  id: string;
  /** Who made it, as the seller would say it. */
  from: string;
  price: number;
  /** Money the seller is asked to give back. Concessions, credits, buy-downs. */
  concessions: number;
  /** Repairs the buyer wants done or credited before closing. */
  repairCredit: number;
  financing: Financing;
  /** Earnest money. Not netted: it is applied at closing, not extra. */
  earnest: number;
  /** ISO date. */
  closeOn: string | null;
  /** What has to happen before it becomes binding. Listed, never scored. */
  contingencies: string[];
  /** Whether the buyer supplied proof they can pay. */
  preapproval: boolean;
  proofOfFunds: boolean;
  /** Free text from the agent, shown to the seller when released. */
  note: string | null;
  /** Nothing reaches the seller until this is set. */
  releasedAt: string | null;
  createdAt: string;
}

/** The seller's fixed costs, which do not vary between offers. */
export interface SellerCosts {
  payoff: number;
  commissionPct: number;
}

export interface OfferNet {
  offerId: string;
  /** Costs that scale with the accepted price. */
  commission: number;
  transferTax: number;
  /** Everything the buyer is asking the seller to pay or give back. */
  askedBack: number;
  /** What actually reaches the seller. */
  net: number;
  /** Net minus the best net. Zero for the winner, negative for the rest. */
  behindBy: number;
  /** Headline price minus net, i.e. what the number on the front page hides. */
  hiddenFromHeadline: number;
}

/* The seller's costs that do not depend on an offer's terms, from the same
   rules as the seller's own net (lib/core/seller.ts, the /sell/proceeds value
   and the journey's proceeds), so the offer table and the seller's figures
   cannot quote different closing costs for the same house. It was a flat
   copy here, with a flat property-tax share, and drifted from the seller
   rules once they worked the tax out from the price (found 28 Sep 2026). */
export const fixedSellerCosts = (price: number, payoff: number) =>
  SELLER_SETTLEMENT + proratedTax(price) + (payoff > 0 ? PAYOFF_FEES : 0);

export function netOf(offer: Offer, costs: SellerCosts): Omit<OfferNet, "behindBy"> {
  const commission = (offer.price * costs.commissionPct) / 100;
  const transferTax = offer.price * GA_TRANSFER_TAX_RATE;
  const askedBack = offer.concessions + offer.repairCredit;

  const net = offer.price - costs.payoff - commission - transferTax - askedBack - fixedSellerCosts(offer.price, costs.payoff);

  return {
    offerId: offer.id,
    commission,
    transferTax,
    askedBack,
    net,
    hiddenFromHeadline: offer.price - net,
  };
}

/**
 * Every offer, ranked by what reaches the seller.
 *
 * Ties keep their input order rather than being broken by price: a tie on net
 * is a genuine tie, and quietly ranking one above the other on a number that
 * does not reach them is the exact substitution this file exists to expose.
 */
export function rankOffers(offers: Offer[], costs: SellerCosts): OfferNet[] {
  const nets = offers.map((o) => netOf(o, costs));
  if (nets.length === 0) return [];

  const best = Math.max(...nets.map((n) => n.net));
  return nets
    .map((n) => ({ ...n, behindBy: n.net - best }))
    .sort((a, b) => b.net - a.net);
}

/**
 * The offer with the highest price. When several share it, the one that
 * leaves the seller most (when their costs are known), then the first given.
 *
 * Which of two equal prices counted as "the highest" used to depend on the
 * order they were entered, so the trap below could tell a seller that the
 * better of two $400,000 offers "offered less".
 */
export function highestPriced(offers: Offer[], costs: SellerCosts | null): Offer | null {
  if (offers.length === 0) return null;
  const top = Math.max(...offers.map((o) => o.price));
  const tied = offers.filter((o) => o.price === top);
  if (!costs || tied.length === 1) return tied[0]!;
  return tied.reduce((best, o) => (netOf(o, costs).net > netOf(best, costs).net ? o : best));
}

/**
 * Whether the highest-priced offer is also the one that nets most.
 *
 * Returns null when they agree, or when there is nothing to compare. When they
 * disagree, this is the single most useful sentence the product can say to a
 * seller, so it is computed rather than left for somebody to notice.
 */
export function headlineTrap(offers: Offer[], costs: SellerCosts): {
  highest: Offer; bestNet: Offer; difference: number;
} | null {
  if (offers.length < 2) return null;

  const ranked = rankOffers(offers, costs);
  const byId = new Map(offers.map((o) => [o.id, o]));

  const bestNet = byId.get(ranked[0]!.offerId)!;
  const highest = highestPriced(offers, costs)!;
  if (highest.id === bestNet.id) return null;

  const highestNet = ranked.find((n) => n.offerId === highest.id)!;
  const difference = ranked[0]!.net - highestNet.net;
  /* A tie on net is a tie, not a trap: "would leave you about $0 more" is a
     sentence about nothing, and the lower offer does not leave them more.
     Rounded to the dollar the seller reads it in, so floating-point dust
     from the percentage lines cannot manufacture a difference either. */
  if (Math.round(difference) <= 0) return null;
  return { highest, bestNet, difference };
}

/**
 * What is missing from an offer, in plain terms.
 *
 * Facts about the paperwork, not judgements about the buyer. "No proof of
 * funds attached" is checkable; "risky buyer" is an opinion this product has
 * no standing to hold, and dressing one as the other is how a seller ends up
 * declining a good offer because software implied something.
 */
export function gapsIn(offer: Offer): string[] {
  const gaps: string[] = [];

  if (offer.financing === "cash") {
    if (!offer.proofOfFunds) gaps.push("No proof of funds attached to a cash offer");
  } else if (!offer.preapproval) {
    gaps.push("No preapproval letter attached");
  }

  if (!offer.closeOn) gaps.push("No closing date named");
  if (offer.earnest <= 0) gaps.push("No earnest money stated");

  return gaps;
}

/** Whether anything here has reached the seller yet. */
export const anyReleased = (offers: Offer[]) => offers.some((o) => o.releasedAt);

/**
 * What a person reads for a stored financing code. The code ("fha", "va") is
 * a database value, not a word: it was printed raw on the Offers page.
 * "Other" says what the sender said it was.
 */
export function financingLabel(code: string, other: string | null = null): string {
  if (code === "other") return other?.trim() ? `Other: ${other.trim()}` : "Other";
  return FINANCING_LABEL[code as Financing] ?? code;
}
