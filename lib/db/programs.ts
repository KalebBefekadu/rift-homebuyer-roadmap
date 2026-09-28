import "server-only";
import { serviceClient } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import type { AssistanceProgram, FundingState, ProgramType } from "@/lib/core/registry";
import { GEORGIA_PROGRAMS, legacyCanCheck as recordCanBeChecked, toLegacy } from "@/lib/core/assistance";
import { currentPrograms } from "./program-checks";
import { DEFAULT_RULES } from "@/lib/core/settings";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";
import { georgiaDay } from "@/lib/core/day";

/**
 * The assistance registry, read from the database.
 *
 * Two things are deliberate here.
 *
 * FIRST: suppression happens in the query, not in the caller. `matchPrograms()`
 * in lib/core also filters stale programmes, but a second reader: an admin
 * screen, a report, an export: could forget to. Putting the window in the SQL
 * means the customer-facing path cannot serve a stale programme even if
 * somebody writes a new caller badly, which is the only kind of guarantee worth
 * having about a number that reaches a stranger.
 *
 * SECOND: the window is read from the business rules, never hard-coded. It was
 * a literal in two places and a stated open decision at the same time, which
 * meant nobody owned it. See docs/handoff.md §4.4.
 *
 * With no database configured this falls back to the assistance engine's own
 * records (lib/core/assistance.ts), so the product still works end to end, and
 * it says so. It used to fall back to the placeholder programmes the table was
 * first seeded with, which would have put invented terms in front of a buyer
 * on exactly the day the database was down.
 *
 * THIRD (Blueprint v5 §6.5): the table's `verified_on` is the day each record
 * was written. The weekly check renews a record whose official page has not
 * changed, and a reviewer can withdraw one; both live in the engine's view of
 * the records, so this reads the dates from there when they are newer.
 */

/** The engine's records in this reader's shape, for when there is no database. */
const SEED_PROGRAMS: AssistanceProgram[] = GEORGIA_PROGRAMS.filter(recordCanBeChecked).map(toLegacy);

type Row = {
  slug: string; name: string; administrator: string;
  type: ProgramType; funding_state: FundingState;
  amount_min: number; amount_max: number;
  county: string | null; first_time_only: boolean;
  reopens: string | null; source_note: string;
  income_limit_note: string; price_cap_note: string;
  conditions: string[]; verified_on: string; verified_by: string;
  rules?: { onlyFor?: unknown; alsoCheck?: unknown; area?: { within?: unknown; counties?: unknown[] } } | null;
};

/* The older readout matches on county and first-time status only. A record
   for certain jobs, or one that depends on something it never asks (a
   disability in the household), cannot be checked by it and would be added
   to the total as if it applied to everyone. Those are left to the
   assistance value, which asks (Blueprint v5 §6.3). */
/* The same for one limited to part of a county (inside Atlanta's city limits,
   a Beltline subarea): it would be counted for everyone in the county. */
const legacyCanCheck = (r: Row) => !r.rules
  || (!r.rules.onlyFor && !r.rules.alsoCheck && !r.rules.area?.within && (r.rules.area?.counties?.length ?? 0) <= 1);

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

export async function readRegistry(today = new Date(), overrideDays?: number): Promise<DbResult<RegistryRead>> {
  /* The agent's own window when he has set one, the default otherwise.
     
     This read `DEFAULT_RULES.registryDays.value` directly, which made the
     re-check window a constant wearing a setting's clothes: /operations/settings
     could record a decision about it and every programme would go on being
     suppressed at ninety days regardless. A settings page whose dials are not
     connected is worse than no settings page: see RULE_REACH in
     lib/core/settings.ts, which now has to be able to say "live" about this
     one truthfully. */
  const windowDays = typeof overrideDays === "number" && Number.isFinite(overrideDays) && overrideDays > 0
    ? Math.round(overrideDays)
    : DEFAULT_RULES.registryDays.value;
  const cutoffISO = georgiaDay(today, -windowDays);

  const db = serviceClient();
  if (!db) {
    /* The seeded registry is real, verified data: it is the same list the
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
        .select("slug,name,administrator,type,funding_state,amount_min,amount_max,county,first_time_only,reopens,source_note,income_limit_note,price_cap_note,conditions,verified_on,verified_by,rules")
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
    if (!data?.length) return skipped("registry table is empty. Seed it before launch");

    const effective = new Map((await currentPrograms()).map((p) => [p.slug, p]));
    const rows = (data as Row[]).filter(legacyCanCheck)
      .filter((r) => !effective.get(r.slug)?.withheldReason)
      .map((r) => {
        const e = effective.get(r.slug);
        return e && e.checkedOn > r.verified_on ? { ...r, verified_on: e.checkedOn } : r;
      });
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

