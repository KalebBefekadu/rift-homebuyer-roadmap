/**
 * How Operations reads one assistance record (Blueprint v5 §6.5, §8.4).
 *
 * The Programs page used to show three dates per row (last checked, due by,
 * latest reading) and left the agent to work out from them whether a buyer
 * could see the program. The answer is one of four states, and the dates only
 * matter when one of them says something needs doing. Everything here is
 * worked out from the record and its checks, so the list, the detail page and
 * any later page cannot word the same program two ways.
 *
 * Pure: no I/O. Relative imports only, like assistance.ts.
 */

import { isCurrent, reviewDue, KIND_LABEL, type Occupation, type ProgramRecord } from "./assistance";
import type { CheckOutcome, ReviewOutcome, SourceCheck, SourceReview } from "./program-check";
import { daysBetween, georgiaDay } from "./day";
import { money } from "./compute";

/* ------------------------------------------------------------------ *
 * Whether a buyer sees it
 * ------------------------------------------------------------------ */

export type BuyerStatus = "shown" | "overdue" | "unconfirmed" | "withdrawn";

/**
 * The one answer to "does a buyer see this". A withdrawal is checked first:
 * applyChecks marks a withdrawn record "unverified" as well, and calling it
 * "not confirmed" would hide that a person stopped it on purpose.
 */
export function buyerStatus(p: ProgramRecord, today: Date, windowDays: number): BuyerStatus {
  if (p.withheldReason) return "withdrawn";
  if (p.status === "unverified") return "unconfirmed";
  return isCurrent(p, today, windowDays) ? "shown" : "overdue";
}

export const STATUS_LABEL: Record<BuyerStatus, string> = {
  shown: "Shown to buyers",
  overdue: "Withheld: overdue for a check",
  unconfirmed: "Not confirmed",
  withdrawn: "Withdrawn",
};

/** Shown first, then what needs a person, then what was never live. */
export const STATUS_ORDER: Record<BuyerStatus, number> = { shown: 0, overdue: 1, withdrawn: 2, unconfirmed: 3 };

/** Why the status is what it is, in a sentence for the detail page. */
export function statusWhy(p: ProgramRecord, today: Date, windowDays: number): string {
  const s = buyerStatus(p, today, windowDays);
  if (s === "withdrawn") return `${p.withheldReason}. Buyers do not see it until its record is edited and deployed.`;
  if (s === "unconfirmed") return "Found, but not yet confirmed from the administrator's own page, so it has never been shown to a buyer.";
  if (s === "overdue") return `Not confirmed against its official page within ${windowDays} days, so buyers are not shown it. Buyers are told some programs are being re-checked.`;
  return `Confirmed against its official page within the last ${windowDays} days.`;
}

/* ------------------------------------------------------------------ *
 * The one line about checking
 * ------------------------------------------------------------------ */

export type LineTone = "quiet" | "warn" | "neg";

const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/**
 * One line in place of the three date columns. It stays quiet while the
 * weekly check is keeping the record current, and only raises its voice when
 * a person has something to do: a page changed or could not be read, the
 * record aged out, or someone withdrew it.
 *
 * `flag` is the open, unreviewed reading for the program's page, if any. A
 * flagged record is not renewed until someone answers, so the flag says more
 * than the date does.
 */
export function checkLine(p: ProgramRecord, today: Date, windowDays: number, flag: CheckOutcome | null = null): { text: string; tone: LineTone } {
  const s = buyerStatus(p, today, windowDays);
  if (s === "withdrawn") return { text: "Withdrawn until its record is edited", tone: "neg" };
  if (s === "unconfirmed") return { text: "Never confirmed from an official page", tone: "quiet" };
  const day = georgiaDay(today);
  if (flag === "changed") return { text: "Page changed: waiting for your review", tone: "warn" };
  if (flag === "unreachable") return { text: "Page could not be read: waiting for your review", tone: "warn" };
  if (s === "overdue") {
    const late = daysBetween(reviewDue(p, windowDays), day);
    return { text: late <= 0 ? "Check overdue" : `Check overdue by ${late} ${late === 1 ? "day" : "days"}`, tone: "neg" };
  }
  const since = daysBetween(p.checkedOn, day);
  const left = daysBetween(day, reviewDue(p, windowDays));
  /* A fortnight is two missed Mondays: the point at which "the job will
     renew it" stops being a safe assumption and the agent should know. */
  if (left <= 14) return { text: `Checked ${ago(since)}; withheld in ${left} ${left === 1 ? "day" : "days"} unless renewed`, tone: "warn" };
  return { text: `Checked ${ago(since)}`, tone: "quiet" };
}

/* ------------------------------------------------------------------ *
 * The amount
 * ------------------------------------------------------------------ */

