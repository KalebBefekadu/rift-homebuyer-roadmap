/**
 * When could I buy, against when they want to (Blueprint v5 §5.2; handoff
 * §4.15; docs/audit/value-depth-2026-10.md §4.4).
 *
 * The timeline value used to give a number of months and the best two of
 * three fixed nudges ($200 more a month, $25,000 less, 2% from the seller).
 * Useful, and blind to the one thing the person had in mind: a date. This
 * adds three things, all computed from the same cash-to-close engine:
 *
 *   - Their date against the computed one. Only when they named one: "just
 *     exploring" is a real answer and gets no comparison (rule 11: "you
 *     said" requires that they said it). A one-month overrun is not a
 *     collision, as the readout's tension already rules.
 *   - For a date they miss, the smallest change on each lever that meets it,
 *     solved exactly rather than stepped: the monthly saving, the price, the
 *     down payment, and help from the seller. Each one on its own; together
 *     they would overshoot, and the page does not add them up.
 *   - The moving target: the same home a little dearer by the time they are
 *     ready, at the shared planning growth rate. Shown beside the headline,
 *     never as it: it is an assumption about the market, not their numbers.
 *
 * Assistance is never a lever here (MONEY-02): it is upside until a lender
 * says yes.
 *
 * Pure: no I/O.
 */

import { ASKS } from "./asks";
import { PRICE_GROWTH_PCT, cashGap, cashToClose, money, type BuyerInputs } from "./compute";

/** The down payments the question offers, so a lever never suggests one it cannot ask. Not 0%:
 *  that is VA and USDA only, and the timeline does not ask the loan. */
export const DOWN_OPTIONS: number[] = (ASKS.downPct.options ?? []).map((o) => Number(o.value)).filter((d) => d > 0).sort((a, b) => a - b);

/**
 * The most a seller may put toward a buyer's costs on the strictest common
 * loan: a conventional loan with under 10% down. FHA allows more; using the
 * lowest keeps the lever true whichever loan they end up with.
 */
export const SELLER_HELP_MAX = 3;

/** How many months out the moving target looks before saying savings never catch up. */
const HORIZON = 600;

export type Target = number | "exploring";

export interface Stated {
  /** What they said, in months. */
  months: number;
  /** What the arithmetic says. Null: nothing set aside each month, so no date. */
  computed: number | null;
  /** Computed minus stated; negative is months to spare. Null with no date. */
  late: number | null;
  onTrack: boolean;
}

export interface Lever {
  id: "saving" | "price" | "down" | "seller";
  label: string;
  detail: string;
  from: number;
  to: number;
}

const floor5k = (n: number) => Math.floor(n / 5_000) * 5_000;

/** Cash to close per dollar of price, and the part that does not scale. */
function cashLine(i: BuyerInputs) {
  const at = (price: number) => cashToClose({ ...i, price }).total;
  const fixed = at(0);
  return { k: (at(1_000_000) - fixed) / 1_000_000, fixed };
}

function meets(i: BuyerInputs, target: number): boolean {
  const g = cashGap(i);
  return g.fullyCovered || (g.monthsToClose !== null && g.monthsToClose <= target);
}

function leversFor(i: BuyerInputs, target: number): Lever[] {
  const out: Lever[] = [];
  const g = cashGap(i);
  const budget = i.monthlySaving * target;

  /* ceil(gap / saving) <= target exactly when saving >= gap / target. */
  const saving = Math.ceil(g.gap / target / 10) * 10;
  out.push({
    id: "saving", from: i.monthlySaving, to: saving,
    label: `Set aside ${money(saving)} a month`,
    detail: i.monthlySaving > 0 ? `${money(saving - i.monthlySaving)} a month more than now.` : "Any amount gives you a date; this one gives you yours.",
  });

  /* The cash a price needs is linear in it, so the price that fits the
     savings plus what they can put aside by then is exact. */
  const { k, fixed } = cashLine(i);
  const price = floor5k((i.savings + budget - fixed) / k);
  if (price > 0 && price < i.price) {
    out.push({
      id: "price", from: i.price, to: price,
      label: `Look at ${money(price)} instead`,
      detail: `${money(i.price - price)} less, which lowers the down payment, closing costs and escrow together.`,
    });
  }

  /* The down payment closest to theirs that still meets the date. Less down
     is less cash now and more every month, and the detail says so. */
  const down = DOWN_OPTIONS.filter((d) => d < i.downPct).reverse().find((d) => meets({ ...i, downPct: d }, target));
  if (down !== undefined) {
    out.push({
      id: "down", from: i.downPct, to: down,
      label: `Put ${down}% down instead of ${i.downPct}%`,
      detail: down < 20 ? "Less cash now, but a larger loan, a higher monthly payment, and mortgage insurance until you reach 20% equity." : "Less cash now, but a larger loan and a higher monthly payment.",
    });
  }

  /* Seller help comes off the closing costs; in half points, up to the
     strictest common limit, and never more than the closing costs are. */
  const short = cashToClose(i).total - i.savings - budget;
  const help = Math.ceil(((short / i.price) * 100) / 0.5) * 0.5;
  if (help > 0 && help <= Math.min(SELLER_HELP_MAX, i.closingPct)) {
    out.push({
      id: "seller", from: 0, to: help,
      label: `Ask the seller for ${help}% toward your costs`,
      detail: `${money((i.price * help) / 100)} off your cash to close. What a seller may pay depends on the loan; ${SELLER_HELP_MAX}% is the lowest common limit, and asking costs nothing.`,
    });
  }
  return out;
}

/**
 * The months it takes when the price keeps rising while they save. Null when
 * there is nothing to wait for, or nothing being saved. `outpaced` when their
 * saving never catches the price within fifty years: said, not hidden.
 */
function movingTarget(i: BuyerInputs, growthPct: number): { months: number; price: number } | { outpaced: true } | null {
  const g = cashGap(i);
  if (g.fullyCovered || !(i.monthlySaving > 0)) return null;
  for (let m = 1; m <= HORIZON; m++) {
    const price = i.price * Math.pow(1 + growthPct / 100, m / 12);
    if (cashToClose({ ...i, price }).total - i.savings <= i.monthlySaving * m) return { months: m, price: Math.round(price) };
  }
  return { outpaced: true };
}

export function timelinePlan(i: BuyerInputs, target: Target, growthPct = PRICE_GROWTH_PCT) {
  const g = cashGap(i);
  const computed = g.fullyCovered ? 0 : g.monthsToClose;
  const stated: Stated | null = target === "exploring" ? null : {
    months: target,
    computed,
    late: computed === null ? null : computed - target,
    onTrack: computed !== null && computed <= target + 1,
  };
  const moving = movingTarget(i, growthPct);
  return {
    gap: g,
    stated,
    /** The smallest change on each lever that meets their date; empty unless they miss it. */
    forTarget: stated && !stated.onTrack ? leversFor(i, stated.months) : [],
    moving: moving && "months" in moving ? moving : null,
    outpaced: moving !== null && "outpaced" in moving,
    growthPct,
  };
}
