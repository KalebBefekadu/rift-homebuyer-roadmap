import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { readProgress, shapeEvents } from "./progress";
import {
  ASSIGNABLE, anyStepById, assignmentError, checklist, markError, recordError, stepById,
  type Assignable, type MarkInput, type MarkState, type StepMark, type StepView, type WorkForChecklist,
} from "@/lib/core/checklist";
import { teamTablesMissing } from "./team";
import { progressOf, type Stage } from "@/lib/core/progress";

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

type Db = NonNullable<ReturnType<typeof serviceClient>>;

/**
 * Who does each step, where the agent changed it. A deployment without the
 * table has no assignments: the defaults, which is what it had before.
 */
export async function readAssignments(db: Db, agentId: string): Promise<DbResult<Map<string, Assignable>>> {
  const r = await boundedRead(db.from("rift_step_assignments").select("step_id,doer").eq("agent_id", agentId).limit(500), "who does each step");
  if (!r.ok) return teamTablesMissing(r.error) ? done(new Map()) : r;
  return done(new Map((("data" in r ? r.data : []) as { step_id: string; doer: Assignable }[])
    .filter((x) => ASSIGNABLE.includes(x.doer)).map((x) => [x.step_id, x.doer])));
}

export interface AssignmentRecord { doer: Assignable; by: string; at: string }

/** For Settings: every changed step, with who changed it and when. Null without the table. */
export async function assignmentsForSettings(): Promise<DbResult<Map<string, AssignmentRecord> | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const r = await boundedRead(db.from("rift_step_assignments").select("step_id,doer,actor_label,updated_at").eq("agent_id", agentId).limit(500), "who does each step");
  if (!r.ok) return teamTablesMissing(r.error) ? done(null) : r;
  return done(new Map((("data" in r ? r.data : []) as Record<string, string>[])
    .map((x) => [x.step_id, { doer: x.doer as Assignable, by: x.actor_label, at: x.updated_at }])));
}

/**
 * Hand a step to someone. Choosing the step's own default removes the row,
 * so "changed from the default" stays a fact rather than a row that happens
 * to agree with it.
 */
export async function setAssignment(stepId: string, doer: string, agentLabel: string): Promise<DbResult<{ stepId: string }>> {
  const step = anyStepById(stepId);
  const bad = assignmentError(step, doer);
  if (bad) return failed(bad);
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const w = doer === step!.doer
    ? await boundedWrite(db.from("rift_step_assignments").delete().eq("agent_id", agentId).eq("step_id", stepId), "who does it")
    : await boundedWrite(db.from("rift_step_assignments").upsert({
        agent_id: agentId, step_id: stepId, doer, actor_label: agentLabel.slice(0, 120), updated_at: new Date().toISOString(),
      }, { onConflict: "agent_id,step_id" }), "who does it");
  if (!w.ok) return teamTablesMissing(w.error) ? failed("Choosing who does each step needs a database update (migration 20260929000000, in output/pending-migrations.sql).") : w;
  return done({ stepId });
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
  const [marks, assigned] = await Promise.all([readMarks(db, journeyId, agentId), readAssignments(db, agentId)]);
  if (!marks.ok || !("data" in marks)) return marks as DbResult<never>;
  if (!assigned.ok || !("data" in assigned)) return assigned as DbResult<never>;
  return done({
    steps: checklist(side, stage, marks.data ?? new Map(), work, assigned.data),
    unavailable: marks.data ? null : CHECKLIST_NOT_YET,
  });
}

/**
 * Record one mark against one step. `expectedSeq` is the step's latest mark
 * as the page saw it (0 for none): two people recording at once, one is told
 * to reload rather than one silently undoing the other.
 */
export type Recorder = { kind: "agent"; label: string } | { kind: "coordinator"; label: string; memberId: string; agentId: string };

