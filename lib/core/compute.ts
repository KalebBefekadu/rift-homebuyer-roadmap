/**
 * Rift prototype: deterministic value engine.
 *
 * Product rule (docs/product.md, "Rules for front-end value" #8):
 * front-end value is COMPUTED, never generated. Every figure a visitor sees
 * comes from this file or the verified registry in `registry.ts`. Nothing here
 * calls a model, and nothing here invents a program.
 *
 * Every exported result carries the assumptions that produced it so the
 * `<Figure>` component can render them. A figure without assumptions cannot
 * render: see components/prototype/Figure.tsx.
 */

export type Assumption = { label: string; value: string };

export interface Computed {
  value: number;
  assumptions: Assumption[];
  /** Plain statement of how this number could be wrong. Required. */
  couldBeWrong: string;
}

export const money = (n: number, cents = false) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

export const pct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;

export const range = (lo: number, hi: number) =>
  lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;

/* ------------------------------------------------------------------ *
 * Buyer
 * ------------------------------------------------------------------ */

export interface BuyerInputs {
  price: number;
  downPct: number;
  ratePct: number;
  termYears: number;
  taxPct: number;
  insuranceYr: number;
  hoaMo: number;
  closingPct: number;
  pmiPct: number;
  savings: number;
  monthlySaving: number;
  assistance: number;
  county: string;
  currentRent: number;
  /** The loan they plan. Undefined or "unsure": the generic conventional estimate (V2). */
  loanType?: BuyerLoan;
}

export type BuyerLoan = "fha" | "conventional" | "va" | "usda" | "unsure";

export const BUYER_DEFAULTS: BuyerInputs = {
  price: 325_000,
  downPct: 3.5,
  ratePct: 6.5,
  termYears: 30,
  taxPct: 1.0,
  insuranceYr: 1_650,
  hoaMo: 0,
  closingPct: 3,
  pmiPct: 0.6,
  savings: 9_000,
  monthlySaving: 650,
  assistance: 0,
  county: "DeKalb",
  currentRent: 1_850,
};

/**
 * The planning rate at which home prices are assumed to rise, a year. A
 * long-run metro average, deliberately below the recent run. One figure for
 * every surface that projects a price forward (the timeline's moving target,
 * the abroad return's appreciation), so two pages cannot quote two rates for
 * the same street. Always shown as an assumption, never as a forecast.
 */
export const PRICE_GROWTH_PCT = 4;

/** Monthly principal and interest. Mirrors the contract in docs/calculations.md. */
export function monthlyPI(loan: number, ratePct: number, termYears: number) {
  if (loan <= 0) return 0;
  const r = ratePct / 100 / 12;
  const n = termYears * 12;
  if (n <= 0) return 0;
  if (r === 0) return loan / n;
  const g = Math.pow(1 + r, n);
  return (loan * r * g) / (g - 1);
}

/**
 * The mortgage insurance here is a generic conventional-loan rule (MONEY-04).
 * FHA, VA and USDA loans charge it differently or not at all, and saying so
 * next to the figure is what keeps it from reading as underwriting.
 */
export const PMI_NOTE = "A generic conventional-loan estimate; FHA, VA and USDA loans charge it differently";

/**
 * The agencies' published fees (V2, Kaleb 13 Oct 2026). Checked on 13 October
 * 2026 against lender and industry summaries of the agency rules, because the
 * agency pages could not be read from where this was built; each names the
 * agency rule so it can be confirmed at the source.
 *
 *   FHA:  upfront premium 1.75% of the base loan, financed. Annual premium on
 *         a 30-year loan of $726,200 or less: 0.55% above 95% of the price,
 *         0.50% at or under; above $726,200, 0.75% and 0.70%. Kept for the
 *         life of the loan above 90%, eleven years at or under (HUD Mortgagee
 *         Letter 2023-05 cut the annual rate from 0.85%).
 *   VA:   no monthly mortgage insurance; a funding fee on first use of 2.15%
 *         under 5% down, 1.5% under 10%, 1.25% from 10%, financed. Veterans
 *         paid for a service-connected disability are exempt, which the VA
 *         decides (unchanged since April 2023).
 *   USDA: a 1% upfront guarantee fee, financed, and 0.35% a year for the life
 *         of the loan (confirmed for loans obligated from 1 October 2025).
 */
