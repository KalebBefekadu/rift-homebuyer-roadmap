/**
 * The seller values (Blueprint v5 §5.3, D20): what you would keep, what
 * selling costs, and what to fix first.
 *
 * MONEY-06 is the contract. Net is the price minus the loan payoff and the
 * costs that are paid out of the sale, each counted once:
 *
 *   - Commission is the seller's own number, never a "standard rate". Not
 *     agreed yet is a real answer: the net is then shown before commission,
 *     with what each percent costs beside it, rather than a figure built on a
 *     rate we chose for them.
 *   - Moving is not paid at closing, so it is not a cost of the sale (the
 *     same correction Kaleb made on the buyer side, R1).
 *   - Concessions are what a buyer may ask for, not a cost until agreed; they
 *     are shown as "if a buyer asks for 1%", never subtracted.
 *   - A negative net is a shortfall to resolve before listing, and is said
 *     in those words.
 *   - No valuation, equity estimate or repair return is generated. The
 *     preparation list says what is worth addressing and why, with no dollar
 *     payback, because nothing here could know it.
 *
 * Pure: no React, no I/O.
 */

import { BUYER_DEFAULTS, GA_TRANSFER_TAX_RATE, money, pct, type Assumption } from "./compute";

export interface SaleInputs {
  price: number;
  payoff: number;
  county: string;
  /** Total commission, as agreed. Null: not agreed yet. */
  commissionPct: number | null;
}

export interface SaleLine {
  label: string;
  /** For the drawing, where a long label would run off the edge. */
  short: string;
  amount: number;
  note: string;
}

/** Closing attorney, deed preparation and recording: a planning figure. */
export const SELLER_SETTLEMENT = 850;
/** The lender's payoff statement, the wire and the courier. */
export const PAYOFF_FEES = 375;

/**
 * The seller's share of the year's property tax. Georgia bills in arrears, so
 * the seller credits the buyer for the part of the year they owned. Half a
 * year at the same rate the buyer values use, because the closing date is not
 * known; the note says so.
 */
export const proratedTax = (price: number) => Math.round((price * BUYER_DEFAULTS.taxPct) / 100 / 2);

export function saleCosts(i: SaleInputs) {
  const lines: SaleLine[] = [];
  if (i.commissionPct !== null) {
    lines.push({ label: "Commission", short: "Commission", amount: Math.round((i.price * i.commissionPct) / 100), note: `${pct(i.commissionPct)} in total, as you agree it. Negotiable, and never a set rate` });
  }
  lines.push(
    { label: "Georgia transfer tax", short: "Transfer tax", amount: Math.round(i.price * GA_TRANSFER_TAX_RATE), note: "$1.00 per $1,000 of the sale price, set by the state" },
    { label: "Closing attorney and recording", short: "Attorney", amount: SELLER_SETTLEMENT, note: "Deed preparation, the attorney's fee and county recording. A planning figure" },
    { label: "Your share of this year's property tax", short: "Property tax", amount: proratedTax(i.price), note: `About half a year at ${pct(BUYER_DEFAULTS.taxPct)} of value; the real figure depends on the closing date` },
  );
  if (i.payoff > 0) lines.push({ label: "Payoff statement and wire fees", short: "Payoff fees", amount: PAYOFF_FEES, note: "Charged by your lender and the closing attorney to pay the loan off" });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return {
    lines,
    total,
    commissionKnown: i.commissionPct !== null,
    /** What each percent of commission is on this price. */
    perPoint: Math.round(i.price / 100),
  };
}

