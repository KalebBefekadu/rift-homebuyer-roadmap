/**
 * The Georgia assistance engine (Blueprint v5 §6, decision D17).
 *
 * One standard record per program, built from the administering
 * organization's own public pages (§6.6), never copied from another
 * database. Every record carries its official source, the day it was
 * checked, and when it is due to be checked again (§6.5).
 *
 * Matching is the product (§6.3): a buyer's answers are checked against each
 * program's rules, and each rule comes back as fits (✓), needs checking (△)
 * or does not fit. A rule the record does not know is never guessed: it is
 * "needs checking". Nothing here says "qualify" (§6.7).
 *
 * Combinations (§6.4) appear only when both programs' recorded rules allow
 * them; unknown compatibility is shown as unknown and never added up.
 *
 * Pure: no React, no I/O. Relative imports only, so scripts can load this
 * file directly with Node (scripts/generate-assistance-sql.mjs).
 */

import type { AssistanceProgram } from "./registry";

export type Occupation = "educator" | "safety" | "health" | "military";
export type LoanType = "fha" | "conventional" | "va" | "usda";
export type Funding = "open" | "closed" | "waitlist" | "confirm";

export interface ProgramRecord {
  slug: string;
  name: string;
  administrator: string;
  sourceType: "state" | "county" | "city" | "bank";
  /** How the money works, in words. */
  kind: "grant" | "forgivable" | "deferred" | "assistance";
  terms: string;
  amount: {
    /** Dollar cap. */
    max: number;
    /** A percentage of the price, capped at `max`. */
    pctOfPrice?: number;
    /** A percentage of the first mortgage, capped at `max` when set. */
    pctOfLoan?: number;
    /** A higher cap for these jobs. */
    occupations?: {
      max: number; who: Occupation[]; pctOfPrice?: number; note: string;
      /** The program's own word for who counts is narrower than the job
          question (Beltline's "civil servants"): the higher cap is mentioned,
          never used as the amount. */
      confirm?: boolean;
    };
  };
  area: {
    /** Counties the program can apply in; empty means statewide. */
    counties: string[];
    /** Where within them, when it is narrower than the county. */
    within?: string;
  };
  firstTime: "required" | "not-required" | "not-stated";
  firstTimeNote?: string;
  income:
    | { kind: "ami"; pct: 80 | 120 | 140; note?: string }
    | { kind: "two-sizes"; upTo2: number; threePlus: number; upTo: boolean; note?: string }
    | { kind: "flat"; max: number; note?: string }
    | { kind: "not-stated" };
  price: { max: number; upTo: boolean; note?: string } | null;
  minCredit: { score: number; note?: string } | null;
  loanTypes: LoanType[] | null;
  /** Only for people in these jobs. */
  onlyFor?: { who: Occupation[]; note: string };
  /** A condition the answers cannot settle, shown as needs checking. */
  alsoCheck?: string;
  /** Programs in the same group are alternatives: only one can be used. */
  group?: string;
  combines: "yes" | "no" | "unknown";
  combinesNote?: string;
  conditions: string[];
  funding: Funding;
  fundingNote?: string;
  sourceUrl: string;
  sourceName: string;
  /** The day the source was read. ISO date. */
  checkedOn: string;
  /** The date on the source itself, when it has one. */
  sourceDated?: string;
  /** "unverified": found, not yet confirmed from an official page; never shown. */
  status: "active" | "unverified";
  /** Why a record is not shown, when a person withdrew it (lib/core/program-check.ts). */
  withheldReason?: string;
}

/**
 * Atlanta-area income limits by household size (1 to 5 people), as Invest
 * Atlanta publishes them for its programs. Used for every program in the
 * eight metro counties that states its limit as a share of area median
 * income. Six or more people is not on the table, so it is "needs checking".
 */
export const ATL_AMI: Record<80 | 120 | 140, number[]> = {
  80: [66_000, 75_440, 84_880, 94_240, 101_840],
  120: [99_000, 113_160, 127_320, 141_360, 152_760],
  140: [115_500, 132_020, 148_540, 164_920, 178_220],
};
export const ATL_AMI_SOURCE = "https://www.investatlanta.com/homebuyers/homebuyer-programs-downpayment-assistance";