export const LOAN_FEES = {
  checkedOn: "2026-10-13",
  fha: { upfrontPct: 1.75, highBalance: 726_200, annual: { over95: 0.55, upTo95: 0.5, highOver95: 0.75, highUpTo95: 0.7 }, lifeAboveLtv: 90, years: 11, minDown: 3.5, source: "HUD Mortgagee Letter 2023-05" },
  va: { tiers: [{ below: 5, pct: 2.15 }, { below: 10, pct: 1.5 }, { below: Infinity, pct: 1.25 }], minDown: 0, source: "VA funding fee table, first use, purchase" },
  usda: { upfrontPct: 1, annualPct: 0.35, minDown: 0, source: "USDA Single Family Housing Guaranteed Loan Program fees, fiscal year 2026" },
  conventional: { minDown: 3 },
} as const;

export interface LoanTerms {
  kind: BuyerLoan;
  /** Price less the down payment. */
  base: number;
  /** A fee added to the loan rather than paid in cash. */
  upfront: number;
  /** What is borrowed: base plus the financed fee. */
  loan: number;
  /** Mortgage insurance (or the USDA annual fee) a year, as a share of the base loan. */
  miPct: number;
  miMonthly: number;
  /** When it stops: at 78% of the price on schedule, after eleven years, never, or not charged. */
  miEnds: "78%" | "11 years" | "life" | null;
  /** The loan's minimum down payment, when theirs is under it. */
  belowMinimum: number | null;
}

/** The loan behind a monthly payment. "unsure" and undefined are the conventional estimate, unchanged. */
export function loanTerms(i: BuyerInputs): LoanTerms {
  const kind: BuyerLoan = i.loanType ?? "unsure";
  const base = Math.max(i.price - (i.price * i.downPct) / 100, 0);
  const ltv = i.price > 0 ? (base / i.price) * 100 : 0;
  const under = (min: number) => (i.downPct < min ? min : null);
  const make = (upfront: number, miPct: number, miEnds: LoanTerms["miEnds"], belowMinimum: number | null): LoanTerms =>
    ({ kind, base, upfront, loan: base + upfront, miPct, miMonthly: (base * miPct) / 100 / 12, miEnds: miPct > 0 ? miEnds : null, belowMinimum });

  if (kind === "fha") {
    const f = LOAN_FEES.fha;
    const high = base > f.highBalance;
    const pct = ltv > 95 ? (high ? f.annual.highOver95 : f.annual.over95) : (high ? f.annual.highUpTo95 : f.annual.upTo95);
    return make((base * f.upfrontPct) / 100, base > 0 ? pct : 0, ltv > f.lifeAboveLtv ? "life" : "11 years", under(f.minDown));
  }
  if (kind === "va") {
    const tier = LOAN_FEES.va.tiers.find((t) => i.downPct < t.below)!;
    return make((base * tier.pct) / 100, 0, null, null);
  }
  if (kind === "usda") {
    const u = LOAN_FEES.usda;
    return make((base * u.upfrontPct) / 100, base > 0 ? u.annualPct : 0, "life", null);
  }
  const pmi = i.downPct < 20 && i.pmiPct > 0 ? i.pmiPct : 0;
  return make(0, pmi, "78%", under(LOAN_FEES.conventional.minDown));
}

export const LOAN_NAME: Record<BuyerLoan, string> = {
  fha: "FHA", conventional: "conventional", va: "VA", usda: "USDA", unsure: "conventional (not chosen yet)",
};

/** How a loan's mortgage insurance and financed fee are named, one wording for every page. */
export function loanWords(t: LoanTerms) {
  const fee = t.kind === "fha" ? "FHA upfront premium" : t.kind === "va" ? "VA funding fee" : t.kind === "usda" ? "USDA guarantee fee" : null;
  const mi =
    t.kind === "va" ? { label: "Mortgage insurance", note: "None on a VA loan" }
    : t.kind === "usda" ? { label: "USDA annual fee", note: `${pct(t.miPct, 2)} of the loan a year, for the life of the loan` }
    : t.kind === "fha" ? { label: "FHA mortgage insurance", note: `${pct(t.miPct, 2)} of the loan a year, ${t.miEnds === "life" ? "for the life of the loan at under 10% down" : "for eleven years at 10% down or more"}` }
    : t.miPct > 0 ? { label: "Mortgage insurance", note: `Charged when less than 20% is put down. ${PMI_NOTE}` }
    : { label: "Mortgage insurance", note: "None at 20% down on a conventional loan" };
  const minimum = t.belowMinimum !== null
    ? (t.kind === "unsure" || t.kind === "conventional"
      ? `Conventional loans usually need at least ${t.belowMinimum}% down; 0% is for VA and USDA loans.`
      : `${LOAN_NAME[t.kind]} loans need at least ${t.belowMinimum}% down.`)
    : null;
  return { fee, mi, minimum };
}

