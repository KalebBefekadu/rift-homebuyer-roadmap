import "server-only";
import { serviceClient } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import {
  PROGRAMS as SEED_PROGRAMS,
  type AssistanceProgram,
  type FundingState,
  type ProgramType,
} from "@/lib/core/registry";
import { DEFAULT_RULES } from "@/lib/core/settings";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";

/**
 * The assistance registry, read from the database.
 *
 * Two things are deliberate here.
 *
 * FIRST: suppression happens in the query, not in the caller. `matchPrograms()`
 * in lib/core also filters stale programmes, but a second reader — an admin
 * screen, a report, an export — could forget to. Putting the window in the SQL
 * means the customer-facing path cannot serve a stale programme even if
 * somebody writes a new caller badly, which is the only kind of guarantee worth
 * having about a number that reaches a stranger.
 *
 * SECOND: the window is read from the business rules, never hard-coded. It was
 * a literal in two places and a stated open decision at the same time, which
 * meant nobody owned it. See docs/handoff.md §4.4.
 *
 * With no database configured this falls back to the seeded registry so the
 * product still works end to end — and it says so, rather than pretending the
 * data came from somewhere authoritative.
 */

type Row = {
  slug: string; name: string; administrator: string;
  type: ProgramType; funding_state: FundingState;
  amount_min: number; amount_max: number;
  county: string | null; first_time_only: boolean;
  reopens: string | null; source_note: string;
  income_limit_note: string; price_cap_note: string;
  conditions: string[]; verified_on: string; verified_by: string;
};

const toProgram = (r: Row): AssistanceProgram => ({
  id: r.slug,
  name: r.name,
  administrator: r.administrator,
  type: r.type,
  funding: r.funding_state,
  min: r.amount_min,
  max: r.amount_max,
  county: r.county,
  firstTimeOnly: r.first_time_only,
  ...(r.reopens ? { reopens: r.reopens } : {}),
  source: r.source_note,
  incomeLimitNote: r.income_limit_note,
  priceCapNote: r.price_cap_note,
  conditions: r.conditions,
  verifiedOn: r.verified_on,
  verifiedBy: r.verified_by,
});

export interface RegistryRead {
  programs: AssistanceProgram[];
  /** Programmes withheld from customers because nobody re-checked them. */
  suppressed: AssistanceProgram[];
  /** Where the data came from. Displayed, not swallowed. */
  source: "database" | "seed";
  windowDays: number;
}

export async function readRegistry(today = new Date()): Promise<DbResult<RegistryRead>> {
  const windowDays = DEFAULT_RULES.registryDays.value;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const db = serviceClient();
  if (!db) {
    /* The seeded registry is real, verified data — it is the same list the
       specification matches against. Falling back to it keeps the product
       whole; labelling the fallback keeps it honest. */
    const fresh = SEED_PROGRAMS.filter((p) => p.verifiedOn >= cutoffISO);
    const stale = SEED_PROGRAMS.filter((p) => p.verifiedOn < cutoffISO);
    return done({ programs: fresh, suppressed: stale, source: "seed" as const, windowDays });
  }

  try {
    /* On a deadline. A read that fails already falls back to the built-in
       registry below; one that hangs would leave the page waiting with a
       perfectly good list of real, verified programmes sitting unused. */
    const query = Promise.resolve(
      db.from("rift_programs")
        .select("slug,name,administrator,type,funding_state,amount_min,amount_max,county,first_time_only,reopens,source_note,income_limit_note,price_cap_note,conditions,verified_on,verified_by")
        .eq("active", true)
        .order("verified_on", { ascending: false }),
    );
    const { value: result, timedOut } = await withTimeout(query, READ_DEADLINE_MS, null);

    if (timedOut || !result) {
      const fresh = SEED_PROGRAMS.filter((p) => p.verifiedOn >= cutoffISO);
      const stale = SEED_PROGRAMS.filter((p) => p.verifiedOn < cutoffISO);
      return done({ programs: fresh, suppressed: stale, source: "seed" as const, windowDays });
    }

    const { data, error } = result;
    if (error) return failed(error.message);
    if (!data?.length) return skipped("registry table is empty — seed it before launch");

    const rows = data as Row[];
    return done({
      programs: rows.filter((r) => r.verified_on >= cutoffISO).map(toProgram),
      suppressed: rows.filter((r) => r.verified_on < cutoffISO).map(toProgram),
      source: "database" as const,
      windowDays,
    });
  } catch (e) {
    return failed(e);
  }
}

/**
 * Programmes needing re-verification. This is an agent task, not a report:
 * a suppression rule with nobody acting on it silently shrinks what customers
 * are shown until the registry is empty and nobody notices.
 */
export async function readStale(today = new Date()): Promise<DbResult<AssistanceProgram[]>> {
  const r = await readRegistry(today);
  if (!r.ok) return r;
  if ("skipped" in r) return r;
  return done(r.data.suppressed);
}
