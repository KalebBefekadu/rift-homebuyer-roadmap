import "server-only";
import { randomUUID } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { readProgress } from "./progress";
import {
  amendmentError, deadlineError, deadlineView, labelError, resolve,
  type AmendmentChange, type DeadlineInput, type DeadlineKind, type DeadlineView, type Revision, type RevisionState,
} from "@/lib/core/deadline";
import { WORKSTREAMS, type Workstream } from "@/lib/core/progress";
import { datesNeeding, type DateAttention } from "@/lib/core/transactions";
import { allContracts } from "./transactions";
import { REVISION_COLUMNS, shapeRevision } from "./revisions";

/**
 * Contract dates (blueprint v4 W09). The only writer of rift_deadlines and
 * rift_deadline_revisions; the rules are lib/core/deadline.ts.
 *
 * A date belongs to one contract, and is added or revised only while that
 * contract is open. An amendment writes every revision it makes in a single
 * INSERT: Postgres applies one statement whole or not at all, so a moved due
 * diligence date and a moved closing date can never end up half-applied, and
 * a conflict on any of them (somebody revised it since the page loaded)
 * refuses the lot (AT27).
 */

export interface DeadlineRecord {
  id: string;
  transactionId: string;
  label: string;
  kind: DeadlineKind;
  workstream: Workstream | null;
  revisions: Revision[];
  view: DeadlineView;
}

const NOT_YET = "Contract dates need a database update that has not been applied yet (migration 20260924030000).";
const CHANGED = "A date changed since the page loaded. Reload and try again";
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);


