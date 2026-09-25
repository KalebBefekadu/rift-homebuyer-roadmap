/**
 * Value: how much home fits me? (Blueprint v5 §5.2, MONEY-05). Pure.
 *
 * MONEY-05: "A comfort range is a planning scenario, never a lending
 * decision. An affordability solver needs its own bounds, tests and
 * disclosures before release." So:
 *
 *   * Two scenarios, named for what they are. COMFORTABLE keeps housing at
 *     or under 28% of gross monthly income and all debts at or under 36%;
 *     STRETCH lets all debts reach 43%. These are the common guideline
 *     ratios, not any lender's rule: lenders set their own, and FHA can go
 *     higher. The page says so beside the figure.
 *   * The price is solved against monthlyCost(), the engine the monthly-cost
 *     value uses, at the recorded rate, so the two values cannot disagree
 *     about what a price costs each month.
 *   * Bounded: nothing above $5,000,000, nothing below zero, and when debts
 *     already use up a scenario's share, the answer is "no price", said, not
 *     a small invented one.
 *   * Cash is not considered: a price that fits the monthly budget may still
 *     need more cash than they have. The page sends them to cash to close.
 */

import { BUYER_DEFAULTS, monthlyCost, money, pct, type Assumption, type BuyerInputs } from "./compute";

export const RATIOS = { comfortHousing: 28, comfortTotal: 36, stretchTotal: 43 } as const;
export const AFFORD_MAX_PRICE = 5_000_000;

export interface AffordInputs { income: number; debts: number; downPct: number; ratePct: number }

export interface Scenario {
  /** The most a month's housing may cost in this scenario, or 0 when nothing fits. */
  monthly: number;
  /** The price whose all-in monthly cost is that, or null when no price fits. */
  price: number | null;
}

/** The highest price whose monthly cost stays at or under `target`. */
export function priceForMonthly(target: number, base: Pick<BuyerInputs, "downPct" | "ratePct">): number | null {
  const at = (price: number) => monthlyCost({ ...BUYER_DEFAULTS, ...base, price, hoaMo: 0 }).total;
  /* Insurance is owed on any house, so a target below it buys nothing. */
  if (target <= at(0)) return null;
  if (at(AFFORD_MAX_PRICE) <= target) return AFFORD_MAX_PRICE;
  let lo = 0, hi = AFFORD_MAX_PRICE;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (at(mid) <= target) lo = mid; else hi = mid;
  }
  /* Rounded down to $1,000: rounding up would cross the budget. */
  return Math.floor(lo / 1_000) * 1_000;
}

export function affordability(i: AffordInputs) {
  const gross = Math.max(i.income, 0) / 12;
  const debts = Math.max(i.debts, 0);
  const comfortMonthly = Math.max(0, Math.min((gross * RATIOS.comfortHousing) / 100, (gross * RATIOS.comfortTotal) / 100 - debts));
  const stretchMonthly = Math.max(0, (gross * RATIOS.stretchTotal) / 100 - debts);
  const base = { downPct: i.downPct, ratePct: i.ratePct };
  const comfortable: Scenario = { monthly: comfortMonthly, price: comfortMonthly > 0 ? priceForMonthly(comfortMonthly, base) : null };
  const stretch: Scenario = { monthly: stretchMonthly, price: stretchMonthly > 0 ? priceForMonthly(stretchMonthly, base) : null };

  const assumptions: Assumption[] = [
    { label: "Household income", value: `${money(i.income)} a year before tax (${money(gross)} a month)` },
    { label: "Monthly debts", value: debts > 0 ? money(debts) : "None" },
    { label: "Comfortable", value: `Housing at most ${RATIOS.comfortHousing}% of income, all debts at most ${RATIOS.comfortTotal}%` },
    { label: "Stretch", value: `All debts at most ${RATIOS.stretchTotal}% of income` },
    { label: "Down payment", value: pct(i.downPct) },
    { label: "Rate", value: pct(i.ratePct, 2) },
    { label: "Tax, insurance, mortgage insurance", value: `${pct(BUYER_DEFAULTS.taxPct)} of price a year, ${money(BUYER_DEFAULTS.insuranceYr)} a year, ${pct(BUYER_DEFAULTS.pmiPct, 2)} of the loan under 20% down` },
    { label: "Not counted", value: "HOA dues, and the cash you need to close" },
  ];
  return {
    comfortable, stretch, gross, debts, assumptions,
    couldBeWrong:
      "This is a planning scenario, not a lending decision. Lenders use their own ratios, count income and debts their own way, and FHA and other loans can allow more. Taxes, insurance and HOA dues vary by home. A lender's pre-approval is the only real answer.",
  };
}
