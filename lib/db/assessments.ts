import "server-only";
import { randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { BUY_FUNNEL, SELL_FUNNEL, type Funnel } from "@/lib/core/funnel";
import { currentVersionId } from "./funnel";

/**
 * Assessments, answers, and the readout snapshot.
 *
 * The shape of this file is decided by one rule from docs/schema.md: a readout
 * is an immutable snapshot, not a view. `figures` stores what the person was
 * SHOWN; `inputs` stores what produced it. Recomputing six weeks later gives a
 * different answer — rates move, programmes close — and the promise made was
 * "you keep this". A document that silently rewrites itself was never theirs.
 *
 * Both are stored because the plan needs to recompute AND disclose the
 * difference. Keeping only the inputs loses what they were told; keeping only
 * the figures loses the ability to tell them what changed.
 */

export interface StartInput {
  sessionId: string;
  side: "buy" | "sell";
  county?: string;
}

export async function startAssessment(input: StartInput): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured — the assessment runs but is not stored");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    /* One assessment per session per side. A visitor who reloads is the same
       attempt, not a new one — counting reloads as starts would inflate every
       completion rate in the funnel report by an unknowable amount. */
    const { data: existing } = await db
      .from("rift_assessments")
      .select("id")
      .eq("session_id", input.sessionId)
      .eq("side", input.side)
      .is("completed_at", null)
      .maybeSingle();
    if (existing) return done({ id: existing.id as string });

    /* Pinned to the version they are about to be asked. Contract 4.6 — and it
       has to be recorded now, because no later migration can recover which
       wording somebody actually saw. */
    const funnel_version_id = await currentVersionId(input.side);

    const { data, error } = await db
      .from("rift_assessments")
      .insert({
        agent_id,
        session_id: input.sessionId,
        side: input.side,
        county: input.county ?? null,
        funnel_version_id,
      })
      .select("id")
      .single();
    if (error) return failed(error.message);
    return done({ id: data.id as string });
  } catch (e) {
    return failed(e);
  }
}

export async function saveAnswer(
  assessmentId: string,
  questionKey: string,
  value: unknown,
): Promise<DbResult<{ saved: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  try {
    const { error } = await db
      .from("rift_answers")
      .upsert(
        { assessment_id: assessmentId, question_key: questionKey, value: value as never, answered_at: new Date().toISOString() },
        { onConflict: "assessment_id,question_key" },
      );
    if (error) return failed(error.message);
    return done({ saved: true as const });
  } catch (e) {
    return failed(e);
  }
}

export async function completeAssessment(assessmentId: string): Promise<DbResult<{ completed: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db
      .from("rift_assessments")
      .update({ completed_at: new Date().toISOString(), abandoned_at: null })
      .eq("id", assessmentId);
    if (error) return failed(error.message);
    return done({ completed: true as const });
  } catch (e) {
    return failed(e);
  }
}

/* ------------------------------------------------------------------ *
 * The readout snapshot
 * ------------------------------------------------------------------ */

/**
 * An unguessable share token.
 *
 * The readout is URL-addressable and ungated by design — that is the product's
 * central promise. Ungated is not the same as enumerable: a sequential id would
 * let anyone walk every stranger's finances. 24 bytes of base64url is not a
 * password, but it is not a number you can count to either.
 */
export const newShareToken = () => randomBytes(24).toString("base64url");

export interface SnapshotInput {
  assessmentId: string;
  side: "buy" | "sell";
  inputs: Record<string, unknown>;
  figures: Record<string, unknown>;
  matched?: unknown[];
}

export async function saveReadout(input: SnapshotInput): Promise<DbResult<{ id: string; shareToken: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured — the readout is shown but not stored");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    /* A second readout for the same assessment is a NEW row, never an update.
       Overwriting would destroy the thing this table exists to preserve. */
    const shareToken = newShareToken();
    const { data, error } = await db
      .from("rift_readouts")
      .insert({
        agent_id,
        assessment_id: input.assessmentId,
        side: input.side,
        share_token: shareToken,
        inputs: input.inputs as never,
        figures: input.figures as never,
        matched: (input.matched ?? []) as never,
      })
      .select("id")
      .single();
    if (error) return failed(error.message);
    return done({ id: data.id as string, shareToken });
  } catch (e) {
    return failed(e);
  }
}

export async function readByToken(token: string): Promise<DbResult<SnapshotInput & { createdAt: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { data, error } = await db
      .from("rift_readouts")
      .select("assessment_id,side,inputs,figures,matched,created_at")
      .eq("share_token", token)
      .maybeSingle();
    if (error) return failed(error.message);
    if (!data) return skipped("no readout with that token");
    return done({
      assessmentId: data.assessment_id as string,
      side: data.side as "buy" | "sell",
      inputs: data.inputs as Record<string, unknown>,
      figures: data.figures as Record<string, unknown>,
      matched: data.matched as unknown[],
      createdAt: data.created_at as string,
    });
  } catch (e) {
    return failed(e);
  }
}

/* ------------------------------------------------------------------ *
 * Funnel definition
 * ------------------------------------------------------------------ */

/**
 * The live funnel.
 *
 * Falls back to the definitions in `lib/core/funnel.ts` when the database has
 * no published version. That is the correct default rather than an error: the
 * built-in funnel is the one the compute engine was designed against, and a
 * visitor should never see a broken assessment because an agent has not
 * customised anything yet.
 */
export async function readFunnel(side: "buy" | "sell"): Promise<DbResult<{ funnel: Funnel; source: "database" | "built-in" }>> {
  const fallback = side === "buy" ? BUY_FUNNEL : SELL_FUNNEL;
  const db = serviceClient();
  if (!db) return done({ funnel: fallback, source: "built-in" as const });

  const agent_id = await currentAgentId();
  if (!agent_id) return done({ funnel: fallback, source: "built-in" as const });

  try {
    const { data, error } = await db
      .from("rift_funnels")
      .select("id,version")
      .eq("agent_id", agent_id)
      .eq("side", side)
      .maybeSingle();
    if (error) return failed(error.message);
    if (!data) return done({ funnel: fallback, source: "built-in" as const });

    /* Reading published questions is phase 7 work (the funnel editor). Until
       an agent can edit, reading a stored copy would only add a way for the
       stored copy to drift from the engine. */
    return done({ funnel: fallback, source: "built-in" as const });
  } catch (e) {
    return failed(e);
  }
}