const CHECKED = "2026-09-24";
const GA_DREAM_SRC = "https://dca.georgia.gov/affordable-housing/home-ownership/georgia-dream-mortgage-products/georgia-dream";
const GA_DREAM_COMMON = {
  administrator: "Georgia Department of Community Affairs",
  sourceType: "state" as const,
  kind: "deferred" as const,
  terms: "A 0% second mortgage with no monthly payment, repaid when you sell, refinance or stop living in the home.",
  area: { counties: [] },
  firstTime: "required" as const,
  firstTimeNote: "Not owned and lived in a home in the last 3 years. Waived for U.S. military veterans, and in targeted areas.",
  income: { kind: "two-sizes" as const, upTo2: 137_555, threePlus: 158_188, upTo: true, note: "The highest limit; some counties' limits are lower." },
  price: { max: 625_000, upTo: true, note: "The highest limit; some counties' limits are lower." },
  minCredit: { score: 640, note: "660 for a manufactured home." },
  loanTypes: ["fha", "va", "usda", "conventional"] as LoanType[],
  group: "ga-dream",
  combines: "yes" as const,
  combinesNote: "Other down payment assistance is allowed, as a lien behind Georgia Dream's.",
  conditions: [
    "Use a Georgia Dream participating lender",
    "Put in at least $1,000 of your own money",
    "No more than $20,000, or 20% of the price, in savings left after closing (retirement accounts do not count)",
    "Homebuyer education from a HUD-approved agency before closing",
    "Single-family home, townhome or approved condo you will live in",
  ],
  funding: "open" as const,
  sourceUrl: GA_DREAM_SRC,
  sourceName: "Georgia Department of Community Affairs, Georgia Dream program matrix",
  checkedOn: CHECKED,
  sourceDated: "2026-07-08",
  status: "active" as const,
};

const INVEST_ATL = "https://www.investatlanta.com/homebuyers/homebuyer-programs-downpayment-assistance";
const INVEST_ATL_COMMON = {
  administrator: "Invest Atlanta",
  sourceType: "city" as const,
  kind: "forgivable" as const,
  firstTime: "not-stated" as const,
  price: null,
  minCredit: null,
  loanTypes: null,
  combines: "unknown" as const,
  funding: "confirm" as const,
  sourceUrl: INVEST_ATL,
  sourceName: "Invest Atlanta, Homebuyer Programs & Downpayment Assistance",
  checkedOn: CHECKED,
  status: "active" as const,
};

