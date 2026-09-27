import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead } from "./bounded";
import { withTimeout, WRITE_DEADLINE_MS } from "@/lib/core/timeout";
import { sanitise, type EventInput } from "@/lib/core/telemetry";
import type { LadderEvent } from "@/lib/core/ladder";

export { EVENT_NAMES, isEventName, sanitise, type EventName, type EventInput } from "@/lib/core/telemetry";

/**
 * Telemetry writes.
 *
 * The privacy rule is enforced three times over, on purpose, because it is the
 * one that cannot be walked back once it is broken: an answer value that
 * reaches this table is a stranger's finances sitting in an analytics store,
 * and deleting it later does not undo having collected it.
 *
 *   1. `EventInput` has no field that could hold one.
 *   2. `sanitise()` strips anything that smells like one before the write.
 *   3. A CHECK constraint on `rift_events` rejects the row outright.
 *
 * Three layers for one rule is not paranoia here. The first two are guidance a
 * future caller can route around; only the third is a guarantee.
 */

export async function recordEvents(events: EventInput[]): Promise<DbResult<{ written: number }>> {
  if (!events.length) return done({ written: 0 });

  const db = serviceClient();
  if (!db) return skipped("no database configured; events are not being recorded");

  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet. Run the bootstrap before collecting traffic");

  try {
    const rows = events.map((e) => ({
      agent_id,
      session_id: e.sessionId,
      name: e.name,
      side: e.side ?? null,
      question_key: e.questionKey ?? null,
      dwell_ms: typeof e.dwellMs === "number" ? Math.max(0, Math.round(e.dwellMs)) : null,
      payload: sanitise(e.meta),
    }));

    /* Bounded. Telemetry must never break a funnel, and an unbounded insert
       against a hung database holds the visitor's request open until the
       platform kills it, which is a worse outcome than losing the events. */
    const { value: result, timedOut } = await withTimeout(
      Promise.resolve(db.from("rift_events").insert(rows)),
      WRITE_DEADLINE_MS,
      null,
    );
    if (timedOut) return failed("the events did not write in time");
    if (result?.error) return failed(result.error.message);
    return done({ written: rows.length });
  } catch (e) {
    return failed(e);
  }
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

export interface StepStat {
  questionKey: string;
  reached: number;
  answered: number;
  dropPct: number;
  medianSec: number;
}

/**
 * Per-question drop-off, counted in DISTINCT SESSIONS.
 *
 * Counting rows would inflate every figure: a person who backs up and re-reads
 * a question generates two `question_view` rows and is still one person. The
 * prototype had this bug, de-duplicating on millisecond timestamps, and it
 * quietly overstated reach.
 */
/**
 * Per-question drop-off, aggregated in the database.
 *
 * It used to fetch every matching event and count distinct sessions in
 * JavaScript: 45,000 rows over the wire to produce seven numbers, on every
 * Studio load. At five years of traffic that is a page that times out, and the
 * failure would arrive exactly when the data finally meant something.
 *
 * The window matters more than the speed. There was no time bound, so the
 * report mixed last year's funnel with this week's, and the point of measuring
 * drop-off is to change a question and see whether it helped. Averaged against
 * twelve months of the old wording, it never would.
 */
export async function funnelReport(
  side: "buy" | "sell",
  days = 90,
): Promise<DbResult<{ starts: number; steps: StepStat[]; days: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const [report, starts] = await Promise.all([
      boundedRead(
        db.rpc("rift_funnel_report", { p_agent: agent_id, p_side: side, p_days: days }),
        "the funnel report",
      ),
      boundedRead(
        db.rpc("rift_funnel_starts", { p_agent: agent_id, p_side: side, p_days: days }),
        "the assessment starts",
      ),
    ]);

    if (!report.ok) return report;
    if (!starts.ok) return starts;

    const rows = (("data" in report ? report.data : []) ?? []) as {
      question_key: string; reached: number; answered: number; median_dwell_ms: number;
    }[];

    const steps: StepStat[] = rows.map((r) => ({
      questionKey: r.question_key,
      reached: r.reached,
      answered: r.answered,
      /* Floored at zero. More answers than views is possible in the data:
         a resumed session answers a question it never viewed in this window:
         and a negative drop-off rendered as "-3%" reads as a bug rather than
         as the edge case it is. */
      dropPct: r.reached ? Math.max(0, Math.round(((r.reached - r.answered) / r.reached) * 100)) : 0,
      medianSec: Math.round((r.median_dwell_ms / 1000) * 10) / 10,
    }));

    return done({
      starts: (("data" in starts ? starts.data : 0) as number) ?? 0,
      steps,
      days,
    });
  } catch (e) {
    return failed(e);
  }
}

/**
 * The value ladder's events (Blueprint v5 §5.1), the last `days` days. Only
 * the value's id is read from the payload; there is nothing else in it.
 */
export async function ladderEvents(days = 90): Promise<DbResult<LadderEvent[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const r = await boundedRead(
    db.from("rift_events").select("session_id,name,payload").eq("agent_id", agent_id)
      .in("name", ["value_view", "value_answer"]).gte("at", since).limit(20_000),
    "the value events",
  );
  if (!r.ok) return r;
  const rows = ("data" in r ? r.data : []) as { session_id: string; name: "value_view" | "value_answer"; payload: { tool?: unknown } }[];
  return done(rows.map((x) => ({ session: x.session_id, name: x.name, tool: typeof x.payload?.tool === "string" ? x.payload.tool : "" })));
}

/**
 * Conversion, kept apart (requirements §12): plans saved, and calls asked
 * for, in the last `days` days. A requested call is not a confirmed one, and
 * the page says so; confirmations arrive with Cal.com.
 */
export async function conversionCounts(days = 90): Promise<DbResult<{ savedPlans: number; callRequests: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [plans, calls] = await Promise.all([
    boundedRead(db.from("rift_leads").select("id").eq("agent_id", agent_id).gte("plan_saved_at", since).limit(10_000), "saved plans"),
    boundedRead(db.from("rift_events").select("session_id").eq("agent_id", agent_id).eq("name", "booking_complete").gte("at", since).limit(10_000), "call requests"),
  ]);
  /* Before the plan columns exist, no plan has been saved. */
  if (!plans.ok && !/plan_saved_at/.test(plans.error)) return plans;
  if (!calls.ok) return calls;
  const savedPlans = plans.ok && "data" in plans ? (plans.data as unknown[]).length : 0;
  const callRequests = "data" in calls ? new Set((calls.data as { session_id: string }[]).map((x) => x.session_id)).size : 0;
  return done({ savedPlans, callRequests });
}