export interface AmountView {
  /** The figure itself: "$10,000", or "2% of the loan" when there is no dollar cap. */
  headline: string;
  /** How it is worked out, when it is not a flat figure. */
  basis: string | null;
  /** A higher amount for some jobs, and whether a buyer's estimate ever uses it. */
  higher: { text: string; counted: boolean } | null;
  /** The most a buyer can be shown, for sorting and the largest-amount figure. Zero when none is on the record. */
  counted: number;
}

const JOB: Record<Occupation, string> = {
  educator: "educators",
  safety: "public safety",
  health: "health care",
  military: "military and veterans",
};
export const jobsText = (who: Occupation[]) => who.map((w) => JOB[w]).join(", ");

/**
 * The amount as the record states it. A higher amount for some jobs is
 * counted only when the record lets a buyer's answers settle it: when it is
 * marked `confirm` (Beltline's "public-sector employees"), estimateAmount
 * never uses it, so it is mentioned and never counted here either.
 */
export function amountView(p: ProgramRecord): AmountView {
  const a = p.amount;
  const occ = a.occupations;
  const higher = occ
    ? {
        text: `${money(occ.max)}${occ.pctOfPrice ? ` (${occ.pctOfPrice}% of the price)` : ""} for ${jobsText(occ.who)}`,
        counted: !occ.confirm,
      }
    : null;
  const counted = Math.max(a.max, occ && !occ.confirm ? occ.max : 0);
  if (!a.max && a.pctOfLoan) return { headline: `${a.pctOfLoan}% of the loan`, basis: "Of the first mortgage; no dollar cap on the record", higher, counted: 0 };
  if (!a.max) return { headline: "Not on the record", basis: null, higher, counted: 0 };
  const basis = a.pctOfPrice ? `${a.pctOfPrice}% of the price, up to this`
    : a.pctOfLoan ? `${a.pctOfLoan}% of the first mortgage, up to this`
    : null;
  return { headline: money(a.max), basis, higher, counted };
}

/** The largest amount a buyer can be shown today, and the program it comes from. */
export function largestShown(ps: ProgramRecord[], today: Date, windowDays: number): { amount: number; program: ProgramRecord } | null {
  let best: { amount: number; program: ProgramRecord } | null = null;
  for (const p of ps) {
    if (buyerStatus(p, today, windowDays) !== "shown") continue;
    const n = amountView(p).counted;
    if (n > 0 && (!best || n > best.amount)) best = { amount: n, program: p };
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Who it is for, in a few words
 * ------------------------------------------------------------------ */

export function incomeText(p: ProgramRecord): string | null {
  const i = p.income;
  if (i.kind === "ami") return `Income up to ${i.pct}% of area median`;
  if (i.kind === "flat") return `Income up to ${money(i.max)}`;
  if (i.kind === "two-sizes") return `Income up to ${money(i.upTo2)} to ${money(i.threePlus)}, by household`;
  return null;
}

export function priceText(p: ProgramRecord): string | null {
  if (!p.price) return null;
  return `Price up to ${money(p.price.max)}${p.price.newBuildMax ? ` (${money(p.price.newBuildMax)} new build)` : ""}`;
}

/**
 * The rules that decide most cases, shortest first to read. Credit, loan type
 * and the conditions list are on the detail page: they are checked with the
 * lender, not used to rule a buyer in or out on sight.
 */
export function keyRules(p: ProgramRecord): string[] {
  const out: string[] = [];
  if (p.onlyFor) out.push(`Only for ${jobsText(p.onlyFor.who)}`);
  if (p.firstTime === "required") out.push("First-time buyers");
  else if (p.firstTime === "not-required") out.push("Any buyer, not only first-time");
  const inc = incomeText(p);
  if (inc) out.push(inc);
  const price = priceText(p);
  if (price) out.push(price);
  if (p.alsoCheck) out.push(p.alsoCheck.replace(/\.$/, ""));
  return out;
}

export const formText = (p: ProgramRecord) => KIND_LABEL[p.kind];

/* ------------------------------------------------------------------ *
 * Where, and the groups on the list
 * ------------------------------------------------------------------ */

/**
 * Cities by the organization that runs their programs. The records say
 * `sourceType: "city"` and name the administrator, not the city; this is the
 * one place that knows Invest Atlanta is the City of Atlanta's. A city not
 * listed here is grouped under its administrator's name rather than guessed.
 */
const CITY_OF: Record<string, string> = { "Invest Atlanta": "City of Atlanta" };

export interface AreaGroup { key: string; label: string; programs: ProgramRecord[] }

export function areaGroupOf(p: ProgramRecord): { key: string; label: string; order: number } {
  if (p.area.counties.length === 0) return { key: "statewide", label: "Statewide", order: 0 };
  if (p.sourceType === "city") {
    const label = CITY_OF[p.administrator] ?? p.administrator;
    return { key: `city:${label}`, label, order: 1 };
  }
  /* One group for every county program, not one per county: most counties
     run a single program, and a heading per card read as a list of headings.
     Each card names its county. */
  return { key: "counties", label: "County programs", order: 2 };
}

/** Statewide first, then cities, then county programs. Order inside a group is the caller's. */
export function groupByArea(ps: ProgramRecord[]): AreaGroup[] {
  const groups = new Map<string, AreaGroup & { order: number }>();
  for (const p of ps) {
    const g = areaGroupOf(p);
    const had = groups.get(g.key);
    if (had) had.programs.push(p);
    else groups.set(g.key, { key: g.key, label: g.label, order: g.order, programs: [p] });
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ key, label, programs }) => ({ key, label, programs }));
}

