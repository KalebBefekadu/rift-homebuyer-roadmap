import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead } from "./bounded";
import { unfinishedValues, type ValueEvent } from "@/lib/core/abandonment";

/**
 * Assessment abandonment, and getting people back.
 *
 * Most people who start will not finish in one sitting, and that population is
 * the single largest source of lost leads in this product. Rift treats
 * abandonment as a normal state rather than a failure: the rows are
 * first-class, not rows somebody forgot to delete.
 *
 * The recovery rule that matters, and the one most products get wrong: a
 * resumable link is only sent to somebody who gave an address FOR THIS PURPOSE.
 * Emailing an abandoned form to an address harvested from a half-finished field
 * is the behaviour that makes people distrust every form they ever fill in
 * again, and it would poison the one asset this product is built on.
 */

export interface Abandoned {
  /** The v4 assessment, or null for a visitor who left a value (v5). */
  assessmentId: string | null;
  sessionId: string;
  side: "buy" | "sell" | "abroad";
  /** The value they left, for a v5 row. */
  tool: string | null;
  county: string | null;
  startedAt: string;
  answered: number;
  /** Present only if they gave one deliberately, at capture. */
  email: string | null;
  hoursSince: number;
}

/** The most sessions whose address is looked up. The report shows twenty; the lookup is by id in a URL. */
const LOOKUP_CAP = 60;

/**
 * People who started and left with nothing, and have been quiet for a while.
 *
 * Two populations, because the product has two histories. A v4 assessment is a
 * row (`rift_assessments`), and nothing has written one since D31 retired the
 * questionnaire; reading only those is why this said "nobody" about a funnel
 * that was losing people daily. A visitor to a value (Blueprint v5 §5.1) leaves
 * only telemetry, so they are counted from the value events by
 * lib/core/abandonment.ts, and an address is attached only when a lead was
 * captured on that same session.
 *
 * A saved plan is finishing, so a session with one is not listed. The quiet
 * period is not politeness: somebody who stepped away for ten minutes has not
 * abandoned anything, and mailing them mid-session is the clearest possible
 * way to say a machine is watching them fill in a form.
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
    const [v4, events, savers] = await Promise.all([
      boundedRead(
        db.from("rift_assessments")
          .select("id,session_id,side,county,started_at,rift_answers(question_key),rift_leads(email)")
          .eq("agent_id", agent_id)
          .is("completed_at", null)
          .gte("started_at", oldest)
          .lte("started_at", quietBefore)
          .order("started_at", { ascending: false }),
        "the unfinished assessments",
      ),
      boundedRead(
        db.from("rift_events")
          .select("session_id,name,payload,at")
          .eq("agent_id", agent_id)
          .in("name", ["value_view", "question_view", "value_answer"])
          .gte("at", oldest)
          .order("at", { ascending: false })
          .limit(20_000),
        "the value events",
      ),
      boundedRead(
        db.from("rift_leads")
          .select("session_id")
          .eq("agent_id", agent_id)
          .not("plan_token", "is", null)
          .gte("plan_saved_at", oldest)
          .limit(10_000),
        "the saved plans",
      ),
    ]);

    /* The v4 table is the one that can be absent in a schema that has moved
       on; a missing relation is "none", anything else is a failed read. The
       events are the live half and have no such excuse. */
    if (!v4.ok && !/does not exist|schema cache/i.test(v4.error)) return v4;
    if (!events.ok) return events;
    if (!savers.ok) return savers;

    const rows = (v4.ok && "data" in v4 ? v4.data ?? [] : []) as unknown as {
      id: string; session_id: string; side: "buy" | "sell"; county: string | null; started_at: string;
      rift_answers: { question_key: string }[]; rift_leads: { email: string | null }[];
    }[];

    const saved = new Set((("data" in savers ? savers.data : []) as { session_id: string | null }[]).flatMap((r) => (r.session_id ? [r.session_id] : [])));
    const started = unfinishedValues(
      (("data" in events ? events.data : []) as { session_id: string; name: ValueEvent["name"]; payload: Record<string, unknown> | null; at: string }[]).map((e) => ({
        session: e.session_id,
        name: e.name,
        at: e.at,
        tool: typeof e.payload?.tool === "string" ? e.payload.tool : "",
        answered: typeof e.payload?.answered === "number" ? e.payload.answered : undefined,
        of: typeof e.payload?.of === "number" ? e.payload.of : undefined,
        step: typeof e.payload?.step === "number" ? e.payload.step : undefined,
      })),
      { now, minHoursQuiet, saved },
    ).slice(0, LOOKUP_CAP);

    /* Whose address is on file, by session. A visitor with none is listed
       without one, which is correct: a resume link goes only to somebody who
       gave an address. */
    const emails = new Map<string, string>();
    if (started.length) {
      const leads = await boundedRead(
        db.from("rift_leads").select("session_id,email").eq("agent_id", agent_id).in("session_id", started.map((s) => s.sessionId)),
        "the addresses on file",
      );
      if (!leads.ok) return leads;
      for (const l of (("data" in leads ? leads.data : []) ?? []) as { session_id: string | null; email: string | null }[]) {
        if (l.session_id && l.email) emails.set(l.session_id, l.email);
      }
    }

    const all: (Abandoned & { sortAt: number })[] = [
      ...rows.map((r) => ({
        assessmentId: r.id,
        sessionId: r.session_id,
        side: r.side,
        tool: null,
        county: r.county,
        startedAt: r.started_at,
        answered: r.rift_answers?.length ?? 0,
        email: r.rift_leads?.[0]?.email ?? null,
        hoursSince: Math.floor((now - new Date(r.started_at).getTime()) / 3_600_000),
        sortAt: new Date(r.started_at).getTime(),
      })),
      ...started.map((s) => ({
        assessmentId: null,
        sessionId: s.sessionId,
        side: s.side,
        tool: s.tool,
        county: null,
        startedAt: s.startedAt,
        answered: s.answered,
        email: emails.get(s.sessionId) ?? null,
        /* From their last move, which is what "quiet for" means. */
        hoursSince: s.hoursQuiet,
        sortAt: Date.parse(s.lastAt),
      })),
    ];
    return done(all.sort((a, b) => b.sortAt - a.sortAt).map(({ sortAt: _s, ...rest }) => rest));
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
