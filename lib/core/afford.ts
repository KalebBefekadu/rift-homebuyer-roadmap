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
 * The real ceiling. A payment can reach a price the savings cannot close on:
 * someone comfortable at $2,400 a month with $20,000 saved was told about
 * $305,000 fits, when their cash reaches $250,000 once closing costs are in.
 * Cash to close is linear in the price in the same way (every line scales
 * except insurance, inspection and appraisal), so its inverse is exact too,
 * and the answer is the lower of the two, named as such. Unknown savings is
 * not zero savings: with none given, the payment alone sets it, and the page
 * says the cash was not checked rather than implying it was.
 *
 * Bounds: a payment that does not cover insurance leaves no price; answers
 * are capped at the same $5,000,000 every value uses and rounded down to the
 * nearest $5,000, so the figure never overstates.
 *
 * Pure: no I/O.
 */

import { BUYER_DEFAULTS, LOAN_FEES, LOAN_NAME, cashToClose, loanTerms, loanWords, monthlyCost, money, pct, type Assumption, type BuyerInputs } from "./compute";

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
  /** Saved towards buying. Undefined: not given, so the cash is not checked. */
  savings?: number;
  /** The loan they plan; its fees and insurance change what a payment reaches (V2). */
  loanType?: BuyerInputs["loanType"];
}

type Base = Omit<BuyerInputs, "price">;

/** The monthly cost per dollar of price, and the part that does not scale. */
function slope(i: AffordInputs): { k: number; fixed: number; base: Base } {
  const base: Base = { ...BUYER_DEFAULTS, downPct: i.downPct, ratePct: i.ratePct, hoaMo: 0, loanType: i.loanType };
  const at = (price: number) => monthlyCost({ ...base, price }).total;
  const fixed = at(0);
  return { k: (at(1_000_000) - fixed) / 1_000_000, fixed, base };
}

const floor5k = (n: number) => Math.max(0, Math.floor(n / 5_000) * 5_000);

/** The highest price whose all-in monthly cost stays at or under a payment. Null: no price does. */
export function priceFor(payment: number, i: AffordInputs): number | null {
  const { k, fixed, base } = slope(i);
  if (!(payment > fixed) || !(k > 0)) return null;
  /* FHA's annual premium steps up once the loan passes its high-balance line,
     so the cost is linear on each side of it but not across it. Solve on the
     lower line; if that lands past the step, solve on the upper one, and if
     the step itself is the answer (the payment falls between the two lines),
     stop just under it. Every other loan has one line and returns at once. */
  const at = (price: number) => monthlyCost({ ...base, price }).total;
  const kLow = (at(100_000) - fixed) / 100_000;
  let price = (payment - fixed) / kLow;
  const step = base.loanType === "fha" ? LOAN_FEES.fha.highBalance / (1 - i.downPct / 100) : Infinity;
  if (price > step) {
    const high = (payment - fixed) / k;
    price = high > step ? high : step;
  }
  return Math.min(MAX_PRICE, floor5k(price));
}

/** Cash to close per dollar of price, and the part that does not scale. */
function cashSlope(i: AffordInputs): { k: number; fixed: number } {
  const at = (price: number) => cashToClose({ ...BUYER_DEFAULTS, downPct: i.downPct, ratePct: i.ratePct, hoaMo: 0, price, assistance: 0 }).total;
  const fixed = at(0);
  return { k: (at(1_000_000) - fixed) / 1_000_000, fixed };
}

/** The highest price whose cash to close the savings cover. Null: no price does. */
export function priceForCash(savings: number, i: AffordInputs): number | null {
  const { k, fixed } = cashSlope(i);
  if (!(savings > fixed) || !(k > 0)) return null;
  return Math.min(MAX_PRICE, floor5k((savings - fixed) / k));
}

export interface Ceiling {
  /** The lower of the payment's price and the cash's price. Null: neither reaches one. */
  price: number | null;
  /** Which of the two sets it. "payment" when savings were not given. */
  binds: "payment" | "cash";
  /** Roughly how much price each `liftPer` dollars more of the binding thing adds. */
  lift: number;
  /** $1,000 more saved when cash binds; $100 more a month when the payment does. */
  liftPer: number;
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

  /* Which one binds. A tie goes to the payment: it is the number they chose. */
  const cash = i.savings === undefined ? null : { savings: i.savings, price: priceForCash(i.savings, i) };
  const cashBinds = cash !== null && (cash.price ?? -1) < (comfort.price ?? -1);
  const per = (n: number) => Math.round(n / 100) * 100;
  const ceiling: Ceiling = cashBinds
    ? { price: cash!.price, binds: "cash", lift: per(1_000 / cashSlope(i).k), liftPer: 1_000 }
    : { price: comfort.price, binds: "payment", lift: per(100 / slope(i).k), liftPer: 100 };

  const monthlyAt = comfort.price !== null ? monthlyCost({ ...slope(i).base, price: comfort.price }) : null;

  return {
    comfort,
    scenarios,
    stretch,
    cash,
    ceiling,
    monthlyAt,
    assumptions: [
      { label: "Down payment", value: pct(i.downPct) },
      { label: "Interest rate", value: pct(i.ratePct, 2) },
      { label: "Property tax", value: `${pct(BUYER_DEFAULTS.taxPct)} of price a year` },
      { label: "Insurance", value: `${money(BUYER_DEFAULTS.insuranceYr)} a year` },
      { label: "Loan", value: LOAN_NAME[i.loanType ?? "unsure"] },
      { label: "Mortgage insurance", value: loanWords(loanTerms({ ...slope(i).base, price: comfort.price ?? 300_000 })).mi.note },
      { label: "HOA", value: "None assumed" },
      { label: "Cash to close", value: i.savings === undefined ? "Not checked: no savings given" : `Down payment, ${pct(BUYER_DEFAULTS.closingPct)} closing costs, prepaids, inspection and appraisal, against ${money(i.savings)} saved` },
    ] as Assumption[],
    couldBeWrong:
      "This is a plan, not an approval. A lender looks at your credit, your full debts, your savings and the loan type, and may allow more or less than any figure here. Taxes, insurance and any HOA fee depend on the home, and all of them change the price a payment reaches. Closing costs vary by lender and loan, and a seller may pay part of them, which would lift what your cash reaches.",
  };
}
