/**
 * The questions the values ask, and how each answer travels.
 *
 * One definition per answer (Blueprint v5 §5.1): an answer given to one value
 * is reused by every other, so the wording, the choices and the limits live
 * here once. A value page reads its answers from the address, validates them
 * with `parseAnswers`, and computes on the server; nothing here is trusted
 * because it came from our own form.
 *
 * Money questions (§5.6, Kaleb R2): a slider covers the common range and the
 * figure can always be typed, up to the ceilings below. The old sliders
 * stopped at $700,000 for price, which asked "what if I want $1,000,000?".
 *
 * Pure: no React, no I/O.
 */

import { GA_COUNTIES } from "./registry";
import type { InputKey } from "./values";

export type AskType = "choice" | "money";

export interface AskOption { value: string; label: string; hint?: string }

export interface AskDef {
  key: InputKey;
  /** Short key in the address. Distinct across every side. */
  param: string;
  type: AskType;
  /** The question, in the person's words. */
  title: string;
  /** Why it is asked, when that is not obvious. */
  why?: string;
  options?: AskOption[];
  /** Money: the slider's common range, and the hard limits a typed figure must sit inside. */
  slider?: { min: number; max: number; step: number };
  limits?: { min: number; max: number };
  /** Money: the label beside the figure. */
  unitLabel?: string;
  /** What a value assumes before this is answered. Never shown as an answer. */
  fallback: string | number;
}

const OWNERSHIP: AskOption[] = [
  { value: "none", label: "No, I haven't owned a home" },
  { value: "primary", label: "Yes, a home I lived in" },
  { value: "investment", label: "Yes, but only a rental or investment property" },
];

export const ASKS: Record<InputKey, AskDef> = {
  county: {
    key: "county", param: "c", type: "choice",
    title: "Which Georgia county?",
    why: "Taxes, fees and most assistance programs are set county by county.",
    options: GA_COUNTIES.map((c) => ({ value: c, label: c })),
    fallback: "DeKalb",
  },
  ownership: {
    key: "ownership", param: "o", type: "choice",
    title: "Have you owned a home in the last three years?",
    why: "Many programs count you as a first-time buyer if you have not owned the home you lived in for three years.",
    options: OWNERSHIP,
    fallback: "none",
  },
  price: {
    key: "price", param: "p", type: "money",
    title: "What price are you thinking about?",
    why: "A rough figure is fine. You can change it on the answer.",
    slider: { min: 100_000, max: 1_000_000, step: 5_000 },
    limits: { min: 50_000, max: 5_000_000 },
    unitLabel: "Home price",
    fallback: 325_000,
  },
  downPct: {
    key: "downPct", param: "d", type: "choice",
    title: "How much would you put down?",
    why: "Not sure? 3.5% is the usual FHA minimum, and 3% is possible on some conventional loans.",
    options: [
      { value: "3", label: "3%", hint: "Some conventional loans" },
      { value: "3.5", label: "3.5%", hint: "The FHA minimum" },
      { value: "5", label: "5%" },
      { value: "10", label: "10%" },
      { value: "20", label: "20%", hint: "No mortgage insurance" },
    ],
    fallback: "3.5",
  },
  savings: {
    key: "savings", param: "s", type: "money",
    title: "How much have you saved for this so far?",
    why: "Only you see this. It decides how far away you are, not whether you can buy.",
    slider: { min: 0, max: 150_000, step: 500 },
    limits: { min: 0, max: 5_000_000 },
    unitLabel: "Saved so far",
    fallback: 9_000,
  },
  monthlySaving: {
    key: "monthlySaving", param: "r", type: "money",
    title: "How much can you put aside each month?",
    slider: { min: 0, max: 5_000, step: 50 },
    limits: { min: 0, max: 100_000 },
    unitLabel: "Each month",
    fallback: 650,
  },
  income: {
    key: "income", param: "i", type: "money",
    title: "What is your household's income before tax, per year?",
    why: "Most programs have income limits. Only you see this, and it is never used for anything else.",
    slider: { min: 20_000, max: 300_000, step: 1_000 },
    limits: { min: 0, max: 5_000_000 },
    unitLabel: "Household income",
    fallback: 75_000,
  },
  household: {
    key: "household", param: "h", type: "choice",
    title: "How many people will live in the home?",
    why: "Income limits go up with household size.",
    options: ["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => ({ value: n, label: n === "8" ? "8 or more" : n })),
    fallback: "2",
  },
  credit: {
    key: "credit", param: "k", type: "choice",
    title: "Roughly what is your credit score?",
    why: "Programs set a minimum. A guess is fine; nobody checks your credit here.",
    options: [
      { value: "560", label: "Below 580" },
      { value: "600", label: "580 to 619" },
      { value: "630", label: "620 to 639" },
      { value: "660", label: "640 to 679" },
      { value: "700", label: "680 to 719" },
      { value: "740", label: "720 or higher" },
      { value: "0", label: "I don't know" },
    ],
    fallback: "0",
  },
  occupation: {
    key: "occupation", param: "j", type: "choice",
    title: "Do you work in any of these?",
    why: "Some programs are only for these jobs.",
    options: [
      { value: "educator", label: "Teacher or school staff" },
      { value: "safety", label: "Police, fire or emergency services" },
      { value: "health", label: "Healthcare" },
      { value: "military", label: "Military or veteran" },
      { value: "other", label: "None of these" },
    ],
    fallback: "other",
  },
  loanType: {
    key: "loanType", param: "l", type: "choice",
    title: "What kind of loan are you planning?",
    options: [
      { value: "fha", label: "FHA" },
      { value: "conventional", label: "Conventional" },
      { value: "va", label: "VA" },
      { value: "usda", label: "USDA" },
      { value: "unsure", label: "Not sure yet" },
    ],
    fallback: "unsure",
  },
  payoff: {
    key: "payoff", param: "po", type: "money",
    title: "How much do you still owe on the home?",
    why: "Your loan balance. Nothing if it is paid off.",
    slider: { min: 0, max: 900_000, step: 5_000 },
    limits: { min: 0, max: 5_000_000 },
    unitLabel: "Still owed",
    fallback: 180_000,
  },
  commission: {
    key: "commission", param: "cm", type: "choice",
    title: "What total commission have you agreed, or been quoted?",
    why: "Commission is negotiated, and there is no standard rate. Count both agents' share if you would pay both. Not agreed yet is a fine answer.",
    options: [
      { value: "3", label: "3%" },
      { value: "4", label: "4%" },
      { value: "5", label: "5%" },
      { value: "5.5", label: "5.5%" },
      { value: "6", label: "6%" },
      { value: "none", label: "Not agreed yet", hint: "We'll show a range, not a guess" },
    ],
    fallback: "none",
  },
  yearsOwned: {
    key: "yearsOwned", param: "yo", type: "choice",
    title: "How long have you owned it?",
    options: [
      { value: "1", label: "Less than 2 years" },
      { value: "3", label: "2 to 5 years" },
      { value: "8", label: "5 to 10 years" },
      { value: "15", label: "More than 10 years" },
    ],
    fallback: "8",
  },
  homestead: {
    key: "homestead", param: "hs", type: "choice",
    title: "Have you filed for a homestead exemption?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "I'm not sure" },
    ],
    fallback: "unsure",
  },
  age65: {
    key: "age65", param: "a6", type: "choice",
    title: "Is anyone who owns the home 65 or older?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    fallback: "no",
  },
  status: {
    key: "status", param: "st", type: "choice",
    title: "Which describes you?",
    options: [
      { value: "citizen", label: "U.S. citizen living abroad" },
      { value: "resident", label: "I have a green card or a U.S. visa" },
      { value: "itin", label: "I have an ITIN, not a Social Security number" },
      { value: "foreign", label: "No U.S. status" },
    ],
    fallback: "foreign",
  },
  use: {
    key: "use", param: "u", type: "choice",
    title: "What would the home be for?",
    options: [
      { value: "live", label: "Family would live in it" },
      { value: "rent", label: "I would rent it out" },
    ],
    fallback: "rent",
  },
};

