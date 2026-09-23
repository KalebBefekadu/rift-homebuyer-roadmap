import "server-only";
import { serviceClient } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead, boundedWrite } from "./bounded";
import {
  DEFAULT_RULES, mergeRules, undecidedIn, usable,
  type BusinessRules, type StoredRule,
} from "@/lib/core/settings";

/**
 * The owner's own decisions, stored where they survive a browser.
 *
 * `lib/core/settings.ts` has held these since the prototype, in localStorage.
 * That was fine for a specification and wrong for a product: the values lived
 * on one device, in one browser, and nothing the server computed could read
 * them. So `commissionPct`: described in its own note as "the only number in
 * the product that turns pipeline into money": ran on a default that Kaleb
 * had no way to see, let alone change, because /prototype/studio/settings is
 * the only page that ever rendered it and that path returns 404 in production.
 *
 * Six decisions, one row each, keyed `(agent_id, key)`.
 *
 * A row records WHO decided and WHEN, not just what. Two of these six are not
 * Kaleb's to decide alone: client retention has a legal floor set by the
 * broker, and marketing to an unrepresented counterparty is a conflict
 * question before it is a marketing one, and a settings table that cannot
 * tell "the broker confirmed 5 years" from "nobody has touched this" is a
 * table that quietly converts a default into a policy.
 *
 * Validation on the way OUT as well as in. The value is jsonb: a number can
 * be stored as a string by any client that ever touches this table, and a
 * string where `commissionPct` belongs multiplies into every revenue figure
 * in the forward view without throwing.
 */

/* Re-exported so server callers keep one import. The shape lives in core:
   see the note there. */
export type { StoredRule };

export interface AgentRules {
  rules: BusinessRules;
  /** Keys with no usable stored value: still on the default. */
  undecided: (keyof BusinessRules)[];
  /** Provenance for the ones that were decided. */
  decided: StoredRule[];
}

const FALLBACK: AgentRules = {
  rules: DEFAULT_RULES,
  undecided: Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[],
  decided: [],
};

export async function readAgentRules(agentId: string): Promise<DbResult<AgentRules>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!agentId) return failed("no agent");

  try {
    const read = await boundedRead(
      db.from("rift_business_rules").select("key,value,decided_at,decided_by").eq("agent_id", agentId),
      "the settings",
    );
    if (!read.ok) return read;

    const rows = ("data" in read ? read.data ?? [] : []) as {
      key: string; value: unknown; decided_at: string | null; decided_by: string | null;
    }[];

    const saved: Partial<Record<keyof BusinessRules, unknown>> = {};
    const decided: StoredRule[] = [];

    for (const r of rows) {
      const k = r.key as keyof BusinessRules;
      /* A key that is not one of ours is ignored rather than merged. The
         table outlives any one version of this list. */
      if (!(k in DEFAULT_RULES)) continue;
      if (!usable(k, r.value)) continue;
      saved[k] = r.value;
      decided.push({ key: k, decidedAt: r.decided_at, decidedBy: r.decided_by });
    }

    return done({ rules: mergeRules(saved), undecided: undecidedIn(saved), decided });
  } catch (e) {
    return failed(e);
  }
}

/**
 * One decision, recorded.
 *
 * Refuses a value of the wrong shape rather than storing it and discovering
 * the problem in a forecast. The same `usable` check the reader applies, on
 * the grounds that a store which validates on read alone is a store that has
 * already accepted the bad value.
 */
export async function saveRule<K extends keyof BusinessRules>(
  agentId: string, key: K, value: BusinessRules[K]["value"], decidedBy: string,
): Promise<DbResult<{ key: K }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!agentId) return failed("no agent");
  if (!(key in DEFAULT_RULES)) return failed(`${String(key)} is not a business rule`);
  if (!usable(key, value)) return failed(`that is not a usable value for ${String(key)}`);

  try {
    const wrote = await boundedWrite(
      db.from("rift_business_rules").upsert({
        agent_id: agentId,
        key,
        value: value as never,
        /* Recorded together. A value with no decider is indistinguishable
           from a default, which is the distinction this table exists for. */
        decided_at: new Date().toISOString(),
        decided_by: decidedBy.slice(0, 120),
        updated_at: new Date().toISOString(),
      }, { onConflict: "agent_id,key" }),
      "the setting",
    );
    if (!wrote.ok) return wrote;
    return done({ key });
  } catch (e) {
    return failed(e);
  }
}

/** Back to the default, and back to being visibly undecided. */
export async function clearRule(agentId: string, key: keyof BusinessRules): Promise<DbResult<{ key: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!agentId) return failed("no agent");

  try {
    const wrote = await boundedWrite(
      db.from("rift_business_rules").delete().eq("agent_id", agentId).eq("key", key),
      "the setting",
    );
    if (!wrote.ok) return wrote;
    return done({ key });
  } catch (e) {
    return failed(e);
  }
}

/** For callers that cannot fail: the forecast, which must render something. */
export async function rulesOrDefaults(agentId: string | null): Promise<AgentRules> {
  if (!agentId) return FALLBACK;
  const r = await readAgentRules(agentId);
  return r.ok && "data" in r ? r.data : FALLBACK;
}