export const GEORGIA_PROGRAMS: ProgramRecord[] = [
  {
    ...GA_DREAM_COMMON,
    slug: "ga-dream",
    name: "Georgia Dream",
    amount: { max: 10_000, pctOfPrice: 5 },
  },
  {
    ...GA_DREAM_COMMON,
    slug: "ga-dream-pen",
    name: "Georgia Dream PEN (protectors, educators, nurses)",
    amount: { max: 12_500, pctOfPrice: 6 },
    onlyFor: { who: ["safety", "educator", "health"], note: "Currently working as a public protector, an educator, or in health care." },
  },
  {
    ...GA_DREAM_COMMON,
    slug: "ga-dream-choice",
    name: "Georgia Dream CHOICE",
    amount: { max: 12_500, pctOfPrice: 6 },
    alsoCheck: "Someone in the household has an eligible disability.",
  },
  {
    ...INVEST_ATL_COMMON,
    slug: "atl-homenow",
    name: "ATL HomeNOW",
    terms: "A forgivable loan with a 10-year affordability period.",
    amount: { max: 20_000 },
    area: { counties: ["Fulton", "DeKalb"], within: "Inside the City of Atlanta limits." },
    income: { kind: "ami", pct: 120 },
    conditions: ["Put in at least $1,500 of your own money", "Homebuyer education", "The home must be inside the City of Atlanta"],
  },
  {
    ...INVEST_ATL_COMMON,
    slug: "atl-beltline-map",
    name: "Beltline Mortgage Assistance Program",
    kind: "deferred",
    terms: "A 0% soft second mortgage with a 15-year affordability period.",
    amount: { max: 20_000, occupations: { max: 30_000, who: ["safety", "educator", "health", "military"], note: "Up to $30,000 for civil servants and legacy residents; Invest Atlanta decides whether your job counts.", confirm: true } },
    area: { counties: ["Fulton", "DeKalb"], within: "In the Beltline Tax Allocation District, subareas 1, 2, 3, 8, 9 and 10." },
    income: { kind: "ami", pct: 140, note: "Two income tiers, up to 120% and up to 140% of area median income." },
    conditions: ["Put in at least $1,500 of your own money", "Homebuyer education", "The home must be in an eligible Beltline subarea"],
  },
  {
    ...INVEST_ATL_COMMON,
    slug: "atl-perry-bolton",
    name: "Perry Bolton Mortgage Assistance Program",
    terms: "A forgivable loan with a 5-year affordability period.",
    amount: { max: 20_000 },
    area: { counties: ["Fulton"], within: "In the Perry Bolton Tax Allocation District." },
    income: { kind: "ami", pct: 120, note: "$20,000 up to 80% of area median income; $10,000 up to 120%." },
    conditions: ["Put in at least $1,500 of your own money", "A $1,000 program fee", "Homebuyer education"],
  },
  {
    ...INVEST_ATL_COMMON,
    slug: "atl-vine-city",
    name: "Vine City Renaissance Initiative",
    terms: "A forgivable loan with a 5-year affordability period.",
    amount: { max: 20_000 },
    area: { counties: ["Fulton"], within: "Within Vine City: Hollowell Pkwy, Northside Dr, MLK Jr. Dr and Joseph E. Lowery Blvd." },
    income: { kind: "ami", pct: 140 },
    combinesNote: "Can be used with a home renovation mortgage.",
    conditions: ["Put in at least $1,500 of your own money", "A $1,000 program fee", "A renovation homebuyer education class"],
  },
  {
    slug: "fulton-hop",
    name: "Fulton County Homeownership Program (HOP)",
    administrator: "Fulton County Department of Community Development",
    sourceType: "county",
    kind: "forgivable",
    terms: "A 0% deferred second mortgage with no monthly payment, forgiven over a 6- or 11-year affordability period while it stays your home.",
    amount: { max: 22_500, pctOfPrice: 7.5 },
    area: { counties: ["Fulton"], within: "Fulton County outside the City of Atlanta, Chattahoochee Hills, Johns Creek, Roswell, Sandy Springs and South Fulton." },
    firstTime: "required",
    firstTimeNote: "Not owned a home in the last 3 years.",
    income: { kind: "ami", pct: 80 },
    price: { max: 347_000, upTo: false, note: "$367,000 for a newly built home." },
    minCredit: { score: 600, note: "The county recommends 600; the lender sets the minimum." },
    loanTypes: null,
    combines: "unknown",
    combinesNote: "Federal HOME funds: the county reviews any other assistance before approving.",
    conditions: [
      "Use a HOP participating lender",
      "Put in at least $500 of your own money",
      "No more than $20,000, or 20% of the price, in savings (retirement accounts do not count)",
      "At least 8 hours of homebuyer education",
      "A real estate agent must represent you",
    ],
    funding: "confirm",
    sourceUrl: "https://www.fultoncountyga.gov/-/media/Departments/Community-Development/Homeownership-Program/Program-Overview-August-2025-HOP.pdf",
    sourceName: "Fulton County, HOP program overview and policy",
    checkedOn: CHECKED,
    sourceDated: "2025-08-01",
    status: "active",
  },
  {
    slug: "gwinnett-homestretch",
    name: "Gwinnett Homestretch Down Payment Assistance",
    administrator: "Gwinnett County",
    sourceType: "county",
    kind: "forgivable",
    terms: "A 0% deferred loan, forgiven after 5 years of living in the home.",
    amount: { max: 10_000 },
    area: { counties: ["Gwinnett"] },
    firstTime: "required",
    firstTimeNote: "Not owned a home for 3 years or more.",
    income: { kind: "ami", pct: 80 },
    price: { max: 371_000, upTo: false, note: "$425,000 for a newly built home, effective December 1, 2025." },
    minCredit: { score: 580, note: "At least one score above 580." },
    loanTypes: null,
    combines: "unknown",
    conditions: [
      "HUD-approved pre-purchase counseling class",
      "A single-family home or townhome that passes the county's inspection",
      "Housing costs at or under 43% of income, all debts at or under 55%",
    ],
    funding: "confirm",
    fundingNote: "The county set aside $200,000 for 2026, for at least 13 buyers.",
    sourceUrl: "https://www.gwinnettcounty.com/government/departments/planning-development/services/hud-programs/down-payment-assistance",
    sourceName: "Gwinnett County, Down Payment Assistance",
    checkedOn: CHECKED,
    status: "active",
  },
  {
    slug: "cobb-my-home",
    name: "Cobb County My Home Down Payment Assistance",
    administrator: "Housing Authority of Cobb County",
    sourceType: "county",
    kind: "grant",
    terms: "A grant, not repaid, of 0%, 1% or 2% of the first mortgage.",
    amount: { max: 0, pctOfLoan: 2 },
    area: { counties: ["Cobb"] },
    firstTime: "not-required",
    income: { kind: "flat", max: 159_880, note: "$90,800 with a Freddie Mac HFA Advantage loan." },
    price: null,
    minCredit: { score: 640, note: "640 for Freddie Mac HFA Advantage; 660 for FHA and VA." },
    loanTypes: ["fha", "va", "conventional"],
    combines: "unknown",
    conditions: [
      "Use a participating Cobb My Home lender, with a 30-year fixed first mortgage",
      "The home must be your main residence",
      "Cobb County and City of Marietta employees can get an extra grant",
    ],
    funding: "open",
    sourceUrl: "https://www.cobbcounty.gov/board/county-clerk/boards-authorities/housing-authority-cobb-county/mortgage-program",
    sourceName: "Housing Authority of Cobb County, and georgiabuyerdpa.com/cobb, which it names",
    checkedOn: CHECKED,
    status: "active",
  },
  {
    slug: "clayton-dpa",
    name: "Clayton County Down Payment Assistance",
    administrator: "Clayton County Office of Grants Administration",
    sourceType: "county",
    kind: "forgivable",
    terms: "An interest-free soft second loan, forgiven after 5 or 10 years in the home depending on the amount.",
    amount: { max: 7_500, occupations: { max: 10_000, who: ["safety", "health", "educator", "military"], note: "Up to $10,000 for veterans, law enforcement, first responders, health care and education workers, and Clayton County employees." } },
    area: { counties: ["Clayton"] },
    firstTime: "required",
    firstTimeNote: "Not owned a home in the last 3 years.",
    income: { kind: "ami", pct: 80, note: "HUD HOME limits effective June 1, 2026." },
    price: { max: 270_000, upTo: false },
    minCredit: null,
    loanTypes: null,
    combines: "unknown",
    conditions: [
      "Get a pre-approval from a HUD-certified lender",
      "Put in at least $1,000 of your own money (earnest money, inspection and appraisal count)",
      "An 8-hour HUD-approved homebuyer education class",
      "A single-family home you own outright (fee simple); no condos or mobile homes",
    ],
    funding: "confirm",
    sourceUrl: "https://hud.claytoncountyga.gov/down-payment-assistance-program/",
    sourceName: "Clayton County, Down Payment Assistance Program",
    checkedOn: CHECKED,
    status: "active",
  },
  {
    slug: "fhlb-first-time",
    name: "FHLBank Atlanta First-time Homebuyer Product",
    administrator: "Federal Home Loan Bank of Atlanta, through member banks and credit unions",
    sourceType: "bank",
    kind: "assistance",
    terms: "Down payment and closing cost help through a member lender; the lender explains the terms.",
    amount: { max: 17_500 },
    area: { counties: [] },
    firstTime: "required",
    income: { kind: "ami", pct: 80 },
    price: null,
    minCredit: null,
    loanTypes: null,
    group: "fhlb",
    combines: "unknown",
    conditions: ["Apply through an FHLBank Atlanta member bank or credit union"],
    funding: "confirm",
    fundingNote: "Funds are released each year and can run out.",
    sourceUrl: "https://corp.fhlbatl.com/services/affordable-housing-programs/homebuyers-and-homeowners/",
    sourceName: "FHLBank Atlanta, programs for homebuyers",
    checkedOn: CHECKED,
    status: "active",
  },
  {
    slug: "fhlb-community-partners",
    name: "FHLBank Atlanta Community Partners",
    administrator: "Federal Home Loan Bank of Atlanta, through member banks and credit unions",
    sourceType: "bank",
    kind: "assistance",
    terms: "Down payment and closing cost help through a member lender; the lender explains the terms.",
    amount: { max: 20_000 },
    area: { counties: [] },
    firstTime: "not-required",
    income: { kind: "not-stated" },
    price: null,
    minCredit: null,
    loanTypes: null,
    onlyFor: { who: ["safety", "educator", "health", "military"], note: "Law enforcement, educators, health care workers, firefighters and other first responders, veterans, active military and surviving spouses." },
    group: "fhlb",
    combines: "unknown",
    conditions: ["Apply through an FHLBank Atlanta member bank or credit union"],
    funding: "confirm",
    fundingNote: "Funds are released each year and can run out.",
    sourceUrl: "https://corp.fhlbatl.com/services/affordable-housing-programs/homebuyers-and-homeowners/",
    sourceName: "FHLBank Atlanta, programs for homebuyers",
    checkedOn: CHECKED,
    status: "active",
  },
  /* Found, not confirmed from an official page: the county's own pages for
     these return "not found" as of the day checked. Never shown until
     someone confirms them (§6.6). */
  {
    slug: "dekalb-homestart",
    name: "DeKalb HomeStart",
    administrator: "DeKalb County Office of Housing",
    sourceType: "county",
    kind: "forgivable",
    terms: "Not confirmed.",
    amount: { max: 0 },
    area: { counties: ["DeKalb"] },
    firstTime: "not-stated",
    income: { kind: "not-stated" },
    price: null, minCredit: null, loanTypes: null,
    combines: "unknown",
    conditions: [],
    funding: "confirm",
    sourceUrl: "https://dekalbcountyga.gov/government/chief-executive-officer/executive-cabinet/office-of-housing",
    sourceName: "DeKalb County Office of Housing (program details not published there)",
    checkedOn: CHECKED,
    status: "unverified",
  },
  {
    slug: "we-dekalb",
    name: "WE DeKalb",
    administrator: "Decide DeKalb Development Authority",
    sourceType: "county",
    kind: "grant",
    terms: "Not confirmed.",
    amount: { max: 0 },
    area: { counties: ["DeKalb"] },
    firstTime: "not-stated",
    income: { kind: "not-stated" },
    price: null, minCredit: null, loanTypes: null,
    combines: "unknown",
    conditions: [],
    funding: "confirm",
    sourceUrl: "https://www.decidedekalb.com/wedekalb/",
    sourceName: "Decide DeKalb (the page refused to load when checked)",
    checkedOn: CHECKED,
    status: "unverified",
  },
];

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

