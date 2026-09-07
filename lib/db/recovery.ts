import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";

/**
 * Assessment abandonment, and getting people back.
 *
 * Most people who start will not finish in one sitting, and that population is
 * the single largest source of lost leads in this product. Rift treats
 * abandonment as a normal state rather than a failure — the rows are
 * first-class, not rows somebody forgot to delete.
 *
 * The recovery rule that matters, and the one most products get wrong: a
 * resumable link is only sent to somebody who gave an address FOR THIS PURPOSE.
 * Emailing an abandoned form to an address harvested from a half-finished field
 * is the behaviour that makes people distrust every form they ever fill in
 * again, and it would poison the one asset this product is built on.
 */

export interface Abandoned {
  assessmentId: string;
  sessionId: string;
  side: "buy" | "sell";
  county: string | null;
  startedAt: string;
  answered: number;
  /** Present only if they gave one deliberately, at capture. */
  email: string | null;
  hoursSince: number;
}

/**
 * Assessments started, not completed, and quiet for a while.
 *
 * The quiet period is not politeness — somebody who stepped away for ten
 * minutes has not abandoned anything, and mailing them mid-session is the
 * clearest possible way to say a machine is watching them fill in a form.
 */
export async function abandoned(minHoursQuiet = 2, maxAgeDays = 30): Promise<DbResult<Abandoned[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const now = Date.now();
  const oldest = new Date(now - maxAgeDays * 86_400_000).toISOString();
  const quietBefore = new Date(now - minHoursQuiet * 3_600_000).toISOString();

  try {
    const { data, error } = await db
      .from("rift_assessments")
      .select("id,session_id,side,county,started_at,rift_answers(question_key),rift_leads(email)")
      .eq("agent_id", agent_id)
      .is("completed_at", null)
      .gte("started_at", oldest)
      .lte("started_at", quietBefore)
      .order("started_at", { ascending: false });
    if (error) return failed(error.message);

    const rows = (data ?? []) as unknown as {
      id: string; session_id: string; side: "buy" | "sell"; county: string | null; started_at: string;
      rift_answers: { question_key: string }[]; rift_leads: { email: string | null }[];
    }[];

    return done(rows.map((r) => ({
      assessmentId: r.id,
      sessionId: r.session_id,
      side: r.side,
      county: r.county,
      startedAt: r.started_at,
      answered: r.rift_answers?.length ?? 0,
      email: r.rift_leads?.[0]?.email ?? null,
      hoursSince: Math.floor((now - new Date(r.started_at).getTime()) / 3_600_000),
    })));
  } catch (e) {
    return failed(e);
  }
}

/**
 * Marks an assessment abandoned so it stops appearing as live work.
 *
 * Separate from deletion, which happens on the retention schedule. An
 * abandonment that is deleted immediately destroys the recovery opportunity;
 * one that is never marked leaves the agent staring at a queue that never
 * empties.
 */
export async function markAbandoned(assessmentId: string): Promise<DbResult<{ marked: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db
      .from("rift_assessments")
      .update({ abandoned_at: new Date().toISOString() })
      .eq("id", assessmentId)
      .is("completed_at", null);
    if (error) return failed(error.message);
    return done({ marked: true as const });
  } catch (e) {
    return failed(e);
  }
}
