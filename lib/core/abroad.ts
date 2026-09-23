/**
 * Buying from abroad.
 *
 * This exists because the buyer engine answers a question this audience is not
 * asking. A Georgia first-time-buyer programme requires the buyer to live in
 * the house, and most require a Social Security number; someone in Addis
 * planning to rent the place out qualifies for none of it. Showing them the
 * assistance hero would be showing them money they cannot have, which is the
 * one thing this product is built not to do.
 *
 * What they are actually asking is narrower and nobody answers it plainly:
 * what can I borrow, what do I have to send, and what comes back each month.
 *
 * Everything here is I/O-free and returns numbers the page renders rather than
 * copy, so a claim on the landing page and the readout after it cannot drift
 * apart.
 */

import { monthlyPI } from "./compute";

/* ------------------------------------------------------------------ status */

export type StatusId = "citizen" | "resident" | "itin" | "foreign";
export type Use = "live" | "rent";

export interface Status {
  id: StatusId;
  label: string;
  /** What this status actually is, in the words the person would use. */
  note: string;
  /** Minimum down payment, by what they intend to do with the house. */
  down: Record<Use, number>;
  /** Points above a conventional rate that this paper typically carries. */
  ratePremium: number;
  /** What a lender will ask for that a domestic buyer is never asked for. */
  asks: string;
}

/**
 * The four situations, in descending order of how well the American mortgage
 * market treats them. The ranges are conservative ends of what lenders in this
 * market publish; a lender's own terms decide, and the page says so.
 *
 * The honest version of "as little as 10% down" is that it depends entirely on
 * which of these four you are and whether you will live in the house, which is
 * a better sales argument than the slogan, because it is checkable.
 */
export const STATUSES: Status[] = [
  {
    id: "citizen",
    label: "I'm a U.S. citizen living abroad",
    note: "Born here or naturalised, and currently outside the country.",
    down: { live: 5, rent: 15 },
    ratePremium: 0,
    asks: "Foreign income documented and usually translated, plus a U.S. bank account to close from.",
  },
  {
    id: "resident",
    label: "I have a green card or a U.S. visa",
    note: "A permanent resident, or here on a work or student visa with a Social Security number.",
    down: { live: 5, rent: 15 },
    ratePremium: 0,
    asks: "The same file as any American buyer. A visa with under a year left may need extra documentation.",
  },
  {
    id: "itin",
    label: "I have an ITIN, not a Social Security number",
    note: "Filing U.S. taxes on an individual taxpayer identification number.",
    down: { live: 15, rent: 20 },
    ratePremium: 1.5,
    asks: "Two years of ITIN tax returns. Fewer lenders do this, and the ones that do price it higher.",
  },
  {
    id: "foreign",
    label: "I live abroad with no U.S. status",
    note: "No green card, no visa, no U.S. tax history. This is the most common case.",
    down: { live: 30, rent: 30 },
    ratePremium: 2,
    asks: "A passport, a reference letter from your own bank, and reserves held in a U.S. account before closing.",
  },
];

/**
 * Turning a URL into abroad inputs.
 *
 * Same trust boundary as lib/core/params.ts and for the same reason: the
 * readout is URL-addressable and ungated, so every figure on it comes from a
 * query string a stranger can edit. Anything unrecognised falls back to the
 * strictest honest default rather than being passed through: a made-up status
 * would quote a down payment no lender offers.
 */
export function parseAbroadParams(
  get: (k: string) => string | undefined,
  counties: readonly string[],
): AbroadInputs & { downPct: number } {
  const num = (k: string, lo: number, hi: number, fallback: number) => {
    const n = Number(get(k));
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : fallback;
  };
  const status = STATUSES.find((x) => x.id === get("s"))?.id ?? ABROAD_DEFAULTS.status;
  const use: Use = get("u") === "live" ? "live" : "rent";
  const countyRaw = get("c");
  const county = countyRaw && counties.includes(countyRaw) ? countyRaw : ABROAD_DEFAULTS.county;
  const price = num("p", 60_000, 3_000_000, ABROAD_DEFAULTS.price);
  const floor = statusById(status).down[use];
  return { price, county, status, use, downPct: num("d", floor, 100, floor) };
}

export const statusById = (id: StatusId) => STATUSES.find((s) => s.id === id) ?? STATUSES[3];

/* -------------------------------------------------------------------- rent */

/**
 * Monthly rent as a share of price, by county.
 *
 * THESE ARE WORKING ASSUMPTIONS, NOT OBSERVED AVERAGES.
 *
 * Said in capitals because the docblock that used to sit here did not say it.
 * It read "rent does not track price evenly across the metro: the counties
 * that have appreciated most have the worst ratios", which is the language of
 * an observation, and these figures are nobody's observation: they were
 * written to be plausible. The shape is a reasonable guess. The numbers are
 * not data.
 *
 * That mattered because the page told the READER they were: "rent is estimated
 * from county averages". A figure that is merely someone's guess renders
 * exactly like a measured one, and claiming a source it does not have is worse
 * than claiming none: it is the single failure this product cannot survive.
 *
 * They drive the cash-flow figure, the break-even down payment and the
 * headline return. Replacing them takes a rent-to-price ratio per county from
 * a source that can be named; see RENT_RATIO_SOURCE below, which is what the
 * page reads to decide what it is allowed to claim.
 */
const RENT_RATIO: Record<string, number> = {
  Clayton: 0.0082,
  DeKalb: 0.0072,
  Fulton: 0.0068,
  Gwinnett: 0.0070,
  Henry: 0.0074,
  Douglas: 0.0075,
  Cobb: 0.0066,
  Cherokee: 0.0063,
};

