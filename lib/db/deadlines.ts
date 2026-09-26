import "server-only";
import { randomUUID } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { readProgress } from "./progress";
import {
  amendmentError, deadlineError, deadlineView, labelError, resolve,
  type AmendmentChange, type DeadlineInput, type DeadlineKind, type DeadlineView, type Revision, type RevisionState, type RuleId,
} from "@/lib/core/deadline";
import { WORKSTREAMS, type Workstream } from "@/lib/core/progress";

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

export const shapeRevision = (r: Record<string, unknown>): Revision => ({
  seq: r.seq as number, state: r.state as RevisionState, dueDate: r.due_date as string,
  dueTime: r.due_time ? String(r.due_time).slice(0, 5) : null, timezone: r.timezone as string, dueAt: (r.due_at as string | null) ?? null,
  rule: r.rule as RuleId, triggerLabel: (r.trigger_label as string | null) ?? null, triggerDate: (r.trigger_date as string | null) ?? null,
  days: (r.days as number | null) ?? null, sourceTerm: r.source_term as string, sourcePage: (r.source_page as string | null) ?? null,
  sourceDocumentId: (r.source_document_id as string | null) ?? null, amendment: (r.amendment as string | null) ?? null,
  verified: r.verified as boolean, note: (r.note as string | null) ?? null, by: r.actor_label as string, at: r.created_at as string,
});

export async function readDeadlines(journeyId: string, agentId: string, now = new Date()): Promise<DbResult<{ deadlines: DeadlineRecord[]; unavailable?: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [ds, rs] = await Promise.all([
    boundedRead(db.from("rift_deadlines").select("id,transaction_id,label,kind,workstream,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(200), "the contract dates"),
    boundedRead(db.from("rift_deadline_revisions")
      .select("deadline_id,seq,state,due_date,due_time,timezone,due_at,rule,trigger_label,trigger_date,days,source_term,source_page,source_document_id,amendment,verified,note,actor_label,created_at")
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

export interface DateAttention {
  journeyId: string;
  person: string;
  label: string;
  when: string;
  why: "missed" | "unchecked" | "soon";
  days: number | null;
}

/** Days ahead that an upcoming checked date is shown on Today. */
export const SOON_DAYS = 3;

/**
 * Every date across the agent's open contracts that needs him: missed ones
 * (AT29), ones not yet checked against the document, and checked ones due
 * within SOON_DAYS. Contracts that closed or were terminated are left out;
 * their dates stay on the journey's record.
 */
export async function datesNeedingAttention(now = new Date()): Promise<DbResult<DateAttention[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const [ds, rs, ended] = await Promise.all([
    boundedRead(db.from("rift_deadlines").select("id,journey_id,transaction_id,label,kind").eq("agent_id", agentId).limit(1000), "the contract dates"),
    boundedRead(db.from("rift_deadline_revisions")
      .select("deadline_id,seq,state,due_date,due_time,timezone,due_at,rule,trigger_label,trigger_date,days,source_term,source_page,source_document_id,amendment,verified,note,actor_label,created_at")
      .eq("agent_id", agentId).order("seq").limit(5000), "the contract dates"),
    boundedRead(db.from("rift_transaction_outcomes").select("transaction_id").eq("agent_id", agentId).limit(1000), "the contracts"),
  ]);
  for (const r of [ds, rs, ended]) if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const endedIds = new Set(rows(ended).map((x) => x.transaction_id as string));
  const revs = new Map<string, Revision[]>();
  for (const r of rows(rs)) {
    const l = revs.get(r.deadline_id as string) ?? [];
    l.push(shapeRevision(r));
    revs.set(r.deadline_id as string, l);
  }
  const live = rows(ds).filter((d) => !endedIds.has(d.transaction_id as string) && revs.has(d.id as string));
  const journeyIds = [...new Set(live.map((d) => d.journey_id as string))];
  const people = new Map<string, string>();
  if (journeyIds.length) {
    const j = await boundedRead(db.from("rift_journeys").select("id,origin_lead_id").eq("agent_id", agentId).in("id", journeyIds), "the journeys");
    const leadOf = new Map(rows(j).map((x) => [x.id as string, x.origin_lead_id as string]));
    const l = await boundedRead(db.from("rift_leads").select("id,name").eq("agent_id", agentId).in("id", [...new Set(leadOf.values())]), "the people");
    const nameOf = new Map(rows(l).map((x) => [x.id as string, (x.name as string | null) ?? "Someone"]));
    for (const [jid, lid] of leadOf) people.set(jid, nameOf.get(lid) ?? "Someone");
  }
  const out: DateAttention[] = [];
  for (const d of live) {
    const v = deadlineView(revs.get(d.id as string)!, d.kind as DeadlineKind, now);
    if (v.state !== "active") continue;
    const why = v.missed ? "missed" : !v.verified ? "unchecked" : v.days !== null && v.days <= SOON_DAYS ? "soon" : null;
    if (!why) continue;
    out.push({ journeyId: d.journey_id as string, person: people.get(d.journey_id as string) ?? "Someone", label: d.label as string, when: v.when, why, days: v.days });
  }
  const order = { missed: 0, unchecked: 1, soon: 2 };
  return done(out.sort((a, b) => order[a.why] - order[b.why] || (a.days ?? 0) - (b.days ?? 0)));
}