export function sellerNet(i: SaleInputs) {
  const costs = saleCosts(i);
  const net = i.price - i.payoff - costs.total;
  return {
    costs,
    net,
    /** How much would have to be brought to closing. Zero when there is money left. */
    shortfall: net < 0 ? -net : 0,
    /** What a 1% concession would cost, if a buyer asks for one. Never subtracted. */
    concessionPerPoint: Math.round(i.price / 100),
    assumptions: [
      { label: "Sale price", value: money(i.price) },
      { label: "Still owed", value: i.payoff > 0 ? money(i.payoff) : "Nothing" },
      { label: "Commission", value: i.commissionPct === null ? "Not agreed yet, so not included" : pct(i.commissionPct) },
      { label: "Transfer tax", value: "$1.00 per $1,000 of price (Georgia)" },
      { label: "Attorney and recording", value: money(SELLER_SETTLEMENT) },
      { label: "Property tax share", value: `Half a year at ${pct(BUYER_DEFAULTS.taxPct)} of value` },
      { label: "Not included", value: "Moving, and anything a buyer asks for until you agree it" },
    ] as Assumption[],
    couldBeWrong:
      "The payoff changes every day with interest and is only exact on your lender's payoff statement. Commission is whatever you agree. The property tax share depends on the closing date and your exemptions. A buyer may ask for repairs or help with their costs after the inspection, and anything you agree to comes out of this figure.",
  };
}

/* ------------------------------------------------------------------ *
 * Preparation
 * ------------------------------------------------------------------ */

export type Roof = "under10" | "10to20" | "over20" | "unsure";
export type Systems = "working" | "broken" | "unsure";
export type Finish = "fresh" | "lived" | "worn";

export interface PrepItem {
  item: string;
  why: string;
}

export interface PrepPlan {
  address: PrepItem[];
  maybe: PrepItem[];
  notYet: PrepItem[];
}

/**
 * What is worth addressing before listing, what maybe, and what not yet.
 *
 * Ordered by what a buyer's inspector or lender will find, then by what a
 * buyer sees first. No costs and no returns: the same repair can pay for
 * itself on one street and not the next, and the honest version of that
 * figure is Kaleb looking at the house.
 */
export function preparePlan(p: { roof: Roof; systems: Systems; finish: Finish }): PrepPlan {
  const address: PrepItem[] = [];
  const maybe: PrepItem[] = [];
  const notYet: PrepItem[] = [];

  if (p.systems === "broken") {
    address.push({ item: "Whatever is not working: heating, cooling, plumbing, electrical or the water heater", why: "An inspector will find it, and a buyer's lender may require it fixed before closing. Fixing it on your own schedule avoids negotiating it under the buyer's deadline." });
  } else if (p.systems === "unsure") {
    maybe.push({ item: "A pre-listing check of the heating, cooling, plumbing and electrical", why: "Knowing now lets you fix it, price for it or disclose it, instead of finding out from the buyer's inspector." });
  }

  if (p.roof === "over20") {
    maybe.push({ item: "A roof inspection before you list", why: "Buyers and insurers ask about roofs over 20 years old. A report lets you choose between repairing, replacing or offering a credit." });
  } else if (p.roof === "unsure") {
    maybe.push({ item: "Find out how old the roof is", why: "It is one of the first questions a buyer's agent and insurer ask. The permit history or the last invoice usually says." });
  }

  address.push({ item: "A deep clean, and clearing surfaces and closets", why: "It costs little, and it is the first thing every buyer and every photograph notices." });
  address.push({ item: "Small repairs: dripping taps, loose handles, burnt-out bulbs, sticking doors", why: "Each is minor; together they tell a buyer the house was not looked after." });

  if (p.finish === "worn") {
    address.push({ item: "Paint in the main rooms, in a neutral colour", why: "Worn or strongly coloured walls are easy for a buyer to notice and simple to put right." });
    maybe.push({ item: "Flooring that is damaged or stained", why: "Worth replacing where it is damaged; where it is only dated, a buyer often prefers to choose their own." });
  } else if (p.finish === "lived") {
    maybe.push({ item: "Touch-up paint where walls are marked", why: "Touch-ups are usually enough; a full repaint is for walls that are worn or a strong colour." });
  }

  maybe.push({ item: "The front entry and garden", why: "Buyers form a view before they reach the door, and so do the listing photographs." });

  notYet.push({ item: "Kitchen or bathroom renovations", why: "They take weeks, many buyers want to choose their own, and whether one would pay for itself depends on the street. Ask Kaleb before spending on either." });
  if (p.roof !== "over20") notYet.push({ item: "Replacing a roof that is not leaking", why: "A working roof is priced in; a report or a credit is usually the better conversation." });

  return { address, maybe, notYet };
}
