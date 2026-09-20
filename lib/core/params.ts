import { BUYER_DEFAULTS, SELLER_DEFAULTS, type BuyerInputs, type SellerInputs } from "./compute";
import { GA_COUNTIES } from "./registry";
import type { Ownership } from "./funnel";

/**
 * Turning a URL into compute inputs.
 *
 * The readout is URL-addressable and ungated, which is the product's central
 * promise — and it means every number on it is derived from a query string a
 * stranger can edit. So this is a trust boundary, not a parsing convenience.
 *
 * Two failures it exists to prevent:
 *
 *   NONSENSE. A negative price or a billion-dollar saving rate produces a
 *   readout that is arithmetically correct and absurd. Screenshotted, that is
 *   worse than an error page, because an error page cannot be mistaken for
 *   something this product said.
 *
 *   MISPLACED TRUST. Anything not recognised falls back to a documented
 *   default rather than being passed through. A county we do not serve would
 *   otherwise match no programmes and tell somebody there is no help for them,
 *   which is a false claim rather than an empty result.
 *
 * Silently clamping rather than rejecting is deliberate. Somebody who lands on
 * a mangled link — truncated by a messaging app, mangled by an email client —
 * should see a sensible readout with its assumptions on display, not a refusal.
 * The assumptions are printed beside every figure, so a substituted default is
 * visible rather than hidden.
 */

const TIMINGS = ["In the next 3 months", "3 to 9 months", "9 to 18 months", "Just exploring"] as const;
const OWNERSHIPS = ["none", "primary", "investment"] as const;

/** Bounds chosen to be generous but not absurd for Georgia residential. */
export const BOUNDS = {
  price: { min: 50_000, max: 5_000_000 },
  savings: { min: 0, max: 5_000_000 },
  monthlySaving: { min: 0, max: 100_000 },
} as const;

function num(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  /* NaN and Infinity both fail this, which is the point — `Number("1e999")` is
     Infinity, and Infinity through the mortgage formula produces NaN on screen. */
  return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
}

export interface ReadoutParams {
  inputs: BuyerInputs;
  ownership: Ownership;
  timing: string;
  coBuyer: boolean;
  /** Which values were not usable and fell back. Shown, never hidden. */
  substituted: string[];
  /**
   * Whether the visitor actually named a timeline.
   *
   * Separate from `substituted`, which means "you gave us something we could
   * not use". This means "you gave us nothing", and the two need different
   * sentences: the readout's tension block is written in the second person
   * about what the reader said, and with no answer it was telling somebody
   * "You said 3 to 9 months" — a statement they never made, about their own
   * money, with no disclosure attached because nothing had been substituted.
   *
   * The default stays: it is a defensible planning assumption for the
   * arithmetic. What it is not is a quote.
   */
  timingStated: boolean;
}

export function parseReadoutParams(get: (key: string) => string | undefined): ReadoutParams {
  const substituted: string[] = [];

  const rawCounty = (get("c") ?? "").trim();
  const county = GA_COUNTIES.includes(rawCounty) ? rawCounty : BUYER_DEFAULTS.county;
  if (rawCounty && county !== rawCounty) substituted.push("county");

  const rawTiming = (get("t") ?? "").trim();
  const timing = (TIMINGS as readonly string[]).includes(rawTiming) ? rawTiming : "3 to 9 months";
  if (rawTiming && timing !== rawTiming) substituted.push("timing");

  const rawOwn = (get("o") ?? "").trim();
  const ownership = ((OWNERSHIPS as readonly string[]).includes(rawOwn) ? rawOwn : "none") as Ownership;
  if (rawOwn && ownership !== rawOwn) substituted.push("ownership");

  const price = num(get("p"), BOUNDS.price.min, BOUNDS.price.max, BUYER_DEFAULTS.price);
  if (get("p") && price !== Number(get("p"))) substituted.push("price");

  const savings = num(get("s"), BOUNDS.savings.min, BOUNDS.savings.max, BUYER_DEFAULTS.savings);
  if (get("s") && savings !== Number(get("s"))) substituted.push("savings");

  const monthlySaving = num(get("r"), BOUNDS.monthlySaving.min, BOUNDS.monthlySaving.max, BUYER_DEFAULTS.monthlySaving);
  if (get("r") && monthlySaving !== Number(get("r"))) substituted.push("monthly saving");

  return {
    inputs: {
      ...BUYER_DEFAULTS,
      county,
      price,
      savings,
      monthlySaving,
      /* Never folded into the headline. The gap we lead with is the one that is
         true today; assistance is upside, conditional on a lender saying yes. */
      assistance: 0,
    },
    ownership,
    timing,
    timingStated: TIMINGS.includes(rawTiming as (typeof TIMINGS)[number]),
    /* Naming a second decision-maker is a real signal — the person who did not
       answer these questions is usually the one who stalls it. */
    coBuyer: Boolean((get("w") ?? "").trim()),
    substituted,
  };
}

