import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { maySpend, monthStart, type AiWorkflow, type SpendVerdict } from "@/lib/core/ai-budget";

/**
 * The AI ledger (AUTO-06): reserve before a call, settle after it. See
 * supabase/migrations/20260927010000_rift_ai_usage.sql and lib/core/ai-budget.ts.
 *
 * Without a database there is no ledger, and without a ledger there is no
 * limit, so no AI call is made at all: `reserve` is skipped and the caller
 * offers manual entry. A limit that only holds when the database is up is a
 * limit that fails open.
 */

export interface Reservation { id: string; agentId: string }

export async function reserve(
  workflow: AiWorkflow,
  model: string,
  promptVersion: string,
  worstCents: number,
): Promise<DbResult<Reservation | Extract<SpendVerdict, { ok: false }>>> {
  const db = serviceClient();
  if (!db) return skipped("no database, so no spending limit, so no AI");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const rows = await boundedRead(
    db.from("rift_ai_usage").select("workflow,status,reserved_cents,cost_cents")
      .eq("agent_id", agentId).gte("created_at", monthStart()),
    "this month's AI spending",
  );
  if (!rows.ok) return rows;
  let month = 0, mine = 0;
  for (const r of ("data" in rows ? rows.data : []) as { workflow: string; status: string; reserved_cents: number; cost_cents: number | null }[]) {
    /* A reservation counts at its worst case until it is settled. */
    const c = Number(r.status === "reserved" ? r.reserved_cents : r.cost_cents ?? r.reserved_cents);
    month += c;
    if (r.workflow === workflow) mine += c;
  }
  const verdict = maySpend(workflow, worstCents, { month, workflow: mine });
  if (!verdict.ok) return done(verdict);

  const w = await boundedWrite(
    db.from("rift_ai_usage").insert({
      agent_id: agentId, workflow, model, prompt_version: promptVersion,
      status: "reserved", reserved_cents: worstCents,
    }).select("id").single(),
    "reserving the AI call",
  );
  if (!w.ok) return w;
  const id = ("data" in w ? (w.data as { id: string } | null)?.id : null);
  if (!id) return failed("the reservation was not recorded");
  return done({ id, agentId });
}

/** What it actually cost. A failed call that billed nothing settles at zero. */
export async function settle(r: Reservation, outcome: {
  ok: boolean; model: string; cents: number; inputTokens?: number; outputTokens?: number;
}): Promise<void> {
  const db = serviceClient();
  if (!db) return;
  await boundedWrite(
    db.from("rift_ai_usage").update({
      status: outcome.ok ? "spent" : "failed",
      model: outcome.model,
      cost_cents: outcome.cents,
      input_tokens: outcome.inputTokens ?? null,
      output_tokens: outcome.outputTokens ?? null,
      settled_at: new Date().toISOString(),
    }).eq("id", r.id).eq("agent_id", r.agentId),
    "settling the AI call",
  );
}
