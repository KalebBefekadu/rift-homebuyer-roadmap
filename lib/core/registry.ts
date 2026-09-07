/**
 * Rift prototype — verified program registry.
 *
 * Product rule (docs/product.md, "Keeping the program data honest"):
 * every program carries a last-verified date and its source. A program not
 * verified within 90 days is suppressed from customer-facing matching and
 * raised to the agent as a task. Suppression is silent to the customer.
 *
 * Amounts are RANGES with eligibility conditions attached, never single
 * figures, and never an approval. Demonstration data — amounts and terms are
 * illustrative and would be verified against each administrator in reality.
 */

import { DEFAULT_RULES } from "./settings";

export type ProgramType = "grant" | "forgivable" | "deferred" | "second-lien";
export type FundingState = "open" | "closed" | "waitlist";

export interface AssistanceProgram {
  id: string;
  name: string;
  administrator: string;
  type: ProgramType;
  /** Inclusive estimated range, in dollars. */
  min: number;
  max: number;
  /** null = statewide */
  county: string | null;
  funding: FundingState;
  reopens?: string;
  firstTimeOnly: boolean;
  incomeLimitNote: string;
  priceCapNote: string;
  conditions: string[];
  verifiedOn: string;
  verifiedBy: string;
  source: string;
}

/** Today, fixed so the prototype is deterministic. */
export const PROTO_TODAY = new Date("2026-09-06T12:00:00Z");

/**
 * The suppression window. It was a literal here and a stated open decision in
 * the handoff at the same time, which meant nobody owned it. The default now
 * lives with the other business rules and this reads it, so changing the rule
 * changes what customers are actually shown.
 */
export const STALE_AFTER_DAYS = DEFAULT_RULES.registryDays.value;

export const PROGRAMS: AssistanceProgram[] = [
  {
    id: "ga-dream",
    name: "Georgia Dream Homeownership Program",
    administrator: "Georgia Department of Community Affairs",
    type: "deferred",
    min: 10_000,
    max: 12_500,
    county: null,
    funding: "open",
    firstTimeOnly: true,
    incomeLimitNote: "Household income limits apply and vary by county and household size.",
    priceCapNote: "Purchase price caps apply and are updated periodically.",
    conditions: [
      "Must use a participating Georgia Dream lender",
      "Homebuyer education course required before closing",
      "Must occupy the home as a primary residence",
      "Minimum credit score and liquid asset limits apply",
    ],
    verifiedOn: "2026-08-19",
    verifiedBy: "Kaleb",
    source: "DCA program page and participating lender confirmation",
  },
  {
    id: "atlanta-hob",
    name: "Atlanta Housing Opportunity Bond down payment assistance",
    administrator: "Invest Atlanta",
    type: "forgivable",
    min: 10_000,
    max: 20_000,
    county: "Fulton",
    funding: "open",
    firstTimeOnly: true,
    incomeLimitNote: "Tiered by income band as a percentage of area median income.",
    priceCapNote: "Property must be inside the City of Atlanta limits.",
    conditions: [
      "Property must be within City of Atlanta boundaries",
      "Forgiven over a residency period — leaving early can trigger repayment",
      "Buyer contribution required from own funds",
      "Homebuyer education required",
    ],
    verifiedOn: "2026-08-19",
    verifiedBy: "Kaleb",
    source: "Invest Atlanta program listing",
  },
  {
    id: "dekalb-whd",
    name: "DeKalb County Workforce Enhancement / homebuyer assistance",
    administrator: "DeKalb County Community Development",
    type: "forgivable",
    min: 7_500,
    max: 10_000,
    county: "DeKalb",
    funding: "open",
    firstTimeOnly: true,
    incomeLimitNote: "Income at or below a set percentage of area median income.",
    priceCapNote: "Maximum purchase price set by the county and revised annually.",
    conditions: [
      "Property must be in unincorporated DeKalb or a participating city",
      "Five-year residency requirement for full forgiveness",
      "Counseling certificate required",
    ],
    verifiedOn: "2026-07-28",
    verifiedBy: "Kaleb",
    source: "County community development office, phone confirmation",
  },
  {
    id: "gwinnett-hap",
    name: "Gwinnett County Homestretch down payment assistance",
    administrator: "Gwinnett County",
    type: "deferred",
    min: 7_500,
    max: 10_000,
    county: "Gwinnett",
    funding: "closed",
    reopens: "Expected to reopen when the next allocation is released",
    firstTimeOnly: true,
    incomeLimitNote: "Income limits by household size.",
    priceCapNote: "Purchase price cap applies.",
    conditions: [
      "Funding is allocated in rounds and is currently exhausted",
      "Property must be located in Gwinnett County",
      "Homebuyer education required",
    ],
    verifiedOn: "2026-08-30",
    verifiedBy: "Kaleb",
    source: "County housing office notice",
  },
  {
    id: "cobb-dpa",
    name: "Cobb County down payment assistance",
    administrator: "Cobb County Community Development",
    type: "forgivable",
    min: 5_000,
    max: 10_000,
    county: "Cobb",
    funding: "waitlist",
    reopens: "Applications accepted to a waiting list",
    firstTimeOnly: true,
    incomeLimitNote: "Income limits by household size.",
    priceCapNote: "Purchase price cap applies.",
    conditions: ["Property must be in Cobb County", "Residency period applies", "Counseling required"],
    verifiedOn: "2026-08-11",
    verifiedBy: "Kaleb",
    source: "County program page",
  },
  {
    id: "fhlb-atl",
    name: "FHLB Atlanta First-time Homebuyer Product",
    administrator: "Federal Home Loan Bank of Atlanta, via member lenders",
    type: "grant",
    min: 12_500,
    max: 15_000,
    county: null,
    funding: "open",
    firstTimeOnly: true,
    incomeLimitNote: "At or below 80% of area median income.",
    priceCapNote: "No separate price cap; lender underwriting applies.",
    conditions: [
      "Must be originated through a participating FHLB member lender",
      "Matched savings requirement — buyer funds are matched at a set ratio",
      "Retention period applies",
      "Funds are released on a first-come basis each program year",
    ],
    verifiedOn: "2026-08-19",
    verifiedBy: "Kaleb",
    source: "Member lender confirmation",
  },
  {
    id: "employer-gift",
    name: "Employer assisted housing and gift funds",
    administrator: "Employer or family, via lender gift letter",
    type: "grant",
    min: 2_000,
    max: 8_000,
    county: null,
    funding: "open",
    firstTimeOnly: false,
    incomeLimitNote: "No income limit; depends entirely on the source.",
    priceCapNote: "None.",
    conditions: [
      "Gift funds require a documented gift letter acceptable to the lender",
      "Some employers offer forgivable housing benefits that go unclaimed",
      "Source of funds must be seasoned or documented",
    ],
    verifiedOn: "2026-06-02",
    verifiedBy: "Kaleb",
    source: "Lender guidance — general",
  },
  {
    id: "stale-example",
    name: "Legacy county assistance pilot",
    administrator: "Regional housing authority",
    type: "forgivable",
    min: 5_000,
    max: 8_000,
    county: "DeKalb",
    funding: "open",
    firstTimeOnly: true,
    incomeLimitNote: "Income limits apply.",
    priceCapNote: "Price cap applies.",
    conditions: ["Pilot program with limited allocation"],
    // Deliberately stale: demonstrates silent suppression + the agent task.
    verifiedOn: "2026-04-02",
    verifiedBy: "Kaleb",
    source: "Original program announcement",
  },
];

