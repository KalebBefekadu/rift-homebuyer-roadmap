import "server-only";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { captureOpError } from "@/lib/monitoring/capture";
import { AI_LABEL, allowance, costCents, dayStart, monthStart, type AiWorkflow, type Allowance, type Spent, type Usage } from "@/lib/core/ai";

/**
 * The only reader and writer of rift_ai_usage (Blueprint v5 §10.2). The
 * limit's rules are lib/core/ai.ts.
 */

/** A key is present. Never logged, never sent anywhere but Anthropic. */
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/**
 * What AI has cost this month, in cents: in all, on one workflow, and on that
 * workflow since midnight in Georgia. One read of the month's rows, which stay
 * few: at the limit they number in the hundreds.
 */
export async function spentThisMonth(workflow: AiWorkflow, now = new Date()): Promise<DbResult<Spent>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_ai_usage").select("workflow,cost_cents,created_at").gte("created_at", monthStart(now)).limit(10_000),
    "this month's AI spend",
  );
  if (!r.ok) return r;
  const rows = ("data" in r ? r.data : []) as { workflow: string; cost_cents: number; created_at: string }[];
  const today = Date.parse(dayStart(now));
  const spent: Spent = { month: 0, workflow: 0, today: 0 };
  for (const x of rows) {
    const c = x.cost_cents ?? 0;
    spent.month += c;
    if (x.workflow !== workflow) continue;
    spent.workflow += c;
    if (Date.parse(x.created_at) >= today) spent.today += c;
  }
  return done(spent);
}

/**
 * Whether a call may be made now. Without a database there is no way to keep
 * the limit, so there is no call: an uncounted call is the one thing the
 * limit exists to prevent.
 */
export async function mayCall(workflow: AiWorkflow): Promise<Allowance> {
  if (!aiConfigured()) return allowance({ configured: false, spent: { month: 0, workflow: 0, today: 0 }, workflow });
  const spent = await spentThisMonth(workflow);
  if (!spent.ok || "skipped" in spent) {
    return { ok: false, reason: "over-limit", say: `${AI_LABEL[workflow]} is unavailable because this month's AI spend could not be checked.` };
  }
  return allowance({ configured: true, spent: spent.data, workflow });
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
