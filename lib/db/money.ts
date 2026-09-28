import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { currentRate } from "./rates";
import { marketDay } from "@/lib/core/progress";
import { currentFacts, factError, ledger, planInputs, type Fact, type FactKind, type Ledger } from "@/lib/core/ledger";
import type { Membership } from "./portal";
import type { BuyerInputs } from "@/lib/core/compute";

/**
 * The only reader and writer of rift_money_facts, and where a journey's
 * ledger is put together (Blueprint v5 §10.1). Rules: lib/core/ledger.ts.
 *
 * A ledger reads three things: the buyer's saved answers (their own plan),
 * the facts the agent recorded, and this week's rate. Null facts mean the
 * table is not there yet, and the ledger then says it is an estimate only.
 */

const MISSING = /rift_money_facts|does not exist|schema cache/;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export async function readFacts(journeyId: string, agentId: string): Promise<DbResult<Fact[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(db.from("rift_money_facts").select("kind,amount_cents,source,as_of,actor_label,created_at")
    .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(500), "the money record");
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  return done(rows(r).map((f) => ({
    kind: f.kind as FactKind, amount: Number(f.amount_cents) / 100, source: f.source as string,
    asOf: f.as_of as string, by: f.actor_label as string, at: f.created_at as string,
  })));
}

export async function recordFact(input: { journeyId: string; kind: string; amount: number; source: string; asOf: string; by: string; requestId: string }, now = new Date()): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const bad = factError(input, marketDay(now));
  if (bad) return failed(bad);
  const j = await boundedRead(db.from("rift_journeys").select("id").eq("id", input.journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  if (!("data" in j) || !j.data) return failed("That journey is not yours");
  const w = await boundedWrite(db.from("rift_money_facts").insert({
    agent_id: agentId, journey_id: input.journeyId, kind: input.kind, amount_cents: Math.round(input.amount * 100),
    source: input.source.trim(), as_of: input.asOf, actor_label: input.by.slice(0, 120), request_id: input.requestId,
  }), "the amount");
  if (!w.ok) {
    if (/rift_money_facts_request|duplicate key/.test(w.error)) return done({ recorded: true as const });
    return MISSING.test(w.error) ? failed("The money record needs migration 20260928010000") : w;
  }
  return done({ recorded: true as const });
}

export interface JourneyMoney {
  ledger: Ledger;
  facts: Fact[];
  /** False before the facts table exists: everything shown is an estimate. */
  recording: boolean;
  /** When their answers came from, or null when none were saved. */
  answersFrom: string | null;
  rate: { pct: number; label: string };
  /** The buyer's terms, for working out other homes on the same basis (SEARCH-05). */
  plan: { inputs: BuyerInputs; savingsKnown: boolean };
}

/** A journey's ledger, for the agent or for a member allowed to see money. */
export async function journeyMoney(journeyId: string, agentId: string): Promise<DbResult<JourneyMoney>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const j = await boundedRead(db.from("rift_journeys").select("origin_lead_id,side").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  const journey = ("data" in j ? j.data : null) as { origin_lead_id: string; side: string } | null;
  if (!journey) return failed("Not found");

  let lead = await boundedRead(db.from("rift_leads").select("plan,plan_saved_at").eq("id", journey.origin_lead_id).eq("agent_id", agentId).maybeSingle(), "their plan");
  if (!lead.ok && /plan/.test(lead.error)) lead = done(null);
  if (!lead.ok) return lead;
  const plan = ("data" in lead ? lead.data : null) as { plan?: { answers?: Record<string, unknown> } | null; plan_saved_at?: string | null } | null;
  const [facts, rate] = await Promise.all([readFacts(journeyId, agentId), currentRate()]);
  if (!facts.ok) return facts;
  const list = "data" in facts ? facts.data : null;
  const { inputs, answered } = planInputs(plan?.plan?.answers ?? null, rate.pct);
  return done({
    ledger: ledger(inputs, answered, currentFacts(list ?? [])),
    facts: list ?? [],
    recording: list !== null,
    answersFrom: plan?.plan_saved_at ? plan.plan_saved_at.slice(0, 10) : null,
    rate: { pct: rate.pct, label: rate.label },
    plan: { inputs, savingsKnown: answered.savings },
  });
}

/** The agent's view of one journey's money. */
export async function moneyFor(journeyId: string): Promise<DbResult<JourneyMoney>> {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  return journeyMoney(journeyId, agentId);
}

/** A household member's view: only with the "Price and fees" scope, and only on a buying journey. */
export async function clientMoney(m: Membership): Promise<DbResult<JourneyMoney | null>> {
  if (m.side !== "buy" || !m.scopes.includes("money")) return done(null);
  return journeyMoney(m.journeyId, m.agentId);
}
