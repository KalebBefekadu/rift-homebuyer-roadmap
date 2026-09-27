/**
 * A seller's proceeds, from planning to official (S16).
 *
 *   Planning   early: the price discussed and what is owed, often a balance.
 *   Offer      the terms of an offer the seller is weighing.
 *   Revised    after an amendment, a repair credit, or a new payoff.
 *   Official   the settlement statement's own net, with the payoff statement.
 *
 * Every version keeps its own figures and source; each later one says how it
 * differs from the one before. A loan balance is never an official payoff
 * (the database refuses one on an official version), per-diem interest and
 * the closing date move the payoff, and projected proceeds are never spent as
 * certain cash. The costs are lib/core/seller.ts, the same as the public
 * value, so the two cannot disagree about a transfer tax.
 *
 * Pure: no I/O.
 */

import { money } from "./compute";
import { sellerNet } from "./seller";

export type FigureKind = "planning" | "offer" | "revised" | "official";
export const FIGURE_KINDS: FigureKind[] = ["planning", "offer", "revised", "official"];
export const FIGURE_LABEL: Record<FigureKind, string> = {
  planning: "Planning",
  offer: "On an offer",
  revised: "Revised",
  official: "Official, from the settlement statement",
};

export type OwedSource = "balance" | "payoff-statement" | "none";
export const OWED_LABEL: Record<OwedSource, string> = {
  balance: "a loan balance, not a payoff",
  "payoff-statement": "the lender's payoff statement",
  none: "nothing owed",
};

export interface FigureInput {
  kind: FigureKind;
  price: number;
  owed: number;
  owedSource: OwedSource;
  commissionPct: number | null;
  /** Credits the seller agreed: repairs, closing-cost help. */
  credits: number;
  /** Only on the official version: the statement's own net. */
  officialNet: number | null;
  source: string;
  asOf: string;
  note: string | null;
}

export interface Figure extends FigureInput { by: string; at: string }

export interface FigureView extends Figure {
  /** Worked out from the figures, the same way as every estimate. */
  estimate: number;
  /** What the seller should read: the official net when there is one. */
  net: number;
  /** Against the version before it, when there is one. */
  change: number | null;
  lines: { label: string; amount: number }[];
}

/** Why a version may not be recorded, or null. */
export function figureError(f: FigureInput, today: string): string | null {
  if (!["planning", "offer", "revised", "official"].includes(f.kind)) return "Choose which version this is";
  if (!Number.isFinite(f.price) || f.price < 10_000 || f.price > 20_000_000) return "Give the price";
  if (!Number.isFinite(f.owed) || f.owed < 0) return "Give what is owed, or 0";
  if (!["balance", "payoff-statement", "none"].includes(f.owedSource)) return "Say where the amount owed comes from";
  if (f.owedSource === "none" && f.owed > 0) return "Nothing owed means an amount of 0";
  if (f.kind === "official" && f.owedSource === "balance") return "The official version needs the lender's payoff statement, not a balance";
  if (f.commissionPct !== null && (!Number.isFinite(f.commissionPct) || f.commissionPct < 0 || f.commissionPct > 10)) return "Give the commission as agreed, or leave it out";
  if (!Number.isFinite(f.credits) || f.credits < 0) return "Give credits as a positive amount, or 0";
  if (f.kind === "official" && (f.officialNet === null || !Number.isFinite(f.officialNet))) return "Give the net from the settlement statement";
  if (f.kind !== "official" && f.officialNet !== null) return "Only the official version carries the statement's net";
  if (f.source.trim().length < 3) return "Say where these come from";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.asOf) || f.asOf > today) return "Give the day of the source";
  return null;
}

export function viewFigures(list: Figure[]): FigureView[] {
  const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
  let prev: number | null = null;
  return sorted.map((f) => {
    const n = sellerNet({ price: f.price, payoff: f.owed, county: "", commissionPct: f.commissionPct });
    const estimate = n.net - f.credits;
    const net = f.officialNet ?? estimate;
    const view: FigureView = {
      ...f, estimate, net, change: prev === null ? null : net - prev,
      lines: [
        { label: "Sale price", amount: f.price },
        ...(f.owed > 0 ? [{ label: `Owed (${OWED_LABEL[f.owedSource]})`, amount: -f.owed }] : []),
        ...n.costs.lines.map((l) => ({ label: l.label, amount: -l.amount })),
        ...(f.credits > 0 ? [{ label: "Credits you agreed", amount: -f.credits }] : []),
      ],
    };
    prev = net;
    return view;
  });
}

/** One line for the seller about where the figures stand. */
export function proceedsLine(views: FigureView[]): string {
  const last = views.at(-1);
  if (!last) return "No figures recorded yet.";
  const official = last.kind === "official";
  const head = last.net < 0 ? `${money(-last.net)} would have to be brought to closing` : `${official ? "" : "About "}${money(last.net)} to you`;
  const diff = official && Math.abs(last.net - last.estimate) >= 1
    ? ` The statement differs from the estimate on the same figures by ${money(Math.abs(last.net - last.estimate))}; ask about any line you do not recognise.`
    : "";
  const owed = !official && last.owedSource === "balance" ? " What is owed is a loan balance; the payoff statement adds interest to the closing day." : "";
  return `${FIGURE_LABEL[last.kind]}: ${head}.${diff}${owed}`;
}