export interface MonthlyBreakdown {
  pi: number;
  tax: number;
  insurance: number;
  pmi: number;
  hoa: number;
  total: number;
}

export function monthlyCost(i: BuyerInputs): MonthlyBreakdown {
  /* The loan's own terms: a financed fee raises what is borrowed, and the
     insurance follows the loan type (V2). Conventional is unchanged. */
  const t = loanTerms(i);
  const pi = monthlyPI(t.loan, i.ratePct, i.termYears);
  const tax = (i.price * i.taxPct) / 100 / 12;
  const insurance = i.insuranceYr / 12;
  const pmi = t.miMonthly;
  const hoa = i.hoaMo;
  return { pi, tax, insurance, pmi, hoa, total: pi + tax + insurance + pmi + hoa };
}

export function monthlyComputed(i: BuyerInputs): Computed & { parts: MonthlyBreakdown } {
  const parts = monthlyCost(i);
  return {
    value: parts.total,
    parts,
    assumptions: [
      { label: "Purchase price", value: money(i.price) },
      { label: "Down payment", value: `${pct(i.downPct)} (${money((i.price * i.downPct) / 100)})` },
      { label: "Interest rate", value: pct(i.ratePct, 2) },
      { label: "Term", value: `${i.termYears} years` },
      { label: "Property tax", value: `${pct(i.taxPct)} of price per year` },
      { label: "Insurance", value: `${money(i.insuranceYr)} per year` },
      { label: "PMI", value: (() => {
        /* The loan's own insurance when a loan type was chosen (V2); the
           generic conventional wording otherwise, exactly as before. */
        const t = loanTerms(i);
        if (t.kind !== "unsure" && t.kind !== "conventional") return loanWords(t).mi.note;
        return i.downPct < 20 ? `${pct(i.pmiPct, 2)} of loan per year. ${PMI_NOTE}` : "None, 20% or more down";
      })() },
      { label: "HOA", value: i.hoaMo > 0 ? `${money(i.hoaMo)} per month` : "None assumed" },
    ],
    couldBeWrong:
      "Your actual rate depends on credit, loan type, and the day you lock. Property tax varies by parcel and by whether a homestead exemption is in place, and insurance depends on the specific home. A lender's estimate is the authority.",
  };
}

/** The balance left after `months` scheduled payments. Closed form of paying it month by month. */
export function balanceAfter(loan: number, ratePct: number, termYears: number, months: number) {
  if (loan <= 0) return 0;
  const n = termYears * 12;
  const m = Math.min(Math.max(months, 0), n);
  const r = ratePct / 100 / 12;
  if (r === 0) return loan - (loan / n) * m;
  const g = Math.pow(1 + r, m);
  return loan * g - monthlyPI(loan, ratePct, termYears) * ((g - 1) / r);
}

/**
 * Conventional mortgage insurance ends automatically when the scheduled
 * balance reaches 78% of the original value (the Homeowners Protection Act of
 * 1998). A borrower can ask at 80%, and a home that gains value can get there
 * sooner with an appraisal; the scheduled date is the one nobody has to ask
 * for. FHA insurance at under 10% down never ends, which PMI_NOTE and the
 * page say.
 */
export const PMI_TERMINATION_LTV = 78;

/**
 * What a monthly payment does, beyond what it costs: how much of it is
 * principal (theirs to keep), when mortgage insurance comes off on schedule,
 * and how the total moves with the rate, which moves more than the price for
 * most buyers between now and the day they lock.
 */
