#!/usr/bin/env node
/**
 * Records the week's mortgage rate.
 *
 * Deliberately a command somebody runs rather than a scraper. Free rate APIs
 * are unreliable and their terms change; a wrong rate pulled automatically is
 * worse than a right one typed weekly, because nobody is watching the
 * automatic one. When a licensed feed exists, replace the argument with a
 * fetch and keep everything else.
 *
 * Usage:
 *   node --env-file=.env.local scripts/record-rate.mjs 6.72 --source "Freddie Mac PMMS"
 *   node --env-file=.env.local scripts/record-rate.mjs 6.72 --as-of 2026-09-04
 */
import { createClient } from "@supabase/supabase-js";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const pct = Number(process.argv[2]);
if (!Number.isFinite(pct) || pct <= 1 || pct >= 20) {
  console.error(
    "Usage: record-rate.mjs <rate> [--source \"...\"] [--as-of YYYY-MM-DD]\n" +
    "The rate must be a percentage between 1 and 20 — 6.72, not 0.0672. A value\n" +
    "outside that band is a data-entry error, not a market event, and entering\n" +
    "0.65 for 6.5 would understate every monthly payment by hundreds of dollars.",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const source = arg("--source", "Freddie Mac PMMS");
const asOf = arg("--as-of", new Date().toISOString().slice(0, 10));
const sourceUrl = arg("--url", "https://www.freddiemac.com/pmms");

const db = createClient(url, key, { auth: { persistSession: false } });

const { error } = await db.from("rift_rate_snapshots").upsert(
  { rate_pct: pct, source, source_url: sourceUrl, as_of: asOf, product: "conventional-30-fixed", term_years: 30 },
  { onConflict: "product,as_of" },
);

if (error) { console.error("Could not record the rate:", error.message); process.exit(1); }

console.log(`Recorded ${pct}% (${source}, as of ${asOf}).
Every monthly figure in the product now uses it, and every page that shows one
prints the rate and this date beside it.`);