export async function recordStep(
  journeyId: string, stepId: string, input: MarkInput, expectedSeq: number, recorder: Recorder, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  /* A coordinator's agent comes from their membership, never from the page. */
  const agentId = recorder.kind === "coordinator" ? recorder.agentId : await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const agentLabel = recorder.label;

  const again = await boundedRead(db.from("rift_step_marks").select("seq").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(), "the change");
  if (!again.ok) return missing(again.error) ? failed(CHECKLIST_NOT_YET) : again;
  if ("data" in again && again.data) return done({ seq: (again.data as { seq: number }).seq });

  const j = await boundedRead(db.from("rift_journeys").select("side").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  const side = ("data" in j ? (j.data as { side: "buy" | "sell" } | null)?.side : null);
  if (!side) return failed("That journey is not yours, or it no longer exists");
  const step = stepById(side, stepId);
  if (!step) return failed("That is not a step on this journey's checklist");

  const [progress, marks, assigned] = await Promise.all([readProgress(journeyId, agentId), readMarks(db, journeyId, agentId), readAssignments(db, agentId)]);
  if (!progress.ok || !("data" in progress)) return progress as DbResult<never>;
  if (!marks.ok || !("data" in marks)) return marks as DbResult<never>;
  if (!assigned.ok || !("data" in assigned)) return assigned as DbResult<never>;
  if (!marks.data) return failed(CHECKLIST_NOT_YET);
  const history = marks.data.get(stepId) ?? [];
  const latestSeq = history.length ? history[history.length - 1].seq : 0;
  if (latestSeq !== expectedSeq) return failed("This step changed since the page loaded. Reload and try again");

  const view = checklist(side, progress.data.progress.stage, marks.data, workForChecklist(progress.data.open?.work), assigned.data)
    .find((v) => v.step.id === stepId)!;
  const bad = recordError(view, recorder.kind) ?? markError(step, view.state, input);
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

export interface CoordinatorJourney {
  journeyId: string;
  person: string;
  label: string;
  side: "buy" | "sell";
  stage: Stage;
  /** The coordinator's steps in the stage the journey is in, open ones first. */
  steps: StepView[];
}

/**
 * The coordinator's page: every active journey of their agent, with the
 * coordinator's steps in the stage it is in. Read in one round per table
 * across the book, not one journey at a time.
 *
 * Only what the steps need: the client's name, the journey's label and
 * stage. No readout, finances, notes or documents reach a coordinator.
 * Workstream steps are left out: they are updated on the deal, by the agent.
 */
export async function coordinatorWork(agentId: string): Promise<DbResult<CoordinatorJourney[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [journeys, events, marks, assigned] = await Promise.all([
    boundedRead(db.from("rift_journeys").select("id,origin_lead_id,side,label").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(200), "the journeys"),
    boundedRead(db.from("rift_journey_events").select("journey_id,seq,kind,from_value,to_value,reason,evidence,transaction_id,actor_label,created_at").eq("agent_id", agentId).order("seq").limit(10000), "where each journey stands"),
    boundedRead(db.from("rift_step_marks").select("journey_id,step_id,seq,state,by_name,done_on,note,actor_label,created_at").eq("agent_id", agentId).order("seq").limit(20000), "the checklists"),
    readAssignments(db, agentId),
  ]);
  for (const r of [journeys, events]) if (!r.ok) return /rift_journey/.test(r.error) && /does not exist|schema cache/i.test(r.error) ? done(null) : r;
  if (!marks.ok) return missing(marks.error) ? done(null) : marks;
  if (!assigned.ok || !("data" in assigned)) return assigned as DbResult<never>;
  const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

  const js = rows(journeys);
  const leadIds = [...new Set(js.map((j) => j.origin_lead_id as string))];
  const leads = leadIds.length
    ? await boundedRead(db.from("rift_leads").select("id,name").eq("agent_id", agentId).in("id", leadIds), "the names")
    : done([]);
  const nameOf = new Map(rows(leads).map((l) => [l.id as string, ((l.name as string | null) ?? "").trim() || "A client"]));

  const out: CoordinatorJourney[] = [];
  for (const j of js) {
    const id = j.id as string;
    const p = progressOf(shapeEvents(rows(events).filter((e) => e.journey_id === id)));
    if (p.status !== "active") continue;
    const m = new Map<string, StepMark[]>();
    for (const x of rows(marks).filter((y) => y.journey_id === id)) {
      const list = m.get(x.step_id as string) ?? [];
      list.push({
        seq: x.seq as number, state: x.state as MarkState, byName: (x.by_name as string | null) ?? null,
        doneOn: (x.done_on as string | null) ?? null, note: (x.note as string | null) ?? null, by: x.actor_label as string, at: x.created_at as string,
      });
      m.set(x.step_id as string, list);
    }
    const side = j.side as "buy" | "sell";
    const steps = checklist(side, p.stage, m, null, assigned.data)
      .filter((v) => v.doer === "tc" && v.step.stage === p.stage && !v.step.stream);
    if (!steps.length) continue;
    out.push({ journeyId: id, person: nameOf.get(j.origin_lead_id as string) ?? "A client", label: j.label as string, side, stage: p.stage, steps });
  }
  return done(out);
}