export function owningDetail(i: BuyerInputs) {
  const t = loanTerms(i);
  const loan = t.loan;
  const pi = monthlyPI(loan, i.ratePct, i.termYears);
  const principalFirst = loan > 0 ? pi - loan * (i.ratePct / 100 / 12) : 0;
  const principalYear = loan - balanceAfter(loan, i.ratePct, i.termYears, 12);

  /* When the insurance stops depends on the loan: conventional on schedule at
     78% of the price, FHA after eleven years at 10% down or more, and never
     for FHA above 90% or for USDA's annual fee. */
  let pmiEnds: { month: number; monthly: number } | null = null;
  if (t.miEnds === "78%") {
    const limit = (i.price * PMI_TERMINATION_LTV) / 100;
    for (let m = 1; m <= i.termYears * 12; m++) {
      if (balanceAfter(loan, i.ratePct, i.termYears, m) <= limit) { pmiEnds = { month: m, monthly: t.miMonthly }; break; }
    }
  } else if (t.miEnds === "11 years") {
    pmiEnds = { month: LOAN_FEES.fha.years * 12, monthly: t.miMonthly };
  }
  const miForLife = t.miEnds === "life";

  const byRate = [-1, -0.5, 0, 0.5, 1]
    .map((d) => Math.round((i.ratePct + d) * 100) / 100)
    .filter((r) => r >= 0)
    .map((ratePct) => ({ ratePct, total: monthlyCost({ ...i, ratePct }).total }));

  return { loan, principalFirst, principalYear, pmiEnds, miForLife, byRate };
}

/**
 * True cash to close: the number that misleads almost every first-time buyer,
 * because they have only been told the down payment.
 */
export interface CashLine {
  label: string;
  amount: number;
  note: string;
  credited?: boolean;
}

export function cashToClose(i: BuyerInputs) {
  const down = (i.price * i.downPct) / 100;
  const closing = (i.price * i.closingPct) / 100;
  const prepaids = i.insuranceYr + (i.price * i.taxPct) / 100 / 12 * 3;
  const inspection = 550;
  const appraisal = 650;
  const earnest = Math.round((i.price * 0.01) / 100) * 100;

  const lines: CashLine[] = [
    { label: "Down payment", amount: down, note: `${pct(i.downPct)} of the purchase price` },
    { label: "Closing costs", amount: closing, note: `${pct(i.closingPct)} estimate: lender, title, attorney, recording` },
    { label: "Prepaids and escrow", amount: prepaids, note: "First-year insurance plus about three months of taxes held in escrow" },
    { label: "Inspection", amount: inspection, note: "Paid before closing, not refundable if you walk" },
    { label: "Appraisal", amount: appraisal, note: "Usually collected by the lender up front" },
    { label: "Earnest money", amount: earnest, note: "Paid at contract, credited back to you at closing", credited: true },
  ];

  const total = lines.filter((l) => !l.credited).reduce((s, l) => s + l.amount, 0);

  return {
    lines,
    total,
    down,
    earnest,
    assumptions: [
      { label: "Purchase price", value: money(i.price) },
      { label: "Down payment", value: pct(i.downPct) },
      { label: "Closing cost estimate", value: `${pct(i.closingPct)} of price` },
      { label: "Insurance", value: `${money(i.insuranceYr)} per year, first year collected up front` },
      { label: "Inspection / appraisal", value: `${money(inspection)} / ${money(appraisal)}` },
    ],
    couldBeWrong:
      "Closing costs in Georgia vary by lender, attorney, and loan type, and a seller may agree to pay part of them. Escrow amounts depend on when in the tax year you close. Earnest money is shown separately because you get it back at the table.",
  };
}

/**
 * Georgia intangible recording tax on a long-term note: $1.50 for each $500
 * of the loan or fraction of $500, to a maximum of $25,000 (O.C.G.A.
 * § 48-6-61). Paid by the buyer at closing, and the one closing line almost
 * nobody has heard of. It already sits inside the 3% closing estimate; it is
 * named here so it can be shown, not added a second time.
 */
export const GA_INTANGIBLE_PER_500 = 1.5;
export const GA_INTANGIBLE_MAX = 25_000;

