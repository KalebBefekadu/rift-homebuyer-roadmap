import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedReport, boundedWrite } from "./bounded";
import {
  stallOf,
  STAGE_NAMES,
  type Stage,
  type NoteKind,
  type LeadNote,
  type ManagedLead,
  type Finished,
} from "@/lib/core/pipeline";

import {
  mayAdvance, type Representation, type Standing, type Status as RepStatus,
} from "@/lib/core/representation";
import { isTerminal, sameContact } from "@/lib/core/people";
import { addNote } from "./notes";
import { representationOf } from "./representation";

export { STAGE_NAMES };
export type { Stage, NoteKind, LeadNote, ManagedLead, Finished };
export type { Representation, Standing, RepStatus };

/**
 * People the agent is actually working.
 *
 * The rest of lib/db serves the funnel: somebody arrives, is scored, and is
 * followed up automatically. This module serves the other half of the job,
 * which came first in practice and second in the build: the ten relationships
 * that already exist and have never been near a form.
 *
 * Two rules hold this together:
 *
 * A STAGE IS NOT A SCORE. `band` is computed urgency and moves on its own as
 * recency decays. `stage` is where somebody IS, it moves only when a human
 * says so, and it is the thing the business is actually run from.
 *
 * THE HISTORY IS APPEND-ONLY. Notes cannot be edited or deleted through the
 * app, and a stage change writes its own note. The value of a contact record
 * is that it says what was true at the time; one that can be tidied up later
 * is a record of the agent's current opinion instead.
 */

export interface NewLead {
  name: string;
  email?: string;
  phone?: string;
  side: "buy" | "sell";
  stage: Stage;
  /** Why this person can be contacted. Required, never inferred. */
  contactBasis: string;
  /** Optional opening note: usually everything the agent already knows. */
  note?: string;
}

const daysSince = (iso: string | null, now: Date) =>
  iso ? Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)) : 0;

function shape(r: Record<string, unknown>, now: Date): ManagedLead {
  const stage = (r.stage as Stage | null) ?? null;
  const stageSince = (r.stage_since as string | null) ?? null;
  return {
    id: r.id as string,
    name: (r.name as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    side: r.side as "buy" | "sell",
    stage,
    stageSince,
    source: (r.source as string) ?? "funnel",
    contactBasis: (r.contact_basis as string | null) ?? null,
    score: (r.score as number | null) ?? null,
    band: (r.band as string | null) ?? null,
    createdAt: r.created_at as string,
    archivedAt: (r.archived_at as string | null) ?? null,
    archivedReason: (r.archived_reason as string | null) ?? null,
    nextAction: (r.next_action as string | null) ?? null,
    nextDue: (r.next_due as string | null) ?? null,
    /* Only meaningful once somebody has been placed on the board. A lead with
       no stage is not "moving slowly", it is simply not being worked yet.
       Nor is a finished one: Closed and Lost have no normal dwell, so
       `ruleFor` fell back to 45 days and every closed client went "Stalled"
       six weeks after closing. */
    stall: stage && !r.archived_at && !isTerminal(stage) ? stallOf(stage, daysSince(stageSince, now)) : null,
  };
}

const SELECT_BASE =
  "id,name,email,phone,side,stage,stage_since,source,contact_basis,score,band,created_at,archived_at,archived_reason";

/**
 * Whether the follow-up columns exist yet.
 *
 * Schema and code ship separately here: the migration is applied by hand in
 * the Supabase dashboard, and a deploy that lands first would otherwise select
 * columns that do not exist and fail EVERY read on this module, taking the
 * board and the client record down with it over a feature nobody had used yet.
 *
 * So the first read asks for them, and a "column does not exist" answer is
 * treated as information rather than an error: remember it, drop the columns,
 * carry on. The next deploy after the migration picks them up on its own.
 * null means not yet determined.
 */
let hasFollowUp: boolean | null = null;

const selectFor = () => (hasFollowUp === false ? SELECT_BASE : `${SELECT_BASE},next_action,next_due`);

/* PostgREST surfaces a missing column as Postgres 42703. Matched on the text
   because the error shape reaching us here is just a message. */
const isMissingColumn = (e: unknown) =>
  typeof e === "string" && /column .* does not exist|42703/i.test(e);

/**
 * Run a read that may or may not be allowed to ask for the follow-up columns.
 *
 * `build` is handed the select string so the same query can be reissued
 * against the narrower one. A missing column costs one extra round trip, once
 * per process, and never after that.
 */
type LeadQuery = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function readLeads(
  build: (select: string) => LeadQuery,
  what: string,
): Promise<DbResult<unknown>> {
  const first = await boundedReport(build(selectFor()) as never, what);
  if (first.ok) {
    if (hasFollowUp === null) hasFollowUp = true;
    return first;
  }
  if (hasFollowUp !== false && isMissingColumn(first.error)) {
    hasFollowUp = false;
    return boundedReport(build(SELECT_BASE) as never, what);
  }
  return first;
}

/**
 * Put somebody in by hand.
 *
 * `contact_basis` is required by the database rather than defaulted here. An
 * agent typing in a person he has known for two years knows exactly why he is
 * allowed to call them; the system does not, and should not guess on his
 * behalf when the guess is the thing a regulator would ask about.
 */
export async function addLead(input: NewLead): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const name = input.name.trim();
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const basis = input.contactBasis.trim();

  if (!name) return failed("a name is required");
  if (!email && !phone) return failed("an email address or a phone number is required");
  if (!basis) return failed("a reason you can contact them is required");

  const created = await boundedWrite(
    db.from("rift_leads").insert({
      agent_id,
      assessment_id: null,
      name,
      email,
      phone,
      side: input.side,
      stage: input.stage,
      stage_since: new Date().toISOString(),
      source: "manual",
      contact_basis: basis,
      /* Deliberately unscored. The score explains a funnel answer set, and
         inventing one for somebody who never answered anything would put a
         fabricated number next to a real person. Studio shows the stage. */
      score: null,
      band: null,
    }).select("id").single(),
    "adding the person",
  );
  if (!created.ok || !("data" in created)) return created as DbResult<{ id: string }>;

  const id = (created.data as { id: string }).id;

  /* Best effort, and deliberately not awaited into the failure path: the
     person is in, which is the thing that was asked for. A lost opening note
     is recoverable by typing it again; a failed insert that discarded the
     whole person is not. */
  if (input.note?.trim()) {
    await addNote(id, "note", input.note.trim());
  }
  await addNote(id, "stage", `Added at ${input.stage}.`, { toStage: input.stage });

  return done({ id });
}


