/**
 * Money v2: the buyer's ledger (Blueprint v5 §10.1, MONEY-01, MONEY-03,
 * AT30 to AT33).
 *
 * Five figures, each with one meaning, so nothing is paid twice and nothing
 * is called settlement money that is not:
 *
 *   Needed before closing   earnest money, inspection and appraisal: paid
 *                           while under contract, before the closing table.
 *   At the closing table    down payment, closing costs and prepaids, less
 *                           the earnest money credited back, seller credits
 *                           and assistance that is approved. Negative means
 *                           money back at closing, and says so.
 *   Total buying budget     the two above together. Earnest money is timing,
 *                           not a second cost: it is paid before closing and
 *                           credited at it, so it counts once (AT30).
 *   Left at closing         savings less the two above. Negative is a
 *                           shortfall, never shown as zero.
 *   Suggested reserve       two months of the full monthly payment, kept
 *                           back after closing. A planning suggestion, never
 *                           part of the budget and never called settlement
 *                           money (AT31).
 *
 * Moving is not paid at closing (Kaleb, R1), so it is outside every bucket;
 * when known it is listed beside them.
 *
 * Each input says where it came from: Rift's estimate, the buyer's answer,
 * or a figure the agent recorded from a named source. The official cash to
 * close, from the closing disclosure, is its own figure with its own label
 * and never replaces or shares a label with the estimate (MONEY-01).
 * Assistance counts only once approved by a named party (MONEY-02, AT32).
 *
 * A ledger carries LEDGER_VERSION. A snapshot made under an earlier version
 * keeps its own labels and meaning; nothing re-renders it under this one
 * (AT33).
 *
 * Pure: no I/O. Figures in dollars; the stored facts are cents.
 */

import { BUYER_DEFAULTS, cashToClose, monthlyCost, money, type BuyerInputs } from "./compute";

export const LEDGER_VERSION = 2;

/** Months of the full monthly payment suggested as a reserve after closing. */
export const RESERVE_MONTHS = 2;

export type Provenance = "estimate" | "answer" | "recorded";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  estimate: "Rift's estimate",
  answer: "Your answer",
  recorded: "Recorded by your agent",
};

/** What the agent can record against a journey, each from a named source. */
export type FactKind =
  | "price" | "earnest" | "inspection" | "appraisal" | "closing-costs" | "prepaids"
  | "seller-credit" | "assistance-approved" | "moving" | "official-cash-to-close";

export const FACT_LABEL: Record<FactKind, string> = {
  price: "Contract price",
  earnest: "Earnest money",
  inspection: "Inspection",
  appraisal: "Appraisal",
  "closing-costs": "Closing costs (lender's estimate)",
  prepaids: "Prepaids and escrow",
  "seller-credit": "Seller credit toward costs",
  "assistance-approved": "Assistance approved",
  moving: "Moving",
  "official-cash-to-close": "Cash to close on the closing disclosure",
};

export const FACT_KINDS = Object.keys(FACT_LABEL) as FactKind[];

export interface Fact {
  kind: FactKind;
  /** Dollars, never negative: a credit is a credit because of its kind. */
  amount: number;
  /** Who or what it came from: "Loan Estimate from Peach Mortgage, 22 Sep". */
  source: string;
  /** The day the source gave it, YYYY-MM-DD. */
  asOf: string;
  by: string;
  at: string;
}

/** The latest recorded fact of each kind. */
export function currentFacts(history: Fact[]): Partial<Record<FactKind, Fact>> {
  const out: Partial<Record<FactKind, Fact>> = {};
  for (const f of [...history].sort((a, b) => a.at.localeCompare(b.at))) out[f.kind] = f;
  return out;
}

/** Why a fact may not be recorded, or null. */
export function factError(input: { kind: string; amount: number; source: string; asOf: string }, today: string): string | null {
  if (!FACT_KINDS.includes(input.kind as FactKind)) return "Choose what this amount is";
  if (!Number.isFinite(input.amount) || input.amount < 0) return "Give the amount as a positive number";
  if (input.amount > 20_000_000) return "That amount is too large to be right";
  const src = input.source.trim();
  if (src.length < 3) return "Say where it comes from, like \"Loan Estimate from Peach Mortgage\"";
  if (src.length > 160) return "Keep the source under 160 characters";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOf) || Number.isNaN(Date.parse(input.asOf))) return "Give the day the source gave it";
  if (input.asOf > today) return "The day cannot be in the future";
  return null;
}

export interface LedgerLine {
  label: string;
  amount: number;
  provenance: Provenance;
  /** The source, for a recorded figure. */
  source: string | null;
  /** Subtracted within its bucket. */
  credit?: boolean;
  note?: string;
}

export interface Bucket {
  key: "before" | "table" | "total" | "left" | "reserve";
  label: string;
  amount: number;
  lines: LedgerLine[];
  /** Plain words for what the figure means, including a negative one. */
  says: string;
}

export interface Ledger {
  version: typeof LEDGER_VERSION;
  before: Bucket;
  table: Bucket;
  total: Bucket;
  left: Bucket;
  reserve: Bucket;
  moving: LedgerLine | null;
  /** From the closing document, when recorded. Never mixed with the estimate. */
  official: { amount: number; source: string; asOf: string; difference: number } | null;
  /** How many inputs are still Rift's estimate rather than an answer or a record. */
  estimated: number;
  couldBeWrong: string;
}

const line = (label: string, amount: number, provenance: Provenance, source: string | null, extra: Partial<LedgerLine> = {}): LedgerLine =>
  ({ label, amount, provenance, source, ...extra });

/**
 * The ledger for one buyer. `inputs` are the buyer's answers over the
 * defaults; `answered` says which of them the buyer actually gave; `facts`
 * are what the agent recorded, which win over both.
 */