/** The closing estimate with Georgia's intangible tax named inside it. The sum is unchanged. */
export function georgiaClosing(i: BuyerInputs) {
  /* The tax is on the note, so a financed FHA, VA or USDA fee is taxed too. */
  const loan = loanTerms(i).loan;
  const closing = (i.price * i.closingPct) / 100;
  /* "or fraction thereof": a part of $500 is charged as a whole one. The
     epsilon keeps an exact multiple from rounding up on float noise. */
  const tax = Math.min(GA_INTANGIBLE_MAX, Math.ceil(loan / 500 - 1e-9) * GA_INTANGIBLE_PER_500);
  const intangible = Math.min(tax, closing);
  return { loan, closing, intangible, other: closing - intangible };
}

/**
 * The cash to close if the seller pays a share of the price toward the
 * buyer's costs. It comes off the closing costs, prepaids, inspection and
 * appraisal, never off the down payment, which no seller may pay. How much a
 * seller may contribute depends on the loan; the page names the limits.
 */
export function sellerHelp(i: BuyerInputs, pct: number) {
  const c = cashToClose(i);
  const amount = Math.min((i.price * pct) / 100, c.total - c.down);
  return { pct, amount, total: c.total - amount };
}

export interface GapResult {
  cashNeeded: number;
  covered: number;
  gap: number;
  fullyCovered: boolean;
  monthsToClose: number | null;
  assumptions: Assumption[];
  couldBeWrong: string;
}

export function cashGap(i: BuyerInputs): GapResult {
  const { total } = cashToClose(i);
  const covered = i.savings + i.assistance;
  const gap = Math.max(total - covered, 0);
  const monthsToClose = gap <= 0 ? 0 : i.monthlySaving > 0 ? Math.ceil(gap / i.monthlySaving) : null;
  return {
    cashNeeded: total,
    covered,
    gap,
    fullyCovered: covered >= total,
    monthsToClose,
    assumptions: [
      { label: "Cash needed at closing", value: money(total) },
      { label: "Your savings", value: money(i.savings) },
      { label: "Assistance applied", value: money(i.assistance) },
      { label: "Saving rate", value: i.monthlySaving > 0 ? `${money(i.monthlySaving)} per month` : "Not provided" },
    ],
    couldBeWrong:
      "This assumes every assistance program you matched actually approves you, and that your saving rate holds. Programs have income limits, purchase-price caps, and funding that can run out. A lender confirms what you can actually use.",
  };
}

/** The two changes that shorten the timeline most, ranked by months saved. */
export function gapLevers(i: BuyerInputs) {
  const base = cashGap(i);
  if (base.gap <= 0 || !base.monthsToClose) return [];

  const variants: { label: string; detail: string; inputs: BuyerInputs }[] = [
    {
      label: "Save $200 more per month",
      detail: "Roughly one subscription review and one habit change for most households.",
      inputs: { ...i, monthlySaving: i.monthlySaving + 200 },
    },
    {
      label: `Look at ${money(i.price - 25_000)} instead`,
      detail: "Lowers the down payment, closing costs, and escrow together.",
      inputs: { ...i, price: i.price - 25_000 },
    },
    {
      label: "Ask the seller for 2% toward closing",
      detail: "Common in a slower market and costs you nothing to request.",
      inputs: { ...i, closingPct: Math.max(i.closingPct - 2, 0) },
    },
  ];

  return variants
    .map((v) => {
      const r = cashGap(v.inputs);
      return {
        label: v.label,
        detail: v.detail,
        months: r.monthsToClose ?? 0,
        saved: (base.monthsToClose ?? 0) - (r.monthsToClose ?? 0),
      };
    })
    .filter((v) => v.saved > 0)
    .sort((a, b) => b.saved - a.saved);
}

/* ------------------------------------------------------------------ *
 * Seller
 * ------------------------------------------------------------------ */

export interface SellerInputs {
  price: number;
  payoff: number;
  commissionPct: number;
  concessionsPct: number;
  repairs: number;
  moving: number;
  county: string;
  yearsOwned: number;
  ageOver65: boolean;
  homesteadFiled: boolean;
  /**
   * The fair market value on the county's assessment notice. Null: nobody
   * has told us it.
   *
   * It was a number with a default of $392,000, and no page asks for it. The
   * unclaimed-value check spreads the defaults and lets the visitor move only
   * the price, so a $300,000 home was told "The county has this parcel at
   * $392,000" and that an appeal looked worthwhile: a county figure nobody
   * gave, stated as fact, on the public page. Unknown is now unknown.
   */
  assessedValue: number | null;
}

