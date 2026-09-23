import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead, boundedWrite } from "./bounded";
import {
  canRelease, statusOf,
  type Decision, type Option, type Kind,
} from "@/lib/core/decision";

export type { Decision, Option, Kind };

/**
 * Decision Rooms, read and written.
 *
 * The rules are all in lib/core/decision.ts. This layer does three things: it
 * assembles a room from two tables, it refuses to release one the core says is
 * not releasable, and it keeps the client's read narrower than the agent's.
 *
 * THE CLIENT READ IS A DIFFERENT QUERY, not the same query with a filter in
 * the component. `releasedFor` never asks for an unreleased room, so there is
 * no path by which a draft reaches the page that renders the client's plan:
 * the same shape as `readPlanByToken`, and for the same reason: a filter
 * applied after the data has been fetched is one refactor away from not being
 * applied at all.
 */

const OPTION_COLUMNS = "id,label,detail,amount_cents,amount_label,upside,downside,sort" as const;
const DECISION_COLUMNS =
  "id,kind,question,context,decide_by,released_at,decided_at,chosen_option_id,outcome_note" as const;

const shapeOption = (r: Record<string, unknown>): Option => ({
  id: r.id as string,
  label: r.label as string,
  detail: (r.detail as string | null) ?? null,
  /* A bigint comes back from PostgREST as a string often enough that coercing
     here rather than at four call sites is the difference between arithmetic
     and string concatenation. Number(null) is 0, so null is checked first. */
  amountCents: r.amount_cents === null || r.amount_cents === undefined
    ? null
    : Number(r.amount_cents),
  amountLabel: (r.amount_label as string | null) ?? null,
  upside: (r.upside as string | null) ?? null,
  downside: (r.downside as string | null) ?? null,
  sort: Number(r.sort ?? 0),
});

const shapeDecision = (r: Record<string, unknown>, options: Option[]): Decision => ({
  id: r.id as string,
  kind: (r.kind as Kind) ?? "other",
  question: r.question as string,
  context: (r.context as string | null) ?? null,
  decideBy: (r.decide_by as string | null) ?? null,
  releasedAt: (r.released_at as string | null) ?? null,
  decidedAt: (r.decided_at as string | null) ?? null,
  chosenOptionId: (r.chosen_option_id as string | null) ?? null,
  outcomeNote: (r.outcome_note as string | null) ?? null,
  options,
});