export type Answers = Partial<Record<InputKey, string | number>>;

/**
 * Reads answers from an address. Anything missing, malformed or outside its
 * limits is left out, so the page asks for it rather than computing from it.
 * A figure that came from a query string a stranger can edit is never used
 * just because it parses.
 */
export function parseAnswers(get: (param: string) => string | undefined): Answers {
  const out: Answers = {};
  for (const a of Object.values(ASKS)) {
    const raw = (get(a.param) ?? "").trim();
    if (!raw) continue;
    if (a.type === "money") {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      const lim = a.limits ?? { min: 0, max: 5_000_000 };
      if (n < lim.min || n > lim.max) continue;
      out[a.key] = Math.round(n);
    } else if (a.options?.some((o) => o.value === raw)) {
      out[a.key] = raw;
    }
  }
  return out;
}

/** The address form of a set of answers, in a stable order. */
export function answersToQuery(a: Answers, only?: readonly InputKey[]): string {
  const p = new URLSearchParams();
  for (const def of Object.values(ASKS)) {
    if (only && !only.includes(def.key)) continue;
    const v = a[def.key];
    if (v === undefined || v === "") continue;
    p.set(def.param, String(v));
  }
  return p.toString();
}

export const hasAll = (a: Answers, keys: readonly InputKey[]) => keys.every((k) => a[k] !== undefined);

/** The label a stored answer is shown with ("3.5%", "$325,000", "DeKalb"). */
export function answerLabel(key: InputKey, v: string | number | undefined): string {
  if (v === undefined) return "";
  const a = ASKS[key];
  if (a.type === "money") return Number(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return a.options?.find((o) => o.value === String(v))?.label ?? String(v);
}

/** The commission answer as a rate, or null when none is agreed (MONEY-06). */
export const commissionOf = (v: string | number | undefined): number | null =>
  v === undefined || v === "none" ? null : Number(v);

/** Short names for the "Based on" line of an answer. */
export const ASK_SHORT: Record<InputKey, string> = {
  county: "County", ownership: "Owned before", price: "Price", downPct: "Down payment",
  savings: "Saved", monthlySaving: "Each month", income: "Income", household: "Household",
  credit: "Credit", occupation: "Work", loanType: "Loan", payoff: "Still owed", commission: "Commission",
  yearsOwned: "Owned for", homestead: "Homestead", age65: "65 or older", status: "Status", use: "Use",
};
