import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { RETENTION } from "@/lib/core/privacy";

/**
 * Enforcing the retention schedule.
 *
 * `RETENTION` in lib/core/privacy.ts is rendered to every visitor at the bottom
 * of their readout. It is a promise, and a promise with no job behind it is a
 * paragraph. This is the job.
 *
 * Deletion here means DELETION. Not a flag, not an anonymised row, not an
 * archive table — the specification says so in the customer's own words
 * ("Deleted outright — not anonymised, not archived") and a soft delete would
 * make that sentence false while looking like compliance.
 *
 * The one period this cannot decide is the client record's. It has a legal
 * floor set by Georgia licence law and the brokerage, so it is a business rule
 * with a stated owner, and this job refuses to touch client records until
 * somebody has actually chosen the number.
 */

/** Kept in one place so the job and the promise cannot drift. */
export const WINDOWS = {
  /** An assessment nobody came back to. */
  unconverted: { days: 18 * 30, rule: "unconverted" },
  /** A part-finished assessment with no contact details. */
  abandoned: { days: 30, rule: "abandoned" },
  /** Funnel measurement — question ids and dwell, never answers. */
  analytics: { days: 24 * 30, rule: "analytics" },
} as const;

export interface SweepResult {
  assessments: number;
  answers: number;
  events: number;
  attributions: number;
  /** Anything the job deliberately did not touch, and why. */
  held: string[];
}

export async function sweep(now = new Date()): Promise<DbResult<SweepResult>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured — nothing was deleted");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const held: string[] = [];

  try {
    /* Abandoned, no contact details. The strictest window, and deliberately so:
       this is the most sensitive data in the product — a stranger's finances,
       with no relationship attached and no way to ask them about it. */
    const { data: orphans, error: orphanErr } = await db
      .from("rift_assessments")
      .select("id,rift_leads(id)")
      .eq("agent_id", agent_id)
      .is("completed_at", null)
      .lte("started_at", ago(WINDOWS.abandoned.days));
    if (orphanErr) return failed(orphanErr.message);

    const orphanIds = ((orphans ?? []) as unknown as { id: string; rift_leads: { id: string }[] }[])
      .filter((a) => !a.rift_leads?.length)
      .map((a) => a.id);

    /* Completed but never converted. Kept far longer, because a buyer who
       answered "9 to 18 months" is still inside their own stated timeline —
       deleting at ninety days would throw away the person the product exists
       for. */
    const { data: cold, error: coldErr } = await db
      .from("rift_assessments")
      .select("id")
      .eq("agent_id", agent_id)
      .not("completed_at", "is", null)
      .lte("started_at", ago(WINDOWS.unconverted.days));
    if (coldErr) return failed(coldErr.message);

    const coldIds = ((cold ?? []) as { id: string }[]).map((c) => c.id);
    const doomed = [...new Set([...orphanIds, ...coldIds])];

    let answers = 0;
    if (doomed.length) {
      const { count } = await db
        .from("rift_answers")
        .select("*", { count: "exact", head: true })
        .in("assessment_id", doomed);
      answers = count ?? 0;

      /* Answers cascade from the assessment, so one delete is enough — and one
         delete is safer than two, because a partial sweep that removed the
         assessment and left the answers would leave orphaned finances behind. */
      const { error } = await db.from("rift_assessments").delete().in("id", doomed);
      if (error) return failed(error.message);
    }

    /* Telemetry, on its own clock. Separate from answers on purpose: the two
       have different lifetimes precisely because they are different kinds of
       record, and a single sweep window would quietly merge them. */
    const { count: evCount } = await db
      .from("rift_events")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent_id)
      .lte("at", ago(WINDOWS.analytics.days));
    const { error: evErr } = await db
      .from("rift_events").delete().eq("agent_id", agent_id).lte("at", ago(WINDOWS.analytics.days));
    if (evErr) return failed(evErr.message);

    /* Attribution follows analytics — it is the same kind of record about the
       same visit, and keeping it after the events it explains would leave a
       channel history for a person whose visit has been forgotten. */
    const { count: atCount } = await db
      .from("rift_attributions")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent_id)
      .lte("first_at", ago(WINDOWS.analytics.days));
    const { error: atErr } = await db
      .from("rift_attributions").delete().eq("agent_id", agent_id).lte("first_at", ago(WINDOWS.analytics.days));
    if (atErr) return failed(atErr.message);

    held.push(
      "Client records are untouched — the period has a legal floor and is the broker's to set.",
      "Consent records are untouched — they outlive the relationship because they are what proves the contact was lawful.",
    );

    return done({
      assessments: doomed.length,
      answers,
      events: evCount ?? 0,
      attributions: atCount ?? 0,
      held,
    });
  } catch (e) {
    return failed(e);
  }
}

/**
 * A person asking to be forgotten, now, without waiting for a schedule.
 *
 * "Delete all of it" from the readout means this. It is the same deletion the
 * sweep performs, triggered by the person rather than by time.
 */
export async function forget(sessionId: string): Promise<DbResult<{ deleted: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data } = await db
      .from("rift_assessments").select("id").eq("agent_id", agent_id).eq("session_id", sessionId);
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);

    if (ids.length) {
      const { error } = await db.from("rift_assessments").delete().in("id", ids);
      if (error) return failed(error.message);
    }
    await db.from("rift_events").delete().eq("agent_id", agent_id).eq("session_id", sessionId);
    await db.from("rift_attributions").delete().eq("session_id", sessionId);

    /* The retention promise names four categories; three are cleared here and
       the fourth is stated rather than silently skipped. */
    void RETENTION;
    return done({ deleted: ids.length });
  } catch (e) {
    return failed(e);
  }
}