export interface Profile {
  county: string;
  /** null: not answered. */
  firstTime: boolean | null;
  price: number;
  income?: number;
  household?: number;
  occupation?: Occupation | "other";
}

export type CheckState = "fits" | "check" | "no";
export interface Check { label: string; state: CheckState; note: string }

export interface Match {
  program: ProgramRecord;
  /** Estimated for this price and these answers. */
  amount: number;
  amountNote: string | null;
  checks: Check[];
  /** True when nothing came back as "no". */
  potential: boolean;
  /** A larger variant that depends on something the answers do not settle. */
  alsoNote?: string;
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const OCC: Record<Occupation, string> = { educator: "people working in education", safety: "people working in public safety", health: "people working in health care", military: "the military and veterans" };

/** The day a record is due to be checked again, and whether it is past it. */
export function reviewDue(p: ProgramRecord, windowDays: number): string {
  const d = new Date(`${p.checkedOn}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + windowDays);
  return d.toISOString().slice(0, 10);
}
export const isCurrent = (p: ProgramRecord, today: Date, windowDays: number) =>
  p.status === "active" && reviewDue(p, windowDays) >= today.toISOString().slice(0, 10);

export function estimateAmount(p: ProgramRecord, profile: Pick<Profile, "price" | "occupation">): { amount: number; note: string | null } {
  const occ = p.amount.occupations;
  const inJob = !!(occ && profile.occupation && profile.occupation !== "other" && occ.who.includes(profile.occupation));
  const boosted = inJob && !occ!.confirm;
  const cap = boosted ? occ!.max : p.amount.max;
  const pct = boosted && occ!.pctOfPrice ? occ!.pctOfPrice : p.amount.pctOfPrice;
  if (pct) {
    const a = Math.min(cap, Math.round((profile.price * pct) / 100));
    return { amount: a, note: `${pct}% of the price, up to ${money(cap)}` };
  }
  if (p.amount.pctOfLoan) {
    /* The first mortgage is not known here; 96.5% of the price is the usual
       FHA loan, and the note says so. */
    const loan = profile.price * 0.965;
    const a = Math.round((loan * p.amount.pctOfLoan) / 100);
    return { amount: cap > 0 ? Math.min(cap, a) : a, note: `Up to ${p.amount.pctOfLoan}% of the first mortgage; about ${money(a)} on a ${money(loan)} loan` };
  }
  return { amount: cap, note: occ ? occ.note : null };
}

function incomeLimit(p: ProgramRecord, household: number | undefined): { limit: number | null; upTo: boolean; label: string } {
  const inc = p.income;
  if (inc.kind === "not-stated") return { limit: null, upTo: false, label: "Not stated on the program's page" };
  if (inc.kind === "flat") return { limit: inc.max, upTo: false, label: `Up to ${money(inc.max)}` };
  if (inc.kind === "two-sizes") {
    if (!household) return { limit: null, upTo: inc.upTo, label: `Up to ${money(inc.upTo2)} for 1 to 2 people, ${money(inc.threePlus)} for 3 or more` };
    const l = household <= 2 ? inc.upTo2 : inc.threePlus;
    return { limit: l, upTo: inc.upTo, label: `Up to ${money(l)} for ${household} ${household === 1 ? "person" : "people"}` };
  }
  const row = ATL_AMI[inc.pct];
  if (!household || household > row.length) return { limit: null, upTo: false, label: `${inc.pct}% of area median income` };
  return { limit: row[household - 1], upTo: false, label: `${inc.pct}% of area median income: ${money(row[household - 1])} for ${household}` };
}

export function checkProgram(p: ProgramRecord, profile: Profile): Match {
  const checks: Check[] = [];

  /* Where. */
  const statewide = p.area.counties.length === 0;
  if (!statewide && !p.area.counties.includes(profile.county)) {
    checks.push({ label: "Location", state: "no", note: `Only in ${p.area.counties.join(" and ")} County` });
  } else if (p.area.within) {
    checks.push({ label: "Location", state: "check", note: p.area.within });
  } else {
    checks.push({ label: "Location", state: "fits", note: statewide ? "Anywhere in Georgia" : `${profile.county} County` });
  }

  /* Who. */
  if (p.onlyFor) {
    const occ = profile.occupation;
    if (occ === undefined) checks.push({ label: "Work", state: "check", note: p.onlyFor.note });
    else if (occ !== "other" && p.onlyFor.who.includes(occ)) checks.push({ label: "Work", state: "fits", note: `Open to ${OCC[occ]}` });
    else checks.push({ label: "Work", state: "no", note: p.onlyFor.note });
  }
  if (p.alsoCheck) checks.push({ label: "Also", state: "check", note: p.alsoCheck });

  /* First-time buyer. */
  if (p.firstTime === "required") {
    if (profile.firstTime === true) checks.push({ label: "First-time buyer", state: "fits", note: p.firstTimeNote ?? "Required" });
    else if (profile.firstTime === null) checks.push({ label: "First-time buyer", state: "check", note: p.firstTimeNote ?? "Required" });
    else if (p.slug.startsWith("ga-dream") && profile.occupation === "military") {
      checks.push({ label: "First-time buyer", state: "check", note: "Waived for U.S. military veterans who have not had bond-financed help before." });
    } else checks.push({ label: "First-time buyer", state: "no", note: p.firstTimeNote ?? "Required" });
  } else if (p.firstTime === "not-required") {
    checks.push({ label: "First-time buyer", state: "fits", note: "Not required" });
  } else {
    checks.push({ label: "First-time buyer", state: "check", note: "Not stated on the program's page" });
  }

  /* Income. */
  const lim = incomeLimit(p, profile.household);
  if (lim.limit === null || profile.income === undefined) {
    checks.push({ label: "Income", state: "check", note: lim.label });
  } else if (profile.income > lim.limit) {
    checks.push({ label: "Income", state: "no", note: `${lim.label}; you said ${money(profile.income)}` });
  } else if (lim.upTo || profile.income > lim.limit * 0.95) {
    checks.push({ label: "Income", state: "check", note: `${lim.label}${lim.upTo ? ". Your county's limit may be lower" : ". You are close to it"}` });
  } else {
    checks.push({ label: "Income", state: "fits", note: lim.label });
  }
  const incomeNote = p.income.kind !== "not-stated" ? p.income.note : undefined;
  if (incomeNote && checks[checks.length - 1].state !== "no") checks[checks.length - 1].note += `. ${incomeNote}`;

  /* Price. */
  if (p.price) {
    const note = `Up to ${money(p.price.max)}${p.price.note ? `. ${p.price.note}` : ""}`;
    if (profile.price > p.price.max) checks.push({ label: "Price", state: "no", note });
    else checks.push({ label: "Price", state: p.price.upTo ? "check" : "fits", note });
  }

  /* Credit is not asked; the minimum is shown so it can be checked. */
  if (p.minCredit) checks.push({ label: "Credit score", state: "check", note: `${p.minCredit.score} or higher${p.minCredit.note ? `. ${p.minCredit.note}` : ""}` });

  if (p.funding !== "open") {
    const f = p.funding === "closed" ? "Funding is closed" : p.funding === "waitlist" ? "Waiting list only" : "Funding availability must be confirmed";
    checks.push({ label: "Funding", state: p.funding === "closed" ? "no" : "check", note: p.fundingNote ? `${f}. ${p.fundingNote}` : f });
  }

  const est = estimateAmount(p, profile);
  return { program: p, amount: est.amount, amountNote: est.note, checks, potential: checks.every((c) => c.state !== "no") };
}

export interface AssistanceResult {
  /** Potential matches, largest first, one per group. */
  matches: Match[];
  /** The largest single potential amount. */
  best: Match | null;
  /** The best combination both programs' rules allow, if any. */
  combination: { programs: [Match, Match]; total: number } | null;
  /** Programs past their review date: withheld, with the reason (§6 acceptance). */
  withheld: ProgramRecord[];
}

export function matchAssistance(profile: Profile, opts: { today: Date; windowDays: number; programs?: ProgramRecord[] }): AssistanceResult {
  /* Withdrawn by a reviewer counts as withheld, so the page can say that
     something exists and is being re-checked, never silently less. */
  const all = (opts.programs ?? GEORGIA_PROGRAMS).filter((p) => p.status === "active" || p.withheldReason);
  const current = all.filter((p) => isCurrent(p, opts.today, opts.windowDays));
  const withheld = all.filter((p) => !isCurrent(p, opts.today, opts.windowDays));

  const potential = current.map((p) => checkProgram(p, profile)).filter((m) => m.potential);
  /* One per group: Georgia Dream's variants are one program at three sizes. */
  const byGroup = new Map<string, Match>();
  const singles: Match[] = [];
  /* A variant that depends on something not asked (a disability in the
     household) never displaces one the answers support; it is mentioned on
     it instead. */
  const conditional = potential.filter((m) => m.program.group && m.program.alsoCheck);
  for (const m of potential) {
    const g = m.program.group;
    if (!g) { singles.push(m); continue; }
    if (m.program.alsoCheck) continue;
    const had = byGroup.get(g);
    if (!had || m.amount > had.amount) byGroup.set(g, m);
  }
  for (const c of conditional) {
    const g = c.program.group!;
    const had = byGroup.get(g);
    if (!had) byGroup.set(g, c);
    else if (c.amount > had.amount) had.alsoNote = `Up to ${money(c.amount)} with ${c.program.name} if: ${c.program.alsoCheck!.replace(/\.$/, "").toLowerCase()}.`;
  }
  const matches = [...singles, ...byGroup.values()].sort((a, b) => b.amount - a.amount);

  let combination: AssistanceResult["combination"] = null;
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i], b = matches[j];
      if (a.program.combines !== "yes" || b.program.combines !== "yes") continue;
      if (a.program.group && a.program.group === b.program.group) continue;
      const total = a.amount + b.amount;
      if (!combination || total > combination.total) combination = { programs: [a, b], total };
    }
  }

  /* The headline is the largest program the answers place them in without
     conditions on where the home is; one limited to part of a county is
     listed, and said, but does not become the number at the top. */
  const placed = matches.find((m) => m.checks.find((c) => c.label === "Location")?.state === "fits");
  return { matches, best: placed ?? matches[0] ?? null, combination, withheld };
}

/* ------------------------------------------------------------------ *
 * The older shape
 * ------------------------------------------------------------------ */

/**
 * Whether the older readout's matcher, which knows only county and
 * first-time status, can check this record honestly. A program for certain
 * jobs, one that depends on something never asked, or one limited to part of
 * a county would be counted for everyone in it; those stay with the
 * assistance value, which asks.
 */
export const legacyCanCheck = (p: ProgramRecord) =>
  p.status === "active" && !p.onlyFor && !p.alsoCheck && !p.area.within && p.area.counties.length <= 1;

const moneyWords = (n: number) => `$${n.toLocaleString("en-US")}`;

/** A record in the older registry's shape: one converter, used by the migration generator and the database reader alike. */
export function toLegacy(p: ProgramRecord): AssistanceProgram {
  const top = Math.max(p.amount.max, p.amount.occupations?.max ?? 0);
  const i = p.income;
  return {
    id: p.slug,
    name: p.name,
    administrator: p.administrator,
    type: p.kind,
    /* A share of the price or the loan depends on the home: the range starts at 0. */
    min: p.amount.pctOfPrice || p.amount.pctOfLoan ? 0 : p.amount.max,
    max: top,
    county: p.area.counties[0] ?? null,
    funding: p.funding,
    firstTimeOnly: p.firstTime === "required",
    incomeLimitNote: i.kind === "ami" ? `At or below ${i.pct}% of area median income.`
      : i.kind === "flat" ? `Household income up to ${moneyWords(i.max)}.`
      : i.kind === "two-sizes" ? `Up to ${moneyWords(i.upTo2)} for 1 to 2 people and ${moneyWords(i.threePlus)} for 3 or more; some counties are lower.`
      : "Not stated on the program's page.",
    priceCapNote: p.price ? `Up to ${moneyWords(p.price.max)}.` : "No limit stated.",
    conditions: p.conditions,
    verifiedOn: p.checkedOn,
    verifiedBy: OFFICIAL_SOURCE,
    source: p.sourceName,
  };
}

export const KIND_LABEL: Record<ProgramRecord["kind"], string> = {
  grant: "Grant, not repaid",
  forgivable: "Forgivable loan",
  deferred: "Deferred loan, repaid later",
  assistance: "Assistance through a lender",
};

export const FUNDING_TEXT: Record<Funding, string> = {
  open: "Funding open",
  closed: "Funding closed",
  waitlist: "Waiting list",
  confirm: "Confirm availability",
};

/**
 * Who "verified" a record read from the program's own page. Not a person, so
 * nothing may render it as one ("confirmed with ..."); the older readout
 * checks for this value (handoff §4.13).
 */
export const OFFICIAL_SOURCE = "the official source";

export const CAUTION =
  "Program terms and funding availability may change. Confirm current eligibility with the program administrator or a participating lender before relying on this information.";
