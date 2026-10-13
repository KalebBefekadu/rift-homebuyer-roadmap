/**
 * County property tax and fair market rents: drafted records that a named
 * person verifies before any of them reaches a page (V1, Kaleb 13 Oct 2026;
 * docs/audit/value-depth-2026-10.md §6).
 *
 * The values asked the county and used it nowhere: property tax was a flat
 * 1% of the price in all 159 counties, and the abroad return's rent was a
 * ratio nobody had measured. These records replace both, one county at a
 * time, under the same rule as the assistance registry:
 *
 *   - An agent drafts each record from the county's or HUD's own published
 *     figures, names the source, and writes down anything missing or
 *     conflicting in `gap`.
 *   - Nothing is used until `verified` names the person who checked it
 *     against that source, and the day (handoff §4.13: nothing reaches
 *     verified without a named party). A record with a gap cannot be
 *     verified; fill the gap first.
 *   - Unverified, a page keeps the planning assumption it had and says the
 *     county's own figure is not verified yet. It never shows a draft.
 *
 * Verifying one is a one-line change here (set `verified`), and
 * lib/core/value-inputs.test.ts will then fail until the county is taken off
 * its list of questions that change nothing, which is the point.
 *
 * Drafted 13 October 2026 from web search summaries of the sources named;
 * the government pages themselves could not be opened from where this was
 * built, so every figure below must be checked at its source before
 * `verified` is set.
 *
 * Pure: no I/O.
 */

export interface Verified {
  /** The person who checked the record against its source. */
  by: string;
  /** ISO date. */
  on: string;
}

export interface CountyTaxRecord {
  county: string;
  /** The tax year the rates were set for. */
  taxYear: number;
  /**
   * Every levy on an unincorporated home, in mills (dollars per $1,000 of
   * assessed value): county, school, bonds, fire and special districts. Null
   * when the draft is incomplete; see `gap`.
   */
  totalMills: number | null;
  /** The levies found, as drafted. */
  parts: { label: string; mills: number }[];
  /** What is missing or conflicting. Null: nothing known to be. */
  gap: string | null;
  source: { name: string; url: string };
  verified: Verified | null;
}

/** Georgia assesses property at 40% of fair market value (O.C.G.A. § 48-5-7). */
export const ASSESSMENT_RATIO = 0.4;

export const COUNTY_TAX: CountyTaxRecord[] = [
  {
    county: "Gwinnett", taxYear: 2025, totalMills: 34.86,
    parts: [
      { label: "County", mills: 6.95 }, { label: "Schools", mills: 18.7 }, { label: "School bond", mills: 1.45 },
      { label: "Recreation", mills: 1 }, { label: "Fire and EMS", mills: 3.2 }, { label: "Police", mills: 2.9 },
      { label: "Development and code enforcement", mills: 0.36 }, { label: "Economic development", mills: 0.3 },
    ],
    gap: null,
    source: { name: "Gwinnett County Tax Commissioner, millage rates (unincorporated)", url: "https://gwinnetttaxcommissioner.com/property-tax/billing-information/millage-rates" },
    verified: null,
  },
  {
    county: "Forsyth", taxYear: 2025, totalMills: 24.522,
    parts: [
      { label: "County operations", mills: 4.791 }, { label: "Fire district", mills: 2.805 }, { label: "County bond", mills: 0.3 },
      { label: "Schools", mills: 15.208 }, { label: "School bond", mills: 1.418 },
    ],
    gap: "Confirm the fire district levy applies to every unincorporated parcel.",
    source: { name: "Forsyth County, commission adopts millage rates for 2025", url: "https://www.forsythco.com/News/forsyth-county-commission-adopts-millage-rates-2025" },
    verified: null,
  },
  {
    county: "DeKalb", taxYear: 2025, totalMills: null,
    parts: [{ label: "County, unincorporated (six levies)", mills: 20.81 }],
    gap: "The school rate conflicts between sources: 22.78 or 22.88 mills. Take it from the tax commissioner's 2025 table.",
    source: { name: "DeKalb County Tax Commissioner, Millage Rates 2025", url: "https://dekalbtaxga.gov/form-doc/millage-rates-2025/" },
    verified: null,
  },
  {
    county: "Cobb", taxYear: 2025, totalMills: null,
    parts: [{ label: "County general fund", mills: 8.46 }, { label: "Schools", mills: 18.7 }],
    gap: "Missing the other county levies (fire, debt service, parks). Take the unincorporated total from the Cobb County Tax Commissioner's millage table.",
    source: { name: "Cobb County School District, 2025 general fund five-year history of levy", url: "https://media.cobbk12.org/media/WWWCobb/medialib/2025-general-fund-5-year-history-of-levy.ef0da7113324.pdf" },
    verified: null,
  },
  {
    county: "Fulton", taxYear: 2025, totalMills: null,
    parts: [{ label: "County general fund", mills: 8.87 }, { label: "Schools", mills: 17.08 }],
    gap: "Missing any special district levies, and most of Fulton is now inside a city. Confirm the unincorporated total.",
    source: { name: "Fulton County, holds millage rate at 8.87 mills for 2025", url: "https://www.fultoncountyga.gov/News/2025/08/06/Fulton-Holds-Millage-Rate-at-8-87-mills-for-2025" },
    verified: null,
  },
  {
    county: "Clayton", taxYear: 2025, totalMills: null,
    parts: [{ label: "County general fund, net of the sales tax credit (proposed)", mills: 15.266 }, { label: "Fire (proposed)", mills: 4.146 }, { label: "Schools", mills: 19.6 }],
    gap: "The county figures are the budget book's proposals, set before the final digest. Take the adopted 2025 rates from the Clayton County Tax Commissioner.",
    source: { name: "Clayton County FY2025 budget book", url: "https://claytoncountyga.gov/wp-content/uploads/2024/06/FY2025-Budget-Book-Final_1.pdf" },
    verified: null,
  },
  {
    county: "Cherokee", taxYear: 2025, totalMills: null,
    parts: [{ label: "County operations, parks bond and fire (likely 2024)", mills: 8.311 }],
    gap: "The county figure may be 2024's, and the school rate was not found. Take both from the county finance department's millage rate information and the Board of Education.",
    source: { name: "Cherokee County FY2026 millage rate presentation", url: "https://www.cherokeecountyga.gov/Finance/_resources/Millage-Rate-Info/2026-Millage-Rate/FY2026-Millage-Rate-Presentation20260804v3.pdf" },
    verified: null,
  },
  {
    county: "Henry", taxYear: 2025, totalMills: null,
    parts: [{ label: "County general fund and special service district (proposed)", mills: 15.733 }, { label: "Schools, operations", mills: 20 }],
    gap: "The county rate was a proposal, the school rate may have been cut to 19.8, and the school bond rate was not found. Take the adopted 2025 rates from the Henry County Tax Commissioner.",
    source: { name: "Henry County Schools, millage rate hearings", url: "https://www.henry.k12.ga.us/henry-county-schools-news/post-details/~board/headlines-henry-county-schools-41434/post/henry-county-board-of-education-to-host-millage-rate-hearings" },
    verified: null,
  },
];