export const SELLER_DEFAULTS: SellerInputs = {
  price: 415_000,
  payoff: 236_000,
  commissionPct: 5.5,
  concessionsPct: 1.5,
  repairs: 6_500,
  moving: 2_800,
  county: "Cobb",
  yearsOwned: 11,
  ageOver65: false,
  homesteadFiled: false,
  assessedValue: null,
};

/**
 * Whether the county's figure sits above what the home would likely sell
 * for. False when the assessment is not known: a comparison against a value
 * nobody gave is not one. One rule for the unclaimed check and the readout,
 * which each had their own copy of it.
 */
export function assessmentLooksHigh<T extends Pick<SellerInputs, "assessedValue" | "price">>(s: T): s is T & { assessedValue: number } {
  return s.assessedValue !== null && s.assessedValue > s.price * 0.96;
}

export interface ProceedLine {
  label: string;
  amount: number;
  note: string;
}

/**
 * Georgia transfer tax: $1.00 per $1,000 of consideration: 0.1%.
 *
 * O.C.G.A. § 48-6-1: "$1.00 for the first $1,000.00 … and 10 cents for each
 * additional $100.00", which is one tenth of a percent. This said "$1.00 per
 * $500: 0.2%" until September 2026, which charged every seller double: about
 * $400 too little reaching them on a $400,000 sale, on every readout and in
 * every offer comparison. Found while checking an offer-room draft by hand.
 * Readouts already issued are snapshots and keep the figure they showed.
 */
/* Exported so the offer table and the seller's readout cannot quote different
   transfer tax on the same house. A second copy of a statutory rate is a
   second thing to forget when it changes. */
export const GA_TRANSFER_TAX_RATE = 0.001;

export function netProceeds(s: SellerInputs) {
  const commission = (s.price * s.commissionPct) / 100;
  const concessions = (s.price * s.concessionsPct) / 100;
  const transferTax = s.price * GA_TRANSFER_TAX_RATE;
  const settlement = 850;
  const proratedTax = 1_450;
  const payoffAdmin = 375;

  const costs: ProceedLine[] = [
    { label: "Mortgage payoff", amount: s.payoff, note: "Principal balance plus interest to the closing date" },
    { label: "Commission", amount: commission, note: `${pct(s.commissionPct)} total, split as negotiated` },
    { label: "Seller concessions", amount: concessions, note: `${pct(s.concessionsPct)} allowance, a common ask in the current market` },
    { label: "Georgia transfer tax", amount: transferTax, note: "$1.00 per $1,000 of the sale price" },
    { label: "Settlement and recording", amount: settlement, note: "Closing attorney, deed preparation, recording fees" },
    { label: "Prorated property tax", amount: proratedTax, note: "Your share of the tax year up to closing" },
    { label: "Payoff and wire fees", amount: payoffAdmin, note: "Lender statement, wire, and courier charges" },
    { label: "Repairs before listing", amount: s.repairs, note: "Your current preparation estimate" },
    { label: "Moving", amount: s.moving, note: "Local move estimate" },
  ];

  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const net = s.price - totalCosts;

  return {
    costs,
    totalCosts,
    net,
    assumptions: [
      { label: "Sale price", value: money(s.price) },
      { label: "Mortgage payoff", value: money(s.payoff) },
      { label: "Commission", value: pct(s.commissionPct) },
      { label: "Concessions", value: pct(s.concessionsPct) },
      { label: "Transfer tax", value: "$1.00 per $1,000 of price (Georgia)" },
      { label: "Repairs and moving", value: `${money(s.repairs)} and ${money(s.moving)}` },
    ],
    couldBeWrong:
      "Your payoff changes daily with interest and is only exact on a lender payoff statement. Commission is negotiable and concessions depend on what a buyer asks for. Prorated taxes depend on the closing date, and repairs almost always move after an inspection.",
  };
}

/** Repair return triage: what pays back, what does not, what is only for photographs. */
export interface RepairItem {
  item: string;
  cost: number;
  verdict: "pays-back" | "photographs" | "skip";
  reason: string;
}