export function ledger(inputs: BuyerInputs, answered: { price: boolean; downPct: boolean; savings: boolean }, facts: Partial<Record<FactKind, Fact>> = {}): Ledger {
  const f = (k: FactKind) => facts[k] ?? null;
  const price = f("price")?.amount ?? inputs.price;
  const i = { ...inputs, price };
  const est = cashToClose(i);
  const estOf = (label: string) => est.lines.find((l) => l.label === label)!.amount;
  const from = (k: FactKind, label: string, fallback: number, answeredToo = false) => {
    const fact = f(k);
    return fact
      ? line(label, fact.amount, "recorded", fact.source)
      : line(label, fallback, answeredToo ? "answer" : "estimate", null);
  };

  const earnest = from("earnest", "Earnest money", est.earnest);
  const before = [
    { ...earnest, note: "A deposit: credited back at the closing table" },
    from("inspection", "Inspection", estOf("Inspection")),
    from("appraisal", "Appraisal", estOf("Appraisal")),
  ];
  const beforeTotal = before.reduce((s, l) => s + l.amount, 0);

  /* The down payment follows its percentage, answered or not, on the price:
     recorded from the contract when there is one. */
  const down = f("price")
    ? line("Down payment", (price * i.downPct) / 100, "recorded", f("price")!.source, { note: `${i.downPct}% of the contract price, ${money(price)}` })
    : line("Down payment", (price * i.downPct) / 100, answered.downPct && answered.price ? "answer" : "estimate", null, { note: `${i.downPct}% of ${money(price)}` });
  const credits: LedgerLine[] = [line("Earnest money credited back", earnest.amount, earnest.provenance, earnest.source, { credit: true })];
  if (f("seller-credit")) credits.push(line("Seller credit", f("seller-credit")!.amount, "recorded", f("seller-credit")!.source, { credit: true }));
  /* Assistance only once approved, by the record of it (MONEY-02, AT32). */
  if (f("assistance-approved")) credits.push(line("Assistance approved", f("assistance-approved")!.amount, "recorded", f("assistance-approved")!.source, { credit: true }));
  const table = [
    down,
    from("closing-costs", "Closing costs", estOf("Closing costs")),
    from("prepaids", "Prepaids and escrow", estOf("Prepaids and escrow")),
    ...credits,
  ];
  const tableTotal = table.reduce((s, l) => s + (l.credit ? -l.amount : l.amount), 0);

  const total = beforeTotal + tableTotal;
  const savings = line("Savings", inputs.savings, answered.savings ? "answer" : "estimate", null);
  const left = savings.amount - total;
  const monthly = monthlyCost(i).total;
  const reserve = monthly * RESERVE_MONTHS;
  const official = f("official-cash-to-close");

  const lines = [...before, ...table, savings];
  return {
    version: LEDGER_VERSION,
    before: { key: "before", label: "Needed before closing", amount: beforeTotal, lines: before, says: "Paid while under contract, before the closing table." },
    table: {
      key: "table", label: "At the closing table", amount: tableTotal, lines: table,
      says: tableTotal < 0 ? `Money back at closing: about ${money(-tableTotal)}.` : "Brought to closing, after the earnest money and any credits.",
    },
    total: { key: "total", label: "Total buying budget", amount: total, lines: [], says: "Before closing and at the table together. Earnest money counts once." },
    left: {
      key: "left", label: "Left at closing", amount: left, lines: [savings],
      says: left < 0 ? `Short by about ${money(-left)}: this has to be found before closing.` : "What your savings leave after closing, before any reserve.",
    },
    reserve: {
      key: "reserve", label: "Suggested reserve", amount: reserve, lines: [],
      says: `${RESERVE_MONTHS} months of the full monthly payment (${money(monthly)}), kept after closing. A suggestion, not part of the budget.`,
    },
    moving: f("moving") ? line("Moving", f("moving")!.amount, "recorded", f("moving")!.source, { note: "Not paid at closing, so outside every figure above" }) : null,
    official: official ? { amount: official.amount, source: official.source, asOf: official.asOf, difference: official.amount - tableTotal } : null,
    estimated: lines.filter((l) => l.provenance === "estimate").length,
    couldBeWrong:
      "Estimates move with the lender, the attorney, the loan and the closing date, and a seller may agree to pay part of the costs. The closing disclosure is the authority for what is brought to closing; until it is recorded, every figure here is a plan.",
  };
}

/**
 * A buyer's inputs from their saved answers, over the defaults, and which
 * of them they actually gave. Assistance is always 0 here: it enters the
 * ledger only as an approved, recorded fact.
 */
export function planInputs(answers: Record<string, unknown> | null, ratePct: number): { inputs: BuyerInputs; answered: { price: boolean; downPct: boolean; savings: boolean } } {
  const a = answers ?? {};
  const num = (k: string) => {
    const n = Number(a[k]);
    return a[k] !== undefined && a[k] !== null && a[k] !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const price = num("price");
  const downPct = num("downPct");
  const savings = num("savings");
  const monthlySaving = num("monthlySaving");
  return {
    inputs: {
      ...BUYER_DEFAULTS,
      ratePct,
      price: price && price > 0 ? price : BUYER_DEFAULTS.price,
      downPct: downPct ?? BUYER_DEFAULTS.downPct,
      savings: savings ?? BUYER_DEFAULTS.savings,
      monthlySaving: monthlySaving ?? BUYER_DEFAULTS.monthlySaving,
      county: typeof a.county === "string" && a.county ? a.county : BUYER_DEFAULTS.county,
      assistance: 0,
    },
    answered: { price: Boolean(price && price > 0), downPct: downPct !== null, savings: savings !== null },
  };
}