export interface RentRecord {
  /** HUD's name for the fair market rent area. */
  area: string;
  counties: string[];
  /** HUD's fiscal year, which starts on 1 October of the year before. */
  fiscalYear: number;
  /** Monthly fair market rent by bedrooms: studio, then one to four. */
  rents: [number, number, number, number, number] | null;
  gap: string | null;
  source: { name: string; url: string };
  verified: Verified | null;
}

export const RENTS: RentRecord[] = [
  {
    area: "Atlanta-Sandy Springs-Roswell, GA HUD Metro FMR Area",
    counties: ["Fulton", "DeKalb", "Cobb", "Gwinnett", "Clayton", "Cherokee", "Henry", "Forsyth", "Douglas", "Fayette", "Rockdale", "Paulding", "Newton"],
    fiscalYear: 2026,
    rents: null,
    gap: "Two summaries give FY2026 two- and three-bedroom rents of $1,820 and $2,182, and one says FY2027 rents of $1,762 and $2,099 took effect on 1 October 2026. Take all five FY2027 figures, and confirm the county list, from HUD.",
    source: { name: "HUD User, Fair Market Rents", url: "https://www.huduser.gov/portal/datasets/fmr.html" },
    verified: null,
  },
  {
    area: "Savannah, GA MSA",
    counties: ["Chatham", "Bryan", "Effingham"],
    fiscalYear: 2026,
    rents: [1_455, 1_533, 1_680, 2_235, 2_547],
    gap: "These are FY2026, read from HUD's schedule; FY2027 rents may have taken effect on 1 October 2026.",
    source: { name: "HUD FY2026 Schedule of Fair Market Rents", url: "https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY2026_FMR_Schedule.pdf" },
    verified: null,
  },
];

/** True only for a complete record that names who verified it. */
export const usable = (r: { verified: Verified | null; gap: string | null }): boolean =>
  r.verified !== null && r.verified.by.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(r.verified.on) && r.gap === null;

/** The county's verified tax record, or null. */
export function countyTax(county: string, records: CountyTaxRecord[] = COUNTY_TAX): CountyTaxRecord | null {
  const r = records.find((x) => x.county === county);
  return r && r.totalMills !== null && usable(r) ? r : null;
}

/** Property tax a year as a share of market value: mills on the 40% assessment. */
export const effectiveTaxPct = (r: CountyTaxRecord) => (r.totalMills! / 1000) * ASSESSMENT_RATIO * 100;

/**
 * The tax rate a value should use for a county, and where it came from. The
 * planning assumption when no verified record exists, said as such.
 */
export function taxFor(county: string, fallbackPct: number, records: CountyTaxRecord[] = COUNTY_TAX) {
  const r = countyTax(county, records);
  return r
    ? { pct: effectiveTaxPct(r), record: r, note: `${county} County's ${r.taxYear} rate: ${r.totalMills} mills on 40% of the value, before any homestead exemption. Checked by ${r.verified!.by}` }
    : { pct: fallbackPct, record: null, note: `About ${fallbackPct}% of the value a year. ${county} County's own rate is not verified yet` };
}

/** The verified fair market rent area for a county, or null. */
export function rentsFor(county: string, records: RentRecord[] = RENTS): RentRecord | null {
  const r = records.find((x) => x.counties.includes(county));
  return r && r.rents !== null && usable(r) ? r : null;
}