export function repairTriage(price: number): RepairItem[] {
  const band = price < 300_000 ? "low" : price < 600_000 ? "mid" : "high";
  const base: RepairItem[] = [
    { item: "Interior paint, main living areas", cost: 2_400, verdict: "pays-back", reason: "The highest-return item in almost every price band." },
    { item: "Deep clean and declutter", cost: 650, verdict: "pays-back", reason: "Costs least, changes buyer perception most." },
    { item: "Landscaping and front entry", cost: 1_200, verdict: "pays-back", reason: "Sets the expectation before anyone is through the door." },
    { item: "Carpet replacement, bedrooms", cost: 3_100, verdict: band === "high" ? "pays-back" : "photographs", reason: band === "high" ? "Expected at this price point." : "Worth doing only if it photographs badly; a credit is often cheaper." },
    { item: "Light fixture refresh", cost: 900, verdict: "photographs", reason: "Small effect in person, large effect in listing photos." },
    { item: "Kitchen renovation", cost: 28_000, verdict: "skip", reason: "Rarely returns its cost at sale. Price for the kitchen you have." },
    { item: "Roof replacement (no active leak)", cost: 14_500, verdict: "skip", reason: "A credit at closing almost always costs less than the work." },
    { item: "Bathroom renovation", cost: 16_000, verdict: "skip", reason: "Buyers discount an older bathroom far less than the renovation costs." },
  ];
  return base;
}

/** Unclaimed value: the seller-side equivalent of the assistance match. */
export interface UnclaimedItem {
  title: string;
  estimate: string;
  detail: string;
  decidedBy: string;
  urgency?: string;
}

export function unclaimedValue(s: SellerInputs): UnclaimedItem[] {
  const out: UnclaimedItem[] = [];

  if (!s.homesteadFiled) {
    out.push({
      title: "Homestead exemption may never have been filed",
      estimate: "$600 – $1,400 per year",
      detail:
        "Our records question suggests no homestead exemption is on this parcel. If this is your primary residence, filing reduces the taxable value every year you still own it.",
      decidedBy: "Your county tax commissioner",
      urgency: "Filing deadlines are usually early in the year and are not retroactive.",
    });
  }

  if (s.ageOver65) {
    out.push({
      title: "Age-based school tax exemption may apply",
      estimate: "$1,100 – $3,200 per year",
      detail:
        "Several Georgia counties offer substantial school tax relief at 62 or 65, sometimes with an income test. Many owners never apply because nobody tells them.",
      decidedBy: "Your county tax commissioner",
    });
  }

  if (s.assessedValue === null) {
    /* The appeal window is still worth knowing about; what we cannot say is
       whether their assessment is high, so the item asks them to compare
       rather than telling them the answer. */
    out.push({
      title: "Your assessment may be worth checking",
      estimate: "Varies",
      detail:
        "Compare the fair market value on your annual assessment notice with what the home would realistically sell for. If the county has it higher, an appeal may lower the tax every year, whether or not you sell.",
      decidedBy: "Your county board of assessors",
      urgency: "Appeal windows after the annual notice are short and strictly enforced.",
    });
  } else if (assessmentLooksHigh(s)) {
    const over = s.assessedValue - s.price * 0.92;
    out.push({
      title: "Your assessment looks high relative to likely sale price",
      estimate: `${money(Math.round((over * 0.011) / 100) * 100)} – ${money(Math.round((over * 0.018) / 100) * 100)} per year`,
      detail: `The county has this parcel at ${money(s.assessedValue)}. If the home realistically sells nearer ${money(s.price)}, the assessment may be worth appealing, and a successful appeal helps whether or not you sell.`,
      decidedBy: "Your county board of assessors",
      urgency: "Appeal windows after the annual notice are short and strictly enforced.",
    });
  }

  if (s.yearsOwned >= 2) {
    out.push({
      title: "Primary-residence capital gains exclusion likely available",
      estimate: "Up to $250,000 single / $500,000 married",
      detail: `You have owned this home about ${s.yearsOwned} years. If you also lived in it for two of the last five, the gain may be excluded, but the arithmetic and the exceptions are real and worth checking before you commit to a timeline.`,
      decidedBy: "A tax professional",
    });
  }

  out.push({
    title: "Confirm there is no prepayment penalty on your payoff",
    estimate: "Varies",
    detail:
      "Uncommon on conventional loans but not extinct, and it is far better found now than on a payoff statement three days before closing.",
    decidedBy: "Your lender",
  });

  return out;
}