/* ------------------------------------------------------------------ *
 * The seller side of the same boundary
 * ------------------------------------------------------------------ */

export const SELLER_BOUNDS = {
  price: { min: 50_000, max: 5_000_000 },
  payoff: { min: 0, max: 5_000_000 },
  yearsOwned: { min: 0, max: 60 },
} as const;

export interface SellerReadoutParams {
  inputs: SellerInputs;
  timing: string;
  coDecider: boolean;
  substituted: string[];
  /** See the note on ReadoutParams.timingStated. */
  timingStated: boolean;
}

/**
 * The seller readout's inputs, from the same untrusted URL.
 *
 * One deliberate non-clamp: a payoff larger than the price is allowed through.
 * Being underwater is a real situation, it is exactly the situation somebody
 * most needs an honest number for, and clamping it would replace their reality
 * with a cheerful fiction. `netProceeds` returns a negative number and the
 * readout says so.
 */
export function parseSellerParams(get: (key: string) => string | undefined): SellerReadoutParams {
  const substituted: string[] = [];

  const rawCounty = (get("c") ?? "").trim();
  const county = GA_COUNTIES.includes(rawCounty) ? rawCounty : SELLER_DEFAULTS.county;
  if (rawCounty && county !== rawCounty) substituted.push("county");

  const rawTiming = (get("t") ?? "").trim();
  const timing = (TIMINGS as readonly string[]).includes(rawTiming) ? rawTiming : "3 to 9 months";
  if (rawTiming && timing !== rawTiming) substituted.push("timing");

  const price = num(get("p"), SELLER_BOUNDS.price.min, SELLER_BOUNDS.price.max, SELLER_DEFAULTS.price);
  if (get("p") && price !== Number(get("p"))) substituted.push("price");

  const payoff = num(get("o"), SELLER_BOUNDS.payoff.min, SELLER_BOUNDS.payoff.max, SELLER_DEFAULTS.payoff);
  if (get("o") && payoff !== Number(get("o"))) substituted.push("payoff");

  const yearsOwned = num(get("y"), SELLER_BOUNDS.yearsOwned.min, SELLER_BOUNDS.yearsOwned.max, SELLER_DEFAULTS.yearsOwned);
  if (get("y") && yearsOwned !== Number(get("y"))) substituted.push("years owned");

  return {
    inputs: {
      ...SELLER_DEFAULTS,
      county,
      price,
      payoff,
      yearsOwned,
      homesteadFiled: (get("h") ?? "") === "1",
      /* The assessed value is not asked for. Defaulting it to the price is a
         closer guess than a fixed figure from another home, and every line it
         feeds is labelled an estimate. */
      assessedValue: price,
    },
    timing,
    timingStated: TIMINGS.includes(rawTiming as (typeof TIMINGS)[number]),
    coDecider: Boolean((get("w") ?? "").trim()),
    substituted,
  };
}