/**
 * Move somebody, and say so in the history.
 *
 * Reads the current stage first so the note can record what it moved FROM.
 * A history of destinations with no origins cannot answer the one question an
 * agent asks it: "how long was this stuck before I noticed?"
 */
export async function setStage(leadId: string, stage: Stage, why?: string): Promise<DbResult<{ stage: Stage }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const current = await boundedReport(
    db.from("rift_leads").select("stage,side").eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
    "reading the current stage",
  );
  const row = current.ok && "data" in current
    ? (current.data as { stage: string | null; side: string } | null)
    : null;
  const from = row?.stage ?? null;

  if (from === stage && !why) return done({ stage });

  /* The representation gate.

     docs/product.md: a buyer journey cannot advance past "Ready to shop", and
     a seller's past pricing and launch, while representation is anything other
     than signed: and Rift "blocks the advance and explains why rather than
     silently allowing it".

     Enforced on the write, not in the component that calls it. A gate that
     lives in a form is a gate that the next caller does not have.

     A read that FAILED does not block. Refusing to let an agent move somebody
     because a query timed out would turn a database blip into a compliance
     alarm, and he has no way to tell the two apart. `representationOf`
     returning `none` on an unreadable row would be the wrong default here for
     exactly that reason, so the failure is distinguished from the answer. */
  if (row) {
    const side = row.side === "sell" ? "sell" : "buy";
    const rep = await representationOf(leadId);
    if (rep.ok && "data" in rep) {
      const check = mayAdvance(side, stage, rep.data);
      if (!check.allowed) return failed(check.because!);
    }
  }

  const res = await boundedWrite(
    db.from("rift_leads")
      .update({ stage, stage_since: new Date().toISOString() })
      .eq("id", leadId)
      .eq("agent_id", agent_id)
      .select("id").single(),
    "moving them",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ stage: Stage }>;

  await addNote(
    leadId,
    "stage",
    why?.trim() || `${from ?? "Unplaced"} → ${stage}`,
    { fromStage: from, toStage: stage },
  );
  return done({ stage });
}

export async function archiveLead(leadId: string, reason: string): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");
  if (!reason.trim()) return failed("a reason is required");

  const res = await boundedWrite(
    db.from("rift_leads")
      .update({ archived_at: new Date().toISOString(), archived_reason: reason.trim() })
      .eq("id", leadId).eq("agent_id", agent_id).select("id").single(),
    "archiving them",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ id: string }>;
  await addNote(leadId, "note", `Archived: ${reason.trim()}`);
  return done({ id: leadId });
}

