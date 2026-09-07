import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { withTimeout, WRITE_DEADLINE_MS } from "@/lib/core/timeout";
import { sanitise, type EventInput } from "@/lib/core/telemetry";

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
  if (!db) return skipped("no database configured — events are not being recorded");

  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet — run the bootstrap before collecting traffic");

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
       platform kills it — which is a worse outcome than losing the events. */
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
export async function funnelReport(side: "buy" | "sell"): Promise<DbResult<{ starts: number; steps: StepStat[] }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  try {
    const { data, error } = await db
      .from("rift_events")
      .select("session_id,name,question_key,dwell_ms")
      .eq("side", side)
      .in("name", ["assessment_start", "question_view", "question_answer"]);

    if (error) return failed(error.message);

    const rows = (data ?? []) as { session_id: string; name: string; question_key: string | null; dwell_ms: number | null }[];
    const starts = new Set(rows.filter((r) => r.name === "assessment_start").map((r) => r.session_id)).size;

    const byKey = new Map<string, { seen: Set<string>; answered: Set<string>; dwells: number[] }>();
    for (const r of rows) {
      if (!r.question_key) continue;
      let e = byKey.get(r.question_key);
      if (!e) { e = { seen: new Set(), answered: new Set(), dwells: [] }; byKey.set(r.question_key, e); }
      if (r.name === "question_view") e.seen.add(r.session_id);
      if (r.name === "question_answer") {
        e.answered.add(r.session_id);
        if (typeof r.dwell_ms === "number") e.dwells.push(r.dwell_ms);
      }
    }

    const steps: StepStat[] = [...byKey.entries()].map(([questionKey, e]) => {
      const reached = e.seen.size;
      const answered = e.answered.size;
      const sorted = e.dwells.slice().sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      return {
        questionKey,
        reached,
        answered,
        dropPct: reached ? Math.round(((reached - answered) / reached) * 100) : 0,
        medianSec: Math.round((median / 1000) * 10) / 10,
      };
    });

    return done({ starts, steps });
  } catch (e) {
    return failed(e);
  }
}
