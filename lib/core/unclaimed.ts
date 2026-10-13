/**
 * Money a Georgia homeowner may be losing already (Blueprint v5 §5.3;
 * docs/audit/value-depth-2026-10.md §4.8).
 *
 * The best question on the site had the least computed answer. The old page
 * started from `SELLER_DEFAULTS`, so before anyone touched it it said "You
 * have owned this home about 11 years" (a default) and "Our records question
 * suggests no homestead exemption is on this parcel" (an unticked box; there
 * are no records). It asked the county and the home's worth and used neither.
 * And it showed "$600 to $1,400 per year" and "$1,100 to $3,200 per year" in
 * every county, with no source.
 *
 * This version answers only from what the person told us, in their words
 * ("You told us..."). The only dollar figures are the ones set in law: the
 * statewide homestead exemption and the home-sale exclusion. A county's own
 * exemptions and what any of it saves at that county's millage wait for the
 * county data set (audit §6), and until then the page says the tax
 * commissioner decides the amount rather than guessing it. Deadlines are
 * dates, worked out from today in Georgia.
 *
 * Pure: no I/O. `today` is passed in.
 */

import { daysBetween, georgiaDay } from "./day";

export interface UnclaimedAnswers {
  homestead: "yes" | "no" | "unsure";
  age65: "yes" | "no";
  /** The yearsOwned answer: 1 means less than two years. */
  yearsOwned: number;
}

export interface UnclaimedCheck {
  id: "homestead-file" | "homestead-check" | "senior" | "appeal" | "exclusion" | "two-years" | "prepayment";
  title: string;
  detail: string;
  /** Who is allowed to answer it. */
  decidedBy: string;
  /** A figure set in law, never an estimate of ours. */
  figure?: string;
  deadline?: { label: string; day?: string; days?: number };
}

/**
 * Homestead applications are due on or before April 1 to count for that
 * year's tax (O.C.G.A. § 48-5-45). The next April 1 on or after today in
 * Georgia.
 */
export function nextHomesteadDeadline(now: Date): { day: string; days: number } {
  const today = georgiaDay(now);
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-04-01`;
  const day = today <= thisYear ? thisYear : `${year + 1}-04-01`;
  return { day, days: daysBetween(today, day) };
}

/** The statewide exemption for county and school tax, before any county's own (O.C.G.A. § 48-5-44). */
export const STATEWIDE_HOMESTEAD = "$2,000";

const YEARS_LABEL: Record<number, string> = { 3: "two to five years", 8: "five to ten years", 15: "more than ten years" };

export function unclaimedChecks(a: UnclaimedAnswers, now: Date): UnclaimedCheck[] {
  const out: UnclaimedCheck[] = [];
  const april = nextHomesteadDeadline(now);
  const byApril = { label: "File by April 1", day: april.day, days: april.days };

  if (a.homestead === "no") {
    out.push({
      id: "homestead-file",
      title: "File for your homestead exemption",
      detail: `You told us it is not filed. If this is your main home, Georgia takes at least ${STATEWIDE_HOMESTEAD} off its assessed value for county and school tax, and most counties add more of their own. It is not backdated, so every year without it is a year of tax paid in full.`,
      figure: `At least ${STATEWIDE_HOMESTEAD} off the assessed value`,
      decidedBy: "your county tax commissioner",
      deadline: byApril,
    });
  } else if (a.homestead === "unsure") {
    out.push({
      id: "homestead-check",
      title: "Find out whether your homestead exemption is filed",
      detail: `You were not sure. Your county tax commissioner's property search shows it on your parcel, usually by address. If it is missing and this is your main home, filing takes at least ${STATEWIDE_HOMESTEAD} off the assessed value for county and school tax, and most counties add more.`,
      decidedBy: "your county tax commissioner",
      deadline: byApril,
    });
  }

  if (a.age65 === "yes") {
    out.push({
      id: "senior",
      title: "Ask about the senior exemptions",
      detail: "You told us someone who owns the home is 65 or older. Georgia has a statewide senior exemption with an income limit, and many counties reduce or remove school tax at 62, 65 or 70, some with no income test at all. None of them is automatic: each has to be applied for.",
      decidedBy: "your county tax commissioner",
      deadline: byApril,
    });
  }

  out.push({
    id: "appeal",
    title: "Compare your assessment notice with what the home would sell for",
    detail: "The notice the county sends each spring or summer states a fair market value. If it is higher than the home would realistically sell for, an appeal can lower the tax every year, whether or not you sell. The window is short and strictly enforced.",
    decidedBy: "your county board of assessors",
    deadline: { label: "45 days from the date on your notice" },
  });

  if (a.yearsOwned >= 2) {
    out.push({
      id: "exclusion",
      title: "The home-sale exclusion likely applies if you sell",
      detail: `You told us you have owned it ${YEARS_LABEL[a.yearsOwned] ?? `about ${a.yearsOwned} years`}. If you also lived in it for two of the last five years, that much gain from a sale is generally not taxed (26 U.S.C. § 121). Gains above it, and years it was rented out, are worth checking before you choose a date.`,
      figure: "Up to $250,000 single, $500,000 married filing jointly",
      decidedBy: "a tax preparer",
    });
  } else {
    out.push({
      id: "two-years",
      title: "Selling within two years of buying",
      detail: "You told us you have owned it less than two years. The home-sale exclusion generally needs two years of owning and living in it out of the last five; a partial one can apply after a move for work, health or circumstances you did not plan. Worth checking before you choose a date.",
      decidedBy: "a tax preparer",
    });
  }

  out.push({
    id: "prepayment",
    title: "Confirm there is no prepayment penalty on your loan",
    detail: "Uncommon on conventional loans, but not extinct, and far better found now than on a payoff statement three days before closing.",
    decidedBy: "your lender",
  });

  return out;
}