export function daysSinceVerified(p: AssistanceProgram, today = PROTO_TODAY) {
  const then = new Date(`${p.verifiedOn}T12:00:00Z`).getTime();
  return Math.floor((today.getTime() - then) / 86_400_000);
}

export function isStale(p: AssistanceProgram, today = PROTO_TODAY) {
  return daysSinceVerified(p, today) > STALE_AFTER_DAYS;
}

export interface MatchInput {
  county: string;
  firstTimeBuyer: boolean;
  /**
   * The programmes to match against. Defaults to the built-in registry, which
   * is what the specification runs on; production passes the rows read from
   * the database.
   *
   * Injected rather than imported so there is exactly ONE matcher. A separate
   * production copy would be the same twenty lines maintained twice, and the
   * first divergence would show up as two different assistance figures for the
   * same person depending on which surface they were looking at.
   */
  programs?: AssistanceProgram[];
  /** Defaults to the prototype's fixed date so the specification stays deterministic. */
  today?: Date;
}

export interface MatchResult {
  matched: AssistanceProgram[];
  suppressed: AssistanceProgram[];
  usableMin: number;
  usableMax: number;
  openMin: number;
  openMax: number;
}

/**
 * Match is deterministic and conservative: a program is shown only if it is
 * verified recently enough and its geography and first-time status fit.
 * Closed and waitlisted programs are shown WITH their state, never hidden —
 * "funding exhaustion is a first-class state".
 */
export function matchPrograms({ county, firstTimeBuyer, programs = PROGRAMS, today = PROTO_TODAY }: MatchInput): MatchResult {
  const geoFit = (p: AssistanceProgram) => p.county === null || p.county === county;
  const statusFit = (p: AssistanceProgram) => (p.firstTimeOnly ? firstTimeBuyer : true);

  const eligible = programs.filter((p) => geoFit(p) && statusFit(p));
  const matched = eligible.filter((p) => !isStale(p, today));
  const suppressed = eligible.filter((p) => isStale(p, today));
  const open = matched.filter((p) => p.funding === "open");

  return {
    matched,
    suppressed,
    usableMin: matched.reduce((s, p) => s + p.min, 0),
    usableMax: matched.reduce((s, p) => s + p.max, 0),
    openMin: open.reduce((s, p) => s + p.min, 0),
    openMax: open.reduce((s, p) => s + p.max, 0),
  };
}

export const GA_COUNTIES = ["DeKalb", "Fulton", "Gwinnett", "Cobb", "Clayton", "Henry", "Cherokee", "Douglas"];

export const FUNDING_LABEL: Record<FundingState, string> = {
  open: "Funding open",
  closed: "Funding closed",
  waitlist: "Waiting list",
};

export const TYPE_LABEL: Record<ProgramType, string> = {
  grant: "Grant — not repaid",
  forgivable: "Forgivable over time",
  deferred: "Deferred second loan",
  "second-lien": "Second lien",
};
