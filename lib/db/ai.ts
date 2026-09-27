import "server-only";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { captureOpError } from "@/lib/monitoring/capture";
import { allowance, costCents, monthStart, type AiWorkflow, type Allowance, type Usage } from "@/lib/core/ai";

/**
 * The only reader and writer of rift_ai_usage (Blueprint v5 §10.2). The
 * limit's rules are lib/core/ai.ts.
 */

/** A key is present. Never logged, never sent anywhere but Anthropic. */
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/** What AI has cost since the start of this month, in cents. */
export async function spentThisMonth(now = new Date()): Promise<DbResult<number>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_ai_usage").select("cost_cents").gte("created_at", monthStart(now)).limit(10_000),
    "this month's AI spend",
  );
  if (!r.ok) return r;
  const rows = ("data" in r ? r.data : []) as { cost_cents: number }[];
  return done(rows.reduce((s, x) => s + (x.cost_cents ?? 0), 0));
}

/**
 * Whether a call may be made now. Without a database there is no way to keep
 * the limit, so there is no call: an uncounted call is the one thing the
 * limit exists to prevent.
 */
export async function mayCall(workflow: AiWorkflow): Promise<Allowance> {
  if (!aiConfigured()) return allowance({ configured: false, spentCents: 0, workflow });
  const spent = await spentThisMonth();
  if (!spent.ok || "skipped" in spent) {
    return { ok: false, reason: "over-limit", say: "Automatic reading is unavailable because this month's AI spend could not be checked." };
  }
  return allowance({ configured: true, spentCents: spent.data, workflow });
}

/** Records a call. A failure to record is reported: an unrecorded call loosens the limit. */
export async function recordCall(input: {
  workflow: AiWorkflow; model: string; promptVersion: string; usage: Usage | null; outcome: "ok" | "refused" | "failed";
}): Promise<void> {
  const db = serviceClient();
  if (!db) return;
  const cost = input.usage ? costCents(input.model, input.usage) : 0;
  const w = await boundedWrite(db.from("rift_ai_usage").insert({
    workflow: input.workflow,
    model: input.model,
    prompt_version: input.promptVersion,
    input_tokens: input.usage?.input_tokens ?? 0,
    output_tokens: input.usage?.output_tokens ?? 0,
    cost_cents: cost,
    outcome: input.outcome,
  }), "the AI usage record");
  if (!w.ok) captureOpError(new Error(w.error), { op: "ai.record", extra: { workflow: input.workflow, cost } });
}