/**
 * Bring an archived person back.
 *
 * Archiving was a one-way door on the page: the record said "nothing is
 * deleted" and offered no way back, so a client who came back after six months
 * stayed hidden from the board. The archive and the restore are both notes, so
 * the history says when somebody was set aside and when they returned.
 */
export async function restoreLead(leadId: string): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const res = await boundedWrite(
    db.from("rift_leads")
      .update({ archived_at: null, archived_reason: null })
      .eq("id", leadId).eq("agent_id", agent_id).not("archived_at", "is", null)
      .select("id").maybeSingle(),
    "restoring them",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ id: string }>;
  if (!res.data) return failed("they are not archived");
  await addNote(leadId, "note", "Restored from the archive.");
  return done({ id: leadId });
}

/**
 * Whoever is already on record with this email or phone, so adding the same
 * person twice is a decision and not an accident. Phones are stored as typed,
 * so the database narrows by the last four digits and `sameContact` decides.
 */
export async function lookalikes(email?: string | null, phone?: string | null): Promise<DbResult<{ id: string; name: string | null; email: string | null; phone: string | null; stage: string | null }[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const e = escapeForOr((email ?? "").trim().toLowerCase());
  const tail = (phone ?? "").replace(/\D/g, "").slice(-4);
  const conds = [e ? `email.ilike.${e}` : null, tail.length === 4 ? `phone.ilike.*${tail.split("").join("*")}*` : null].filter(Boolean);
  if (!conds.length) return done([]);

  const res = await boundedReport(
    db.from("rift_leads").select("id,name,email,phone,stage").eq("agent_id", agent_id).or(conds.join(",")).limit(25),
    "checking for the same person",
  );
  if (!res.ok || !("data" in res)) return res as never;
  const rows = res.data as { id: string; name: string | null; email: string | null; phone: string | null; stage: string | null }[];
  return done(sameContact(rows, email, phone));
}

export async function readLead(
  leadId: string,
  now = new Date(),
): Promise<DbResult<{ lead: ManagedLead; notes: LeadNote[]; notesError?: string | null }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const leadRes = await readLeads(
    (sel) => db.from("rift_leads").select(sel).eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
    "reading the record",
  );
  if (!leadRes.ok || !("data" in leadRes)) {
    return leadRes as DbResult<{ lead: ManagedLead; notes: LeadNote[]; notesError?: string | null }>;
  }
  const row = leadRes.data as Record<string, unknown> | null;
  if (!row) return failed("no such person");

  const notesRes = await boundedReport(
    db.from("rift_lead_notes")
      .select("id,kind,body,from_stage,to_stage,at")
      .eq("lead_id", leadId).eq("agent_id", agent_id)
      .order("at", { ascending: false }).limit(200),
    "reading the history",
  );

  /* The person renders even if their history does not. Losing the notes panel
     is a degraded page; losing the whole record because a second query was
     slow is an agent who cannot find his client. */
  const notes = notesRes.ok && "data" in notesRes
    ? (notesRes.data as Record<string, unknown>[]).map((n) => ({
        id: n.id as string,
        kind: n.kind as NoteKind,
        body: n.body as string,
        fromStage: (n.from_stage as string | null) ?? null,
        toStage: (n.to_stage as string | null) ?? null,
        at: n.at as string,
      }))
    : [];

  /* Said, not swallowed: an empty history over a failed read renders as
     "nothing recorded yet", which tells the agent there is nothing to catch
     up on when there may be a year of it. */
  return done({
    lead: shape(row, now),
    notes,
    notesError: notesRes.ok && "data" in notesRes ? null : notesRes.ok ? "no history on this deployment" : notesRes.error,
  });
}

/**
 * Everybody being worked, oldest movement first.
 *
 * Sorted by how long they have been sitting rather than when they arrived,
 * because the question this list answers is "who have I left alone too long".
 */