/**
 * Where the ratios above came from, in the product's own terms.
 *
 * `"assumed"` means nobody has measured them. `"published"` means they came
 * from a source that can be named, and the named source goes in `name`.
 *
 * This exists so the disclosure and the data cannot drift apart. The page
 * reads this to decide what it is allowed to say, and lib/core/abroad.test.ts
 * fails if the wording claims an observation while this says "assumed".
 */
export const RENT_RATIO_SOURCE: { basis: "assumed" | "published"; name: string | null } = {
  basis: "assumed",
  name: null,
};

export const rentFor = (price: number, county: string) =>
  Math.round((price * (RENT_RATIO[county] ?? 0.007)) / 25) * 25;

/* ----------------------------------------------------------------- returns */

export interface AbroadInputs {
  price: number;
  county: string;
  status: StatusId;
  use: Use;
  /** Above the minimum, if they choose to. Undefined means the minimum. */
  downPct?: number;
}

export const ABROAD_DEFAULTS: AbroadInputs = {
  price: 285_000,
  county: "DeKalb",
  status: "foreign",
  use: "rent",
};

/** Assumptions held in one place so every figure on the page shares them. */
export const ASSUMPTIONS = {
  /* A starting assumption, overridden by the recorded rate wherever one is
     available. It is the same 6.5% the buyer engine starts from and it is here
     only so that pure code stays pure: every surface that can reach the
     database passes the real one in. Leaving it to stand on its own was a
     drift waiting to happen: record a rate, and this page alone keeps quoting
     a number the rest of the product has moved off. */
  baseRatePct: 6.5,
  termYears: 30,
  taxPct: 1.0,
  insuranceYr: 1_950,
  closingPct: 3,
  /** Full-service management, which is what someone 8,000 miles away buys. */
  managementPct: 8,
  /** A month empty a year, roughly, between tenants. */
  vacancyPct: 5,
  /** Repairs and turnover, set aside monthly rather than discovered at once. */
  maintenancePct: 5,
  /** Long-run metro average. Deliberately below the recent run. */
  appreciationPct: 4,
};

export interface AbroadResult {
  down: number;
  downPct: number;
  loan: number;
  ratePct: number;
  closing: number;
  /** Everything that has to leave their account to own it. */
  cashIn: number;
  rent: number;
  operating: { management: number; vacancy: number; maintenance: number };
  monthly: { pi: number; tax: number; insurance: number; total: number };
  /** Rent after costs, minus the mortgage. Negative is shown, never hidden. */
  cashFlow: number;
  /** Year one, the three ways the money comes back. */
  year1: { cashFlow: number; principal: number; appreciation: number; total: number };
  /** Year-one total return on the cash they actually sent. */
  returnPct: number;
}

/**
 * The down payment at which rent covers everything, or null if no amount does.
 * Binary search would be overkill: the relationship is monotonic and the answer
 * only needs to be good to a percentage point.
 */
export function breakEvenDownPct(i: AbroadInputs, a = ASSUMPTIONS): number | null {
  if (i.use !== "rent") return null;
  const floor = statusById(i.status).down[i.use];
  for (let d = floor; d <= 100; d++) {
    if (abroadReturns({ ...i, downPct: d }, a).cashFlow >= 0) return d;
  }
  return null;
}

export function abroadReturns(i: AbroadInputs, a = ASSUMPTIONS): AbroadResult {
  const s = statusById(i.status);
  /* The minimum is a floor, not a recommendation. At today's rates nothing in
     this metro covers its own mortgage at the minimum down, and a page that
     only ever showed the minimum would be quietly making a promise the market
     is not keeping. Letting them put more in is how they find the point where
     it does, which is a real answer, and one nobody gives them. */
  const downPct = Math.max(i.downPct ?? s.down[i.use], s.down[i.use]);
  const down = (i.price * downPct) / 100;
  const loan = Math.max(i.price - down, 0);
  const ratePct = a.baseRatePct + s.ratePremium;

  const closing = (i.price * a.closingPct) / 100;
  const cashIn = down + closing;

  const pi = monthlyPI(loan, ratePct, a.termYears);
  const tax = (i.price * a.taxPct) / 100 / 12;
  const insurance = a.insuranceYr / 12;
  const monthlyTotal = pi + tax + insurance;

  /* Rent only counts if they will not be living in it. Someone buying a home
     to live in later has no rent, and a page that credited them with it would
     be lying about the only number they care about. */
  const rent = i.use === "rent" ? rentFor(i.price, i.county) : 0;
  const management = (rent * a.managementPct) / 100;
  const vacancy = (rent * a.vacancyPct) / 100;
  const maintenance = (rent * a.maintenancePct) / 100;
  const cashFlow = rent - management - vacancy - maintenance - monthlyTotal;

  /* Principal paid in the first twelve payments. Worth separating from cash
     flow because it is the part nobody counts: it is not spendable, but it is
     theirs, and it is usually larger than the cash flow. */
  const r = ratePct / 100 / 12;
  let balance = loan;
  for (let m = 0; m < 12; m++) balance -= pi - balance * r;
  const principal = Math.max(loan - balance, 0);

  const appreciation = (i.price * a.appreciationPct) / 100;
  const year1CashFlow = cashFlow * 12;
  const total = year1CashFlow + principal + appreciation;

  return {
    down, downPct, loan, ratePct, closing, cashIn, rent,
    operating: { management, vacancy, maintenance },
    monthly: { pi, tax, insurance, total: monthlyTotal },
    cashFlow,
    year1: { cashFlow: year1CashFlow, principal, appreciation, total },
    returnPct: cashIn > 0 ? (total / cashIn) * 100 : 0,
  };
}