/** Options for a set of decisions, in one query rather than one per room. */
async function optionsFor(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  agentId: string,
  decisionIds: string[],
): Promise<Map<string, Option[]>> {
  const out = new Map<string, Option[]>();
  if (!decisionIds.length) return out;

  const res = await boundedRead(
    db.from("rift_decision_options")
      .select(`decision_id,${OPTION_COLUMNS}`)
      .eq("agent_id", agentId)
      .in("decision_id", decisionIds)
      .order("sort", { ascending: true })
      .limit(500),
    "the options",
  );
  if (!res.ok || !("data" in res)) return out;

  for (const row of res.data as Record<string, unknown>[]) {
    const key = row.decision_id as string;
    const list = out.get(key) ?? [];
    list.push(shapeOption(row));
    out.set(key, list);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The agent's view
 * ------------------------------------------------------------------ */

/** Every room for one relationship, drafts included. */
export async function decisionsFor(leadId: string): Promise<DbResult<Decision[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const res = await boundedRead(
    db.from("rift_decisions").select(DECISION_COLUMNS)
      .eq("lead_id", leadId).eq("agent_id", agentId)
      .order("created_at", { ascending: false }).limit(50),
    "the decisions",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<Decision[]>;

  const rows = res.data as Record<string, unknown>[];
  const options = await optionsFor(db, agentId, rows.map((r) => r.id as string));
  return done(rows.map((r) => shapeDecision(r, options.get(r.id as string) ?? [])));
}

/* ------------------------------------------------------------------ *
 * The client's view
 * ------------------------------------------------------------------ */

/**
 * Released rooms only.
 *
 * `.not("released_at", "is", null)` is in the QUERY. A draft is never fetched,
 * so it cannot be filtered out incorrectly later, and an agent half way
 * through assembling a comparison is never one bug away from showing it.
 *
 * Takes the agent id explicitly because the caller is the client's plan page,
 * where nobody is signed in: the token is the authorisation, exactly as in
 * lib/db/plan.ts.
 */
export async function releasedFor(leadId: string, agentId: string): Promise<DbResult<Decision[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  const res = await boundedRead(
    db.from("rift_decisions").select(DECISION_COLUMNS)
      .eq("lead_id", leadId).eq("agent_id", agentId)
      .not("released_at", "is", null)
      .order("created_at", { ascending: false }).limit(20),
    "the decisions",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<Decision[]>;

  const rows = res.data as Record<string, unknown>[];
  const options = await optionsFor(db, agentId, rows.map((r) => r.id as string));
  return done(rows.map((r) => shapeDecision(r, options.get(r.id as string) ?? [])));
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export async function createDecision(input: {
  leadId: string;
  kind: Kind;
  question: string;
  context?: string | null;
  decideBy?: string | null;
}): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const question = input.question.trim();
  if (question.length < 5) return failed("the question needs to be a question somebody could answer");

  const res = await boundedWrite(
    db.from("rift_decisions").insert({
      agent_id: agentId,
      lead_id: input.leadId,
      kind: input.kind,
      question,
      context: input.context?.trim() || null,
      decide_by: input.decideBy || null,
    }).select("id").single(),
    "the decision",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ id: string }>;
  return done({ id: (res.data as { id: string }).id });
}

export async function addOption(input: {
  decisionId: string;
  label: string;
  detail?: string | null;
  amountCents?: number | null;
  amountLabel?: string | null;
  upside?: string | null;
  downside?: string | null;
}): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const label = input.label.trim();
  if (!label) return failed("an option needs a label");

  const amount = typeof input.amountCents === "number" && Number.isFinite(input.amountCents)
    ? Math.round(input.amountCents)
    : null;
  const amountLabel = input.amountLabel?.trim() || null;
  /* Refused here rather than left to the constraint, so the caller gets the
     sentence rather than a Postgres error. A bare number in a comparison
     column is the reader's guess about what they are comparing. */
  if (amount !== null && !amountLabel) {
    return failed("a figure needs to say what it is, like \"would reach you\", \"a month\"");
  }

  /* Appended, in the agent's order. Reading the current maximum rather than
     counting rows: a deleted option leaves a gap, and counting would reuse a
     sort value and make the order depend on insertion time. */
  const last = await boundedRead(
    db.from("rift_decision_options").select("sort")
      .eq("decision_id", input.decisionId).eq("agent_id", agentId)
      .order("sort", { ascending: false }).limit(1).maybeSingle(),
    "the ordering",
  );
  const sort = last.ok && "data" in last && last.data
    ? Number((last.data as { sort: number }).sort) + 1
    : 0;

  const res = await boundedWrite(
    db.from("rift_decision_options").insert({
      agent_id: agentId,
      decision_id: input.decisionId,
      label,
      detail: input.detail?.trim() || null,
      amount_cents: amount,
      amount_label: amountLabel,
      upside: input.upside?.trim() || null,
      downside: input.downside?.trim() || null,
      sort,
    }).select("id").single(),
    "the option",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ id: string }>;
  return done({ id: (res.data as { id: string }).id });
}

export async function removeOption(optionId: string): Promise<DbResult<null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const res = await boundedWrite(
    db.from("rift_decision_options").delete().eq("id", optionId).eq("agent_id", agentId),
    "the option",
  );
  if (!res.ok) return res as DbResult<null>;
  return done(null);
}

/**
 * Let the client see it.
 *
 * Re-reads the room and runs `canRelease` rather than trusting what the form
 * posted. The checks exist because a released room is somebody making a
 * consequential choice from it, and a check that the caller can skip is not a
 * check.
 */
export async function release(decisionId: string): Promise<DbResult<{ blocks: string[]; warns: string[] }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const room = await boundedRead(
    db.from("rift_decisions").select("id,question").eq("id", decisionId).eq("agent_id", agentId).maybeSingle(),
    "the decision",
  );
  if (!room.ok || !("data" in room)) return room as DbResult<{ blocks: string[]; warns: string[] }>;
  const row = room.data as { id: string; question: string } | null;
  if (!row) return failed("no such decision");

  const options = await optionsFor(db, agentId, [decisionId]);
  const check = canRelease({ question: row.question, options: options.get(decisionId) ?? [] });
  if (!check.ok) return done({ blocks: check.blocks, warns: check.warns });

  const res = await boundedWrite(
    db.from("rift_decisions").update({ released_at: new Date().toISOString() })
      .eq("id", decisionId).eq("agent_id", agentId),
    "releasing the decision",
  );
  if (!res.ok) return res as DbResult<{ blocks: string[]; warns: string[] }>;
  return done({ blocks: [], warns: check.warns });
}

/** Take it back. The outcome, if one was recorded, is left alone. */
export async function unrelease(decisionId: string): Promise<DbResult<null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const res = await boundedWrite(
    db.from("rift_decisions").update({ released_at: null })
      .eq("id", decisionId).eq("agent_id", agentId),
    "withdrawing the decision",
  );
  if (!res.ok) return res as DbResult<null>;
  return done(null);
}

/**
 * Record what was decided.
 *
 * The option is verified to belong to this room before the write. The database
 * enforces it too: a composite foreign key, so an outcome naming an option
 * from another room is unrepresentable, but reaching that constraint means
 * the agent sees a Postgres error where a sentence belonged.
 */
export async function recordOutcome(input: {
  decisionId: string;
  optionId: string;
  note?: string | null;
}): Promise<DbResult<null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const owns = await boundedRead(
    db.from("rift_decision_options").select("id")
      .eq("id", input.optionId).eq("decision_id", input.decisionId).eq("agent_id", agentId)
      .maybeSingle(),
    "the option",
  );
  if (!owns.ok) return owns as DbResult<null>;
  if (!("data" in owns) || !owns.data) return failed("that option is not part of this decision");

  const res = await boundedWrite(
    db.from("rift_decisions").update({
      decided_at: new Date().toISOString(),
      chosen_option_id: input.optionId,
      outcome_note: input.note?.trim() || null,
    }).eq("id", input.decisionId).eq("agent_id", agentId),
    "recording the decision",
  );
  if (!res.ok) return res as DbResult<null>;
  return done(null);
}

/**
 * Undo a recorded outcome.
 *
 * Both columns together, because the constraint requires them to travel as a
 * pair: half an outcome is a room saying a decision was made without saying
 * what it was.
 */
export async function clearOutcome(decisionId: string): Promise<DbResult<null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const res = await boundedWrite(
    db.from("rift_decisions").update({
      decided_at: null, chosen_option_id: null, outcome_note: null,
    }).eq("id", decisionId).eq("agent_id", agentId),
    "reopening the decision",
  );
  if (!res.ok) return res as DbResult<null>;
  return done(null);
}

export async function removeDecision(decisionId: string): Promise<DbResult<null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const res = await boundedWrite(
    db.from("rift_decisions").delete().eq("id", decisionId).eq("agent_id", agentId),
    "the decision",
  );
  if (!res.ok) return res as DbResult<null>;
  return done(null);
}

export { statusOf };