export async function board(now = new Date()): Promise<DbResult<ManagedLead[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const res = await readLeads(
    (sel) => db.from("rift_leads").select(sel)
      .eq("agent_id", agent_id)
      .is("archived_at", null)
      .not("stage", "is", null)
      .order("stage_since", { ascending: true })
      .limit(200),
    "reading the board",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<ManagedLead[]>;
  return done((res.data as Record<string, unknown>[]).map((r) => shape(r, now)));
}

/* ------------------------------------------------------------------ *
 * What you owe them next
 * ------------------------------------------------------------------ */

/**
 * Set, replace, or clear the one thing owed to this person.
 *
 * Passing null for the action clears it and records the completion, because
 * "done" is a fact worth keeping: an agent looking at a record six weeks later
 * needs to know the call was made, not merely that nothing is outstanding.
 */
export async function setNextAction(
  leadId: string,
  action: string | null,
  due: string | null,
  completedNote?: string,
): Promise<DbResult<{ cleared: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const clearing = !action?.trim();
  if (!clearing && !due) return failed("a date is required; an action with no date is a wish");

  const res = await boundedWrite(
    db.from("rift_leads")
      .update({
        next_action: clearing ? null : action!.trim(),
        next_due: clearing ? null : due,
      })
      .eq("id", leadId).eq("agent_id", agent_id).select("id").single(),
    clearing ? "clearing the action" : "setting the action",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ cleared: boolean }>;

  if (clearing && completedNote?.trim()) await addNote(leadId, "note", completedNote.trim());
  return done({ cleared: clearing });
}

/* ------------------------------------------------------------------ *
 * Everybody, findable by name
 * ------------------------------------------------------------------ */

export interface RosterQuery {
  /** Name, email or phone. Matched loosely; blank means everybody. */
  q?: string;
  /** "working" is the board, "new" is nobody has picked them up yet. */
  filter?: "all" | "working" | "new" | "archived";
  side?: "buy" | "sell" | "all";
  limit?: number;
}

export interface Roster {
  people: ManagedLead[];
  /** True when the list was cut short, so the page can say so. */
  more: boolean;
  /** What was actually applied, echoed back so the page cannot claim otherwise. */
  applied: Required<Omit<RosterQuery, "limit">>;
}

/** Everything PostgREST's `or` treats as syntax. */
const escapeForOr = (s: string) => s.replace(/[(),*"\\]/g, " ").trim();

/**
 * The other way in.
 *
 * Today's screen ranks people by what the product thinks is urgent, which is
 * the right default and the wrong tool when somebody rings up and says their
 * name. `board()` cannot answer that: it returns only people who have been
 * given a stage, sorted by neglect, capped at two hundred, so a lead who
 * arrived through the funnel and has not been picked up yet is not in it, and
 * neither is anybody archived.
 *
 * This is deliberately the unranked view. No scoring, no urgency, no opinion:
 * a list, in the order a person would expect, that can be searched.
 */
export async function roster(query: RosterQuery = {}, now = new Date()): Promise<DbResult<Roster>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const q = escapeForOr((query.q ?? "").slice(0, 80));
  const filter = query.filter ?? "all";
  const side = query.side ?? "all";
  /* One more than asked for, so "there are others" is a fact rather than a
     guess from a full page. */
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

  const res = await readLeads((sel) => {
    let b = db.from("rift_leads").select(sel).eq("agent_id", agent_id);

    if (filter === "archived") b = b.not("archived_at", "is", null);
    else b = b.is("archived_at", null);

    if (filter === "working") b = b.not("stage", "is", null);
    if (filter === "new") b = b.is("stage", null);
    if (side !== "all") b = b.eq("side", side);

    /* Case-insensitive contains, across the three things somebody is known by.
       Phone is matched too because a missed call is a number, not a name. */
    if (q) b = b.or(`name.ilike.*${q}*,email.ilike.*${q}*,phone.ilike.*${q}*`);

    /* Newest first. The board sorts by neglect because it answers "who have I
       left alone"; this answers "where is that person", and recency is the
       closest thing to the order they are held in someone's memory. */
    return b.order("created_at", { ascending: false }).limit(limit + 1);
  }, "reading the roster");

  if (!res.ok || !("data" in res)) return res as DbResult<Roster>;

  const rows = res.data as Record<string, unknown>[];
  return done({
    people: rows.slice(0, limit).map((r) => shape(r, now)),
    more: rows.length > limit,
    applied: { q, filter, side },
  });
}

/**
 * When each person was last contacted: the latest call, email, text or
 * meeting logged against them. From the notes, which are append-only, so the
 * answer is what was recorded rather than a guess. Missing means none logged.
 */
export async function lastContacts(leadIds: string[]): Promise<DbResult<Map<string, string>>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");
  if (!leadIds.length) return done(new Map());
  const r = await boundedReport(
    db.from("rift_lead_notes").select("lead_id,at").eq("agent_id", agent_id)
      .in("lead_id", leadIds.slice(0, 500)).in("kind", ["call", "email", "text", "meeting"])
      .order("at", { ascending: false }).limit(2000),
    "when they were last contacted",
  );
  if (!r.ok || !("data" in r)) return r as DbResult<never>;
  const out = new Map<string, string>();
  for (const n of r.data as { lead_id: string; at: string }[]) if (!out.has(n.lead_id)) out.set(n.lead_id, n.at);
  return done(out);
}

export { representationOf, setRepresentation, lapsingAgreements, type Lapsing } from "./representation";
export { finishedRelationships, liveRelationships, type Live } from "./relationships";
export { addNote } from "./notes";
