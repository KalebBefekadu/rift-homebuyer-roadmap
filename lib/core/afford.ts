/**
 * How much home fits me (Blueprint v5 §5.2, MONEY-05).
 *
 * A comfort range is a PLANNING SCENARIO, never a lending decision. So the
 * answer starts from the payment the person says they are comfortable with,
 * not from the most a lender might allow, and shows two long-standing
 * planning guidelines beside it (housing at 28% of gross income, all debts
 * at 36%) as context. It never solves toward a lender's maximum, never says
 * "you can afford", and says plainly that a lender decides.
 *
 * The solve is exact, not iterative. For a fixed down payment every part of
 * the monthly cost is proportional to the price except insurance, so
 *   monthly(price) = k × price + insurance
 * and the price for a payment P is (P − insurance) ÷ k. The same functions
 * the monthly-cost value uses produce k, so the two values cannot disagree
 * about the same house.
 *
 * Bounds: a payment that does not cover insurance leaves no price; answers
 * are capped at the same $5,000,000 every value uses and rounded down to the
 * nearest $5,000, so the figure never overstates.
 *
 * Pure: no I/O.
 */

import { BUYER_DEFAULTS, monthlyCost, money, pct, type Assumption, type BuyerInputs } from "./compute";

export const MAX_PRICE = 5_000_000;
/** Planning guidelines, not lending rules. Named as such wherever shown. */
export const HOUSING_SHARE = 28;
export const DEBT_SHARE = 36;

export interface AffordInputs {
  /** Gross household income a year. */
  income: number;
  /** Monthly payments on other debts: cars, cards, student loans. */
  debts: number;
  /** The monthly housing payment they are comfortable with, all in. */
  comfort: number;
  downPct: number;
  ratePct: number;
}

type Base = Omit<BuyerInputs, "price">;

/** The monthly cost per dollar of price, and the part that does not scale. */
function slope(i: AffordInputs): { k: number; fixed: number; base: Base } {
  const base: Base = { ...BUYER_DEFAULTS, downPct: i.downPct, ratePct: i.ratePct, hoaMo: 0 };
  const at = (price: number) => monthlyCost({ ...base, price }).total;
  const fixed = at(0);
  return { k: (at(1_000_000) - fixed) / 1_000_000, fixed, base };
}

const floor5k = (n: number) => Math.max(0, Math.floor(n / 5_000) * 5_000);

/** The highest price whose all-in monthly cost stays at or under a payment. Null: no price does. */
export function priceFor(payment: number, i: AffordInputs): number | null {
  const { k, fixed } = slope(i);
  if (!(payment > fixed) || !(k > 0)) return null;
  return Math.min(MAX_PRICE, floor5k((payment - fixed) / k));
}

export interface Scenario {
  label: string;
  /** The monthly housing payment this scenario allows. */
  payment: number;
  price: number | null;
  note: string;
}

export function affordability(i: AffordInputs) {
  const monthlyIncome = i.income / 12;
  const housingGuide = (monthlyIncome * HOUSING_SHARE) / 100;
  const debtGuide = Math.max(0, (monthlyIncome * DEBT_SHARE) / 100 - i.debts);

  const scenarios: Scenario[] = [
    { label: "Your comfortable payment", payment: i.comfort, price: priceFor(i.comfort, i), note: "The number you gave: the one this plan is built on" },
    { label: `Housing at ${HOUSING_SHARE}% of income`, payment: housingGuide, price: priceFor(housingGuide, i), note: "A long-standing planning guideline, not a lender's rule" },
    { label: `All debts at ${DEBT_SHARE}% of income`, payment: debtGuide, price: priceFor(debtGuide, i), note: `After the ${money(i.debts)} a month you already pay` },
  ];
  const comfort = scenarios[0];
  const guides = scenarios.slice(1).map((s) => s.price ?? 0);
  /* Above both guidelines is said, never hidden: it is their call, and a
     plan that stretches should know it is stretching. */
  const stretch = comfort.price !== null && guides.every((g) => comfort.price! > g);

  const monthlyAt = comfort.price !== null ? monthlyCost({ ...slope(i).base, price: comfort.price }) : null;

  return {
    comfort,
    scenarios,
    stretch,
    monthlyAt,
    assumptions: [
      { label: "Down payment", value: pct(i.downPct) },
      { label: "Interest rate", value: pct(i.ratePct, 2) },
      { label: "Property tax", value: `${pct(BUYER_DEFAULTS.taxPct)} of price a year` },
      { label: "Insurance", value: `${money(BUYER_DEFAULTS.insuranceYr)} a year` },
      { label: "Mortgage insurance", value: i.downPct < 20 ? `${pct(BUYER_DEFAULTS.pmiPct, 2)} of the loan a year` : "None, 20% or more down" },
      { label: "HOA", value: "None assumed" },
    ] as Assumption[],
    couldBeWrong:
      "This is a plan, not an approval. A lender looks at your credit, your full debts, your savings and the loan type, and may allow more or less than any figure here. Taxes, insurance and any HOA fee depend on the home, and all of them change the price a payment reaches.",
  };
}
