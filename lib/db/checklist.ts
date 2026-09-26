import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { readProgress } from "./progress";
import {
  checklist, markError, stepById,
  type MarkInput, type MarkState, type StepMark, type StepView, type WorkForChecklist,
} from "@/lib/core/checklist";
import type { Stage } from "@/lib/core/progress";

/**
 * The journey checklist (Blueprint v5 §8.6). The only writer of
 * rift_step_marks; the rules are lib/core/checklist.ts.
 *
 * Every read and write names the agent and the journey, so an id posted from
 * a page is never authority on its own. A deployment that has not had the
 * migration yet still shows the checklist, says it cannot be ticked, and
 * never pretends a tick was saved.
 */

export const CHECKLIST_NOT_YET =
  "The checklist can be read but not ticked yet: it needs the database update of 28 Sep (migration 20260928000000, in output/pending-migrations.sql).";

const missing = (msg: string) => /rift_step_marks/.test(msg) && /does not exist|schema cache|Could not find/i.test(msg);

export interface ChecklistRecord {
  steps: StepView[];
  /** Set when marks cannot be recorded here yet. */
  unavailable: string | null;
}

async function readMarks(db: NonNullable<ReturnType<typeof serviceClient>>, journeyId: string, agentId: string): Promise<DbResult<Map<string, StepMark[]> | null>> {
  const r = await boundedRead(
    db.from("rift_step_marks").select("step_id,seq,state,by_name,done_on,note,actor_label,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("seq").limit(2000),
    "the checklist",
  );
  if (!r.ok) return missing(r.error) ? done(null) : r;
  const map = new Map<string, StepMark[]>();
  for (const m of ("data" in r ? r.data : []) as Record<string, unknown>[]) {
    const list = map.get(m.step_id as string) ?? [];
    list.push({
      seq: m.seq as number, state: m.state as MarkState,
      byName: (m.by_name as string | null) ?? null, doneOn: (m.done_on as string | null) ?? null, note: (m.note as string | null) ?? null,
      by: m.actor_label as string, at: m.created_at as string,
    });
    map.set(m.step_id as string, list);
  }
  return done(map);
}

/** The open contract's workstreams, shaped for the checklist. */
export function workForChecklist(work: { workstream: WorkForChecklist["workstream"]; state: WorkForChecklist["state"]; lastWord: WorkForChecklist["lastWord"]; note: string | null }[] | null | undefined): WorkForChecklist[] | null {
  return work ? work.map((w) => ({ workstream: w.workstream, state: w.state, lastWord: w.lastWord, note: w.note })) : null;
}

/** The checklist for a journey the page has already loaded (its side, stage and open contract). */
export async function checklistFor(journeyId: string, side: "buy" | "sell", stage: Stage, work: WorkForChecklist[] | null): Promise<DbResult<ChecklistRecord>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const marks = await readMarks(db, journeyId, agentId);
  if (!marks.ok || !("data" in marks)) return marks as DbResult<never>;
  return done({
    steps: checklist(side, stage, marks.data ?? new Map(), work),
    unavailable: marks.data ? null : CHECKLIST_NOT_YET,
  });
}

/**
 * Record one mark against one step. `expectedSeq` is the step's latest mark
 * as the page saw it (0 for none): two people recording at once, one is told
 * to reload rather than one silently undoing the other.
 */
export async function recordStep(
  journeyId: string, stepId: string, input: MarkInput, expectedSeq: number, agentLabel: string, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const again = await boundedRead(db.from("rift_step_marks").select("seq").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(), "the change");
  if (!again.ok) return missing(again.error) ? failed(CHECKLIST_NOT_YET) : again;
  if ("data" in again && again.data) return done({ seq: (again.data as { seq: number }).seq });

  const j = await boundedRead(db.from("rift_journeys").select("side").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  const side = ("data" in j ? (j.data as { side: "buy" | "sell" } | null)?.side : null);
  if (!side) return failed("That journey is not yours, or it no longer exists");
  const step = stepById(side, stepId);
  if (!step) return failed("That is not a step on this journey's checklist");

  const [progress, marks] = await Promise.all([readProgress(journeyId, agentId), readMarks(db, journeyId, agentId)]);
  if (!progress.ok || !("data" in progress)) return progress as DbResult<never>;
  if (!marks.ok || !("data" in marks)) return marks as DbResult<never>;
  if (!marks.data) return failed(CHECKLIST_NOT_YET);
  const history = marks.data.get(stepId) ?? [];
  const latestSeq = history.length ? history[history.length - 1].seq : 0;
  if (latestSeq !== expectedSeq) return failed("This step changed since the page loaded. Reload and try again");

  const view = checklist(side, progress.data.progress.stage, marks.data, workForChecklist(progress.data.open?.work))
    .find((v) => v.step.id === stepId)!;
  const bad = markError(step, view.state, input);
  if (bad) return failed(bad);

  const w = await boundedWrite(
    db.from("rift_step_marks").insert({
      agent_id: agentId, journey_id: journeyId, step_id: stepId, seq: latestSeq + 1, state: input.state,
      by_name: input.byName?.trim() || null, done_on: input.doneOn || null,
      note: input.note?.trim() || null, actor_label: agentLabel.slice(0, 120), request_id: requestId,
    }),
    "the step",
  );
  if (!w.ok) return /rift_step_marks_seq|duplicate key/.test(w.error) ? failed("This step changed since the page loaded. Reload and try again") : w;
  return done({ seq: latestSeq + 1 });
}
