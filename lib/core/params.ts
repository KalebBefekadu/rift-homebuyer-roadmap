import { BUYER_DEFAULTS, type BuyerInputs } from "./compute";
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
    /* Naming a second decision-maker is a real signal — the person who did not
       answer these questions is usually the one who stalls it. */
    coBuyer: Boolean((get("w") ?? "").trim()),
    substituted,
  };
}