/** Where it applies, in the record's own words when it is narrower than a county. */
export function areaText(p: ProgramRecord): string {
  if (p.area.within) return p.area.within.replace(/\.$/, "");
  if (p.area.counties.length === 0) return "Anywhere in Georgia";
  return `All of ${p.area.counties.join(" and ")} ${p.area.counties.length === 1 ? "County" : "counties"}`;
}

/* ------------------------------------------------------------------ *
 * The check history of one page
 * ------------------------------------------------------------------ */

export const READING_LABEL: Record<CheckOutcome, string> = {
  baseline: "First reading",
  unchanged: "Unchanged",
  changed: "Changed",
  unreachable: "Could not be read",
};

export const REVIEW_LABEL: Record<ReviewOutcome, string> = {
  "still-right": "The record is still right",
  "needs-update": "Needs updating: withdrawn",
};

export interface HistoryEntry { check: SourceCheck; review: SourceReview | null }

/** Every reading of one official page, newest first, each with its review when it has one. */
export function historyFor(sourceUrl: string, checks: SourceCheck[], reviews: SourceReview[]): HistoryEntry[] {
  const byCheck = new Map(reviews.map((r) => [r.checkId, r]));
  return checks
    .filter((c) => c.sourceUrl === sourceUrl)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .map((check) => ({ check, review: byCheck.get(check.id) ?? null }));
}

/* ------------------------------------------------------------------ *
 * What changed on a page, the part worth reading
 * ------------------------------------------------------------------ */

const MONEY = /\$\s?\d/;
const PERCENT = /\d\s?%/;
/* Weaker figures: a count with thousands, a year, a length of time, a
   household size, a calendar date. Menus are full of years ("2024 QAP
   Documents"), so these count only in a sentence. */
const FIGURE = /\b\d{1,3}(,\d{3})+\b|\b(19|20)\d{2}\b|\b\d+\s?(years?|months?|days?|hours?|people|persons?)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i;
/* The words the record's facts are written in: amounts, limits, who, when, funding. */
const TERMS = /\b(income|limits?|price|eligib\w*|first[- ]time|funds?|funding|grants?|loans?|forgiv\w*|defer\w*|repa\w*|credit|score|apply|applications?|deadline|effective|closed?|waitlist|waiting list|median|ami|household|down ?payment|closing costs?|minimum|maximum|up to|required?|must|lenders?|education|veterans?|educators?|teachers?|nurses?)\b/i;
const BOILERPLATE = /©|copyright|all rights reserved|privacy policy|terms of use|cookie|toggle|skip to|navigation|\bmenu\b/i;

/**
 * Whether one changed line of an official page could bear on the record.
 *
 * A state or county site's text is mostly its menu: "Home", "Pay a Bill",
 * "2024 QAP Scoring Documents and Data". A line-by-line difference of a page
 * whose menu was rebuilt lists dozens of those, and the one line that moved
 * the price cap is somewhere in the middle. Menus and headings are short and
 * mostly capitalised; the facts a record holds are written in sentences. So a
 * dollar figure always counts, a share of something counts beside one of the
 * record's words or in a sentence, a year or date counts in a sentence that
 * uses one of the record's words or runs to five words, and
 * any other line needs one of the record's words and six words of sentence.
 */
export function isMeaningfulLine(line: string): boolean {
  const text = line.trim();
  if (!text || BOILERPLATE.test(text)) return false;
  if (MONEY.test(text)) return true;
  const words = text.split(/\s+/);
  const sentence = words.filter((w) => /^[A-Z]/.test(w)).length / words.length <= 0.6;
  const terms = TERMS.test(text);
  if (PERCENT.test(text)) return terms || sentence;
  if (FIGURE.test(text)) return sentence && (terms || words.length >= 5);
  return terms && sentence && words.length >= 6;
}

export interface ChangeView {
  /** The lines worth reading first, from each side. */
  removed: string[];
  added: string[];
  /** Every changed line, for "show all". */
  all: { removed: string[]; added: string[] };
  total: number;
}

/** A line difference split into what bears on a record and everything else. */
export function changeView(diff: { removed: string[]; added: string[] }): ChangeView {
  return {
    removed: diff.removed.filter(isMeaningfulLine),
    added: diff.added.filter(isMeaningfulLine),
    all: diff,
    total: diff.removed.length + diff.added.length,
  };
}
