/**
 * Rift prototype — deterministic value engine.
 *
 * Product rule (docs/product.md, "Rules for front-end value" #8):
 * front-end value is COMPUTED, never generated. Every figure a visitor sees
 * comes from this file or the verified registry in `registry.ts`. Nothing here
 * calls a model, and nothing here invents a program.
 *
 * Every exported result carries the assumptions that produced it so the
 * `<Figure>` component can render them. A figure without assumptions cannot
 * render — see components/prototype/Figure.tsx.
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
}

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

export interface MonthlyBreakdown {
  pi: number;
  tax: number;
  insurance: number;
  pmi: number;
  hoa: number;
  total: number;
}

export function monthlyCost(i: BuyerInputs): MonthlyBreakdown {
  const down = (i.price * i.downPct) / 100;
  const loan = Math.max(i.price - down, 0);
  const pi = monthlyPI(loan, i.ratePct, i.termYears);
  const tax = (i.price * i.taxPct) / 100 / 12;
  const insurance = i.insuranceYr / 12;
  const pmi = i.downPct < 20 && i.pmiPct > 0 ? (loan * i.pmiPct) / 100 / 12 : 0;
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
      { label: "PMI", value: i.downPct < 20 ? `${pct(i.pmiPct, 2)} of loan per year` : "None — 20% or more down" },
      { label: "HOA", value: i.hoaMo > 0 ? `${money(i.hoaMo)} per month` : "None assumed" },
    ],
    couldBeWrong:
      "Your actual rate depends on credit, loan type, and the day you lock. Property tax varies by parcel and by whether a homestead exemption is in place, and insurance depends on the specific home. A lender's estimate is the authority.",
  };
}

/**
 * True cash to close — the number that misleads almost every first-time buyer,
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
  const moving = 1_400;
  const earnest = Math.round((i.price * 0.01) / 100) * 100;

  const lines: CashLine[] = [
    { label: "Down payment", amount: down, note: `${pct(i.downPct)} of the purchase price` },
    { label: "Closing costs", amount: closing, note: `${pct(i.closingPct)} estimate — lender, title, attorney, recording` },
    { label: "Prepaids and escrow", amount: prepaids, note: "First-year insurance plus about three months of taxes held in escrow" },
    { label: "Inspection", amount: inspection, note: "Paid before closing, not refundable if you walk" },
    { label: "Appraisal", amount: appraisal, note: "Usually collected by the lender up front" },
    { label: "Moving", amount: moving, note: "Local move estimate — the cost buyers forget most often" },
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
      { label: "Inspection / appraisal / moving", value: `${money(inspection)} / ${money(appraisal)} / ${money(moving)}` },
    ],
    couldBeWrong:
      "Closing costs in Georgia vary by lender, attorney, and loan type, and a seller may agree to pay part of them. Escrow amounts depend on when in the tax year you close. Earnest money is shown separately because you get it back at the table.",
  };
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

/** Rent versus buy crossover, in months, ignoring appreciation on purpose. */
export function rentVsBuy(i: BuyerInputs) {
  const m = monthlyCost(i);
  const cash = cashToClose(i).total;
  const principalYr1 = (() => {
    const down = (i.price * i.downPct) / 100;
    let bal = Math.max(i.price - down, 0);
    const r = i.ratePct / 100 / 12;
    let paid = 0;
    for (let k = 0; k < 12; k++) {
      const interest = bal * r;
      const princ = m.pi - interest;
      paid += princ;
      bal -= princ;
    }
    return paid;
  })();

  const monthlyDelta = m.total - i.currentRent;
  const equityPerMonth = principalYr1 / 12;
  const netPerMonth = equityPerMonth - monthlyDelta;
  const months = netPerMonth > 0 ? Math.ceil(cash / netPerMonth) : null;

  return {
    monthlyDelta,
    equityPerMonth,
    months,
    assumptions: [
      { label: "Your rent today", value: `${money(i.currentRent)} per month` },
      { label: "All-in ownership cost", value: `${money(m.total)} per month` },
      { label: "Equity built", value: `${money(equityPerMonth)} per month in year one` },
      { label: "Upfront cash", value: money(cash) },
      { label: "Appreciation", value: "Excluded on purpose" },
    ],
    couldBeWrong:
      "This ignores home price appreciation, rent increases, maintenance, and the tax treatment of mortgage interest. It is a floor, not a forecast. Renting is often the right answer for a short horizon.",
  };
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
  assessedValue: number;
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
  assessedValue: 392_000,
};

export interface ProceedLine {
  label: string;
  amount: number;
  note: string;
}

/** Georgia transfer tax is $1.00 per $500 of consideration — 0.2%. */
const GA_TRANSFER_TAX_RATE = 0.002;

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
    { label: "Seller concessions", amount: concessions, note: `${pct(s.concessionsPct)} allowance — common ask in the current market` },
    { label: "Georgia transfer tax", amount: transferTax, note: "$1.00 per $500 of the sale price" },
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
      { label: "Transfer tax", value: "$1.00 per $500 of price (Georgia)" },
      { label: "Repairs and moving", value: `${money(s.repairs)} and ${money(s.moving)}` },
    ],
    couldBeWrong:
      "Your payoff changes daily with interest and is only exact on a lender payoff statement. Commission is negotiable and concessions depend on what a buyer asks for. Prorated taxes depend on the closing date, and repairs almost always move after an inspection.",
  };
}

/** Repair return triage — what pays back, what does not, what is only for photographs. */
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

/** Unclaimed value — the seller-side equivalent of the assistance match. */
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

  if (s.assessedValue > s.price * 0.96) {
    const over = s.assessedValue - s.price * 0.92;
    out.push({
      title: "Your assessment looks high relative to likely sale price",
      estimate: `${money(Math.round((over * 0.011) / 100) * 100)} – ${money(Math.round((over * 0.018) / 100) * 100)} per year`,
      detail: `The county has this parcel at ${money(s.assessedValue)}. If the home realistically sells nearer ${money(s.price)}, the assessment may be worth appealing — and a successful appeal helps whether or not you sell.`,
      decidedBy: "Your county board of assessors",
      urgency: "Appeal windows after the annual notice are short and strictly enforced.",
    });
  }

  if (s.yearsOwned >= 2) {
    out.push({
      title: "Primary-residence capital gains exclusion likely available",
      estimate: "Up to $250,000 single / $500,000 married",
      detail: `You have owned this home about ${s.yearsOwned} years. If you also lived in it for two of the last five, the gain may be excluded — but the arithmetic and the exceptions are real and worth checking before you commit to a timeline.`,
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