export async function readDeadlines(journeyId: string, agentId: string, now = new Date()): Promise<DbResult<{ deadlines: DeadlineRecord[]; unavailable?: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [ds, rs] = await Promise.all([
    boundedRead(db.from("rift_deadlines").select("id,transaction_id,label,kind,workstream,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(200), "the contract dates"),
    boundedRead(db.from("rift_deadline_revisions")
      .select(REVISION_COLUMNS)
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("seq").limit(2000), "the contract dates"),
  ]);
  for (const r of [ds, rs]) if (!r.ok) return journeyTablesMissing(r.error) ? done({ deadlines: [], unavailable: NOT_YET }) : r;
  const byDeadline = new Map<string, Revision[]>();
  for (const r of rows(rs)) {
    const l = byDeadline.get(r.deadline_id as string) ?? [];
    l.push(shapeRevision(r));
    byDeadline.set(r.deadline_id as string, l);
  }
  const deadlines: DeadlineRecord[] = [];
  for (const d of rows(ds)) {
    const revisions = byDeadline.get(d.id as string) ?? [];
    if (!revisions.length) continue;
    const kind = d.kind as DeadlineKind;
    deadlines.push({
      id: d.id as string, transactionId: d.transaction_id as string, label: d.label as string, kind,
      workstream: (d.workstream as Workstream | null) ?? null, revisions, view: deadlineView(revisions, kind, now),
    });
  }
  /* Soonest first; finished ones last. */
  deadlines.sort((a, b) => (a.view.state === "active" ? 0 : 1) - (b.view.state === "active" ? 0 : 1) || a.view.current.dueDate.localeCompare(b.view.current.dueDate));
  return done({ deadlines });
}

export async function deadlinesFor(journeyId: string) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return readDeadlines(journeyId, agentId);
}

function revisionRow(agentId: string, journeyId: string, deadlineId: string, seq: number, state: RevisionState, input: DeadlineInput,
  extra: { amendment?: string | null; note?: string | null; actor: string; requestId: string }) {
  const r = resolve(input)!;
  return {
    agent_id: agentId, journey_id: journeyId, deadline_id: deadlineId, seq, state,
    due_date: r.dueDate, due_time: r.dueTime, timezone: r.timezone, due_at: r.dueAt, rule: input.rule,
    trigger_label: input.rule === "as-written" ? null : input.triggerLabel?.trim() || null,
    trigger_date: input.rule === "as-written" ? null : input.triggerDate, days: input.rule === "as-written" ? null : input.days,
    source_term: input.sourceTerm.trim(), source_page: input.sourcePage?.trim() || null, source_document_id: input.sourceDocumentId || null,
    amendment: extra.amendment?.trim() || null, verified: input.verified, note: (extra.note ?? input.note)?.trim() || null,
    actor_label: extra.actor.slice(0, 120), request_id: extra.requestId,
  };
}

/** The same date as the current revision, as an input: for marking met, removed or checked. */
const asInput = (c: Revision, verified: boolean): DeadlineInput => ({
  rule: c.rule, date: c.rule === "as-written" ? c.dueDate : null, time: c.dueTime, timezone: c.timezone,
  triggerLabel: c.triggerLabel, triggerDate: c.triggerDate, days: c.days,
  sourceTerm: c.sourceTerm, sourcePage: c.sourcePage, sourceDocumentId: c.sourceDocumentId, verified,
});

async function context(journeyId: string) {
  const db = serviceClient();
  if (!db) return { skip: skipped("no database configured") } as const;
  const agentId = await currentAgentId();
  if (!agentId) return { skip: skipped("no agent row exists yet") } as const;
  const [p, d] = await Promise.all([readProgress(journeyId, agentId), readDeadlines(journeyId, agentId)]);
  if (!p.ok || !("data" in p)) return { skip: p as DbResult<never> } as const;
  if (!d.ok || !("data" in d)) return { skip: d as DbResult<never> } as const;
  if (d.data.unavailable) return { skip: failed(d.data.unavailable) } as const;
  return { db, agentId, open: p.data.open, deadlines: d.data.deadlines } as const;
}

async function sourceOnJourney(db: NonNullable<ReturnType<typeof serviceClient>>, journeyId: string, agentId: string, id: string | null | undefined) {
  if (!id) return null;
  const r = await boundedRead(db.from("rift_documents").select("id").eq("id", id).eq("journey_id", journeyId).eq("agent_id", agentId).maybeSingle(), "the document");
  return r.ok && "data" in r && r.data ? null : "That document is not on this journey";
}

/** Add a date to the open contract. */
export async function addDeadline(
  journeyId: string, label: string, kind: DeadlineKind, workstream: Workstream | null, input: DeadlineInput, agentLabel: string, requestId: string,
): Promise<DbResult<{ id: string }>> {
  const c = await context(journeyId);
  if ("skip" in c) return c.skip as DbResult<never>;
  const replay = await boundedRead(c.db.from("rift_deadlines").select("id").eq("request_id", requestId).eq("agent_id", c.agentId).maybeSingle(), "the date");
  if (!replay.ok) return replay;
  if ("data" in replay && replay.data) return done({ id: (replay.data as { id: string }).id });
  if (!c.open) return failed("Dates belong to a contract. Record the contract first");
  const bad = labelError(label) ?? (kind !== "contractual" && kind !== "target" ? "Say whether it is in the contract or your own target" : null)
    ?? (workstream && !WORKSTREAMS.includes(workstream) ? "That is not one of the contract's workstreams" : null)
    ?? deadlineError(input) ?? await sourceOnJourney(c.db, journeyId, c.agentId, input.sourceDocumentId);
  if (bad) return failed(bad);

  const d = await boundedWrite(c.db.from("rift_deadlines").insert({
    agent_id: c.agentId, journey_id: journeyId, transaction_id: c.open.id, label: label.trim(), kind, workstream,
    actor_label: agentLabel.slice(0, 120), request_id: requestId,
  }).select("id").single(), "the date");
  if (!d.ok) return d;
  const id = (("data" in d ? d.data : null) as { id: string }).id;
  const r = await boundedWrite(c.db.from("rift_deadline_revisions").insert(
    revisionRow(c.agentId, journeyId, id, 1, "active", input, { actor: agentLabel, requestId: randomUUID() }),
  ), "the date");
  if (!r.ok) {
    await boundedWrite(c.db.from("rift_deadlines").delete().eq("id", id).eq("agent_id", c.agentId), "the date");
    return r;
  }
  return done({ id });
}

export type Revise =
  | { to: "active"; input: DeadlineInput }
  | { to: "checked" }
  | { to: "met" | "removed"; note: string };

/**
 * One revision of one date: a correction, checking it against the document,
 * or recording that it was met or no longer applies (with how).
 */
export async function reviseDeadline(journeyId: string, deadlineId: string, change: Revise, expectedSeq: number, agentLabel: string, requestId: string): Promise<DbResult<{ seq: number }>> {
  const c = await context(journeyId);
  if ("skip" in c) return c.skip as DbResult<never>;
  const replay = await boundedRead(c.db.from("rift_deadline_revisions").select("seq").eq("request_id", requestId).eq("agent_id", c.agentId).maybeSingle(), "the date");
  if (!replay.ok) return replay;
  if ("data" in replay && replay.data) return done({ seq: (replay.data as { seq: number }).seq });
  const d = c.deadlines.find((x) => x.id === deadlineId);
  if (!d) return failed("That date is not on this journey");
  if (!c.open || c.open.id !== d.transactionId) return failed("That contract is not open any more");
  const cur = d.view.current;
  if (cur.seq !== expectedSeq) return failed(CHANGED);
  if (cur.state !== "active") return failed("That date is finished. Add a new one if it applies again");

  let input: DeadlineInput;
  let state: RevisionState = "active";
  let note: string | null = null;
  if (change.to === "active") {
    input = change.input;
    const bad = deadlineError(input) ?? await sourceOnJourney(c.db, journeyId, c.agentId, input.sourceDocumentId);
    if (bad) return failed(bad);
  } else if (change.to === "checked") {
    if (cur.verified) return failed("That date is already checked");
    input = asInput(cur, true);
  } else {
    if (change.note.trim().length < 3) return failed(change.to === "met" ? "Say what shows it was met" : "Say why it no longer applies");
    input = asInput(cur, cur.verified);
    state = change.to;
    note = change.note;
  }
  const w = await boundedWrite(c.db.from("rift_deadline_revisions").insert(
    revisionRow(c.agentId, journeyId, deadlineId, cur.seq + 1, state, input, { note, actor: agentLabel, requestId }),
  ), "the date");
  if (!w.ok) return /rift_deadline_revisions_seq|duplicate key/.test(w.error) ? failed(CHANGED) : w;
  return done({ seq: cur.seq + 1 });
}

/**
 * An executed amendment: every date it changes, in one statement (AT27). A
 * removed date keeps its last date with state "removed"; a moved one gets
 * its new terms, checked against the amendment.
 */
export async function recordAmendment(
  journeyId: string, reference: string, changes: (AmendmentChange & { expectedSeq: number })[], agentLabel: string, requestId: string,
): Promise<DbResult<{ changed: number }>> {
  const c = await context(journeyId);
  if ("skip" in c) return c.skip as DbResult<never>;
  const replay = await boundedRead(c.db.from("rift_deadline_revisions").select("seq").eq("request_id", requestId).eq("agent_id", c.agentId).maybeSingle(), "the amendment");
  if (!replay.ok) return replay;
  if ("data" in replay && replay.data) return done({ changed: changes.length });
  const bad = amendmentError(reference, changes);
  if (bad) return failed(bad);

  const insertRows = [];
  for (const [i, ch] of changes.entries()) {
    const d = c.deadlines.find((x) => x.id === ch.deadlineId);
    if (!d) return failed("One of those dates is not on this journey");
    if (!c.open || c.open.id !== d.transactionId) return failed("An amendment changes the open contract's dates only");
    const cur = d.view.current;
    if (cur.seq !== ch.expectedSeq) return failed(CHANGED);
    if (cur.state !== "active") return failed(`"${d.label}" is already finished`);
    const src = ch.remove ? null : await sourceOnJourney(c.db, journeyId, c.agentId, ch.input!.sourceDocumentId);
    if (src) return failed(src);
    insertRows.push(revisionRow(c.agentId, journeyId, d.id, cur.seq + 1, ch.remove ? "removed" : "active",
      ch.remove ? { ...asInput(cur, true), sourceTerm: reference } : { ...ch.input!, sourceTerm: ch.input!.sourceTerm || reference },
      { amendment: reference, note: ch.remove ? `Removed by ${reference.trim()}` : null, actor: agentLabel, requestId: i === 0 ? requestId : randomUUID() }));
  }
  const w = await boundedWrite(c.db.from("rift_deadline_revisions").insert(insertRows), "the amendment");
  if (!w.ok) return /rift_deadline_revisions_seq|duplicate key/.test(w.error) ? failed(CHANGED) : w;
  return done({ changed: insertRows.length });
}

export type { DateAttention } from "@/lib/core/transactions";

/** Days ahead that an upcoming checked date is shown in the morning summary. */
export const SOON_DAYS = 3;

/**
 * Every date across the agent's open contracts that needs him: missed ones
 * (AT29), ones not yet checked against the document, and checked ones due
 * within `aheadDays`. Contracts that closed or were terminated are left out;
 * their dates stay on the journey's record. The same read as Transactions
 * (lib/db/transactions.ts), so the two can never disagree about a date.
 */
export async function datesNeedingAttention(now = new Date(), aheadDays = SOON_DAYS): Promise<DbResult<DateAttention[] | null>> {
  const all = await allContracts(now);
  if (!all.ok || !("data" in all)) return all as DbResult<never>;
  return done(all.data ? datesNeeding(all.data, aheadDays) : null);
}
