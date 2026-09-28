import "server-only";
import { createHash } from "node:crypto";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { blockedContacts, sendApproved } from "./email";
import { captureOpError } from "@/lib/monitoring/capture";
import { canMove, canonical, currentState, sendBlockers, type Draft, type OutboxEvent, type OutboxState } from "@/lib/core/outbox";

/**
 * The only reader and writer of rift_outbox and rift_outbox_events
 * (Blueprint v5 §10.2). Rules: lib/core/outbox.ts.
 */

const MISSING = /rift_outbox|does not exist|schema cache/;
const hashOf = (d: Draft) => createHash("sha256").update(canonical(d)).digest("hex");

/*
 * Every step names its place in the message's history (`seq`, migration
 * 20260929200000), and the database refuses a second step claiming the same
 * place. That is what makes two presses of Send one send: both read the same
 * history, both ask for the same next place, and only one is recorded.
 *
 * Before that migration the column is not there. The steps are then written
 * without it, exactly as they were before, and the gap is reported rather
 * than failing every approval. null: not yet known.
 */
let hasSeq: boolean | null = null;
const missingSeq = (error: string) => /\bseq\b/.test(error) && /column|schema cache/.test(error);
const tookPlace = (error: string) => /rift_outbox_events_seq_key|duplicate key/.test(error);
const MOVED = "This message changed a moment ago somewhere else. Reload to see where it is";
const NO_SEQ = { op: "outbox.noSeqColumn", extra: { migration: "20260929200000_rift_outbox_one_step_at_a_time" } };

export interface OutboxItem {
  id: string;
  leadId: string | null;
  draft: Draft;
  hash: string;
  replaces: string | null;
  createdAt: string;
  events: OutboxEvent[];
  state: OutboxState;
}

type Row = {
  id: string; lead_id: string | null; channel: "email"; purpose: "program-alert"; to_address: string; to_name: string | null;
  subject: string; body: string; content_hash: string; replaces: string | null; created_at: string;
};

const ITEM_COLS = "id,lead_id,channel,purpose,to_address,to_name,subject,body,content_hash,replaces,created_at";
const EVENT_COLS = "outbox_id,state,at,by_name,hash,detail";
type EventRow = { outbox_id: string; state: OutboxState; at: string; by_name: string; hash: string | null; detail: string | null; seq?: number | null };
type History = { events: OutboxEvent[]; next: number };

/**
 * These messages' histories, oldest first, each with the place its next step
 * takes.
 *
 * Read by message. It used to be the oldest two thousand steps across the
 * whole outbox, so once the outbox grew past that, the newest steps (the
 * "succeeded" of a send) were the ones cut, and a sent message read as
 * approved and could be sent again. Chunked so the address stays short.
 */
async function historyOf(agentId: string, ids: string[]): Promise<DbResult<Map<string, History>>> {
  const db = serviceClient()!;
  const out = new Map<string, History>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const read = (cols: string) => boundedRead(
      db.from("rift_outbox_events").select(cols).eq("agent_id", agentId).in("outbox_id", chunk).order("at").limit(1000),
      "the outbox history",
    );
    let r = await read(hasSeq === false ? EVENT_COLS : `${EVENT_COLS},seq`);
    if (!r.ok && hasSeq !== false && missingSeq(r.error)) {
      hasSeq = false;
      captureOpError(new Error(r.error), NO_SEQ);
      r = await read(EVENT_COLS);
    }
    if (!r.ok) return r;
    for (const e of ("data" in r ? r.data : []) as unknown as EventRow[]) {
      const h = out.get(e.outbox_id) ?? { events: [], next: 1 };
      h.events.push({ state: e.state, at: e.at, by: e.by_name, hash: e.hash, detail: e.detail });
      h.next = Math.max(h.next, h.events.length + 1, (e.seq ?? 0) + 1);
      out.set(e.outbox_id, h);
    }
  }
  return done(out);
}

/**
 * Appends one step at `seq`, the place the caller read as next. A place
 * already taken means another request moved the message first: refused, so
 * the caller stops rather than acting on a history that is no longer true.
 */
async function event(
  agentId: string, outboxId: string, state: OutboxState, by: string, seq: number, extra: { hash?: string; detail?: string } = {},
): Promise<DbResult<unknown>> {
  const db = serviceClient()!;
  const row: Record<string, unknown> = {
    agent_id: agentId, outbox_id: outboxId, state, by_name: by.slice(0, 120),
    hash: extra.hash ?? null, detail: extra.detail?.slice(0, 300) ?? null,
  };
  let w = await boundedWrite(db.from("rift_outbox_events").insert(hasSeq === false ? row : { ...row, seq }), "the outbox step");
  if (!w.ok && hasSeq !== false && missingSeq(w.error)) {
    hasSeq = false;
    captureOpError(new Error(w.error), NO_SEQ);
    w = await boundedWrite(db.from("rift_outbox_events").insert(row), "the outbox step");
  }
  if (!w.ok) return tookPlace(w.error) ? failed(MOVED) : w;
  return w;
}

/** A step recorded after the send. Reported if it cannot be: the message would read "Sending" for ever. */
async function outcome(agentId: string, outboxId: string, state: OutboxState, by: string, seq: number, detail?: string) {
  const w = await event(agentId, outboxId, state, by, seq, { detail });
  if (!w.ok) captureOpError(new Error(w.error), { op: "outbox.outcome", extra: { state } });
}

const shape = (r: Row, events: OutboxEvent[]): OutboxItem => ({
  id: r.id, leadId: r.lead_id, hash: r.content_hash, replaces: r.replaces, createdAt: r.created_at, events, state: currentState(events),
  draft: { channel: r.channel, purpose: r.purpose, to: r.to_address, name: r.to_name, subject: r.subject, body: r.body },
});

/** Prepares a draft. Nothing is sent: it waits for approval (D04). */
export async function prepare(agentId: string, leadId: string | null, draft: Draft, by: string, replaces: string | null = null): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const w = await boundedWrite(db.from("rift_outbox").insert({
    agent_id: agentId, lead_id: leadId, channel: draft.channel, purpose: draft.purpose,
    to_address: draft.to.trim(), to_name: draft.name, subject: draft.subject, body: draft.body,
    content_hash: hashOf(draft), replaces,
  }).select("id").single(), "the draft");
  if (!w.ok) return w;
  const id = ("data" in w ? (w.data as { id: string }).id : null);
  if (!id) return failed("the draft was not saved");
  const e = await event(agentId, id, "prepared", by, 1);
  if (!e.ok) return e;
  return done({ id });
}

export async function outbox(agentId: string, limit = 100): Promise<DbResult<OutboxItem[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const items = await boundedRead(db.from("rift_outbox").select(ITEM_COLS)
    .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit), "the outbox");
  if (!items.ok) return MISSING.test(items.error) ? done(null) : items;
  const rows = ("data" in items ? items.data : []) as unknown as Row[];
  const history = await historyOf(agentId, rows.map((r) => r.id));
  if (!history.ok) return MISSING.test(history.error) ? done(null) : history;
  const h = "data" in history ? history.data : new Map<string, History>();
  return done(rows.map((r) => shape(r, h.get(r.id)?.events ?? [])));
}

/**
 * One message, read by its id, with its whole history and the place its next
 * step takes. It used to be found by reading the newest five hundred and
 * searching them, so an older message could not be acted on at all.
 */
async function one(agentId: string, id: string): Promise<DbResult<{ item: OutboxItem; next: number } | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(db.from("rift_outbox").select(ITEM_COLS).eq("id", id).eq("agent_id", agentId).maybeSingle(), "the message");
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as unknown as Row | null;
  if (!row) return done(null);
  const history = await historyOf(agentId, [id]);
  if (!history.ok || !("data" in history)) return history as DbResult<never>;
  const h = history.data.get(id) ?? { events: [], next: 1 };
  return done({ item: shape(row, h.events), next: h.next });
}

export type SendOutcome = { state: OutboxState; detail: string | null; blockers: string[] };

/**
 * Approves exactly this content and sends it, after checking again what
 * could have changed (AUTO-03). A refusal leaves it approved, with the
 * reasons, for the agent to decide.
 */
export async function approveAndSend(agentId: string, id: string, by: string): Promise<DbResult<SendOutcome>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  if (!got.data) return failed("That message is not in your outbox");
  const { item } = got.data;
  let seq = got.data.next;
  /* The stored hash is checked against the stored words, so a row changed
     outside this code cannot be approved under its old hash. */
  if (hashOf(item.draft) !== item.hash) return failed("This draft does not match its record. Prepare it again");

  let events = item.events;
  if (currentState(events) !== "approved") {
    if (!canMove(currentState(events), "approved")) return failed(`It is ${currentState(events)} and cannot be approved`);
    const a = await event(agentId, id, "approved", by, seq++, { hash: item.hash });
    if (!a.ok) return a;
    events = [...events, { state: "approved", at: new Date().toISOString(), by, hash: item.hash, detail: null }];
  }
  const approvedAt = events.filter((e) => e.state === "approved").at(-1)!.at;

  let leadExists = true;
  let replied = false;
  if (item.leadId) {
    const l = await boundedRead(db.from("rift_leads").select("id,human_replied_at").eq("id", item.leadId).maybeSingle(), "the person");
    if (!l.ok) return l;
    const row = ("data" in l ? l.data : null) as { id: string; human_replied_at: string | null } | null;
    leadExists = Boolean(row);
    replied = Boolean(row?.human_replied_at && row.human_replied_at > approvedAt);
  }
  const blocks = await blockedContacts();
  const optedOut = blocks.ok && "codes" in blocks ? blocks.codes.has(item.draft.to.trim().toLowerCase()) : false;

  const blockers = sendBlockers({ hash: item.hash, events, leadExists, optedOut, repliedSinceApproval: replied });
  if (blockers.length) return done({ state: "approved", detail: null, blockers });

  /* The claim. Of two presses that got this far, only one records "running",
     and only that one sends. */
  const run = await event(agentId, id, "running", by, seq++);
  if (!run.ok) return run;
  const sent = await sendApproved({ to: item.draft.to, name: item.draft.name, subject: item.draft.subject, text: item.draft.body, tag: item.draft.purpose });
  if (sent.ok && "skipped" in sent) {
    await outcome(agentId, id, "failed", by, seq, `Not sent: ${sent.reason}`);
    return done({ state: "failed", detail: sent.reason, blockers: [] });
  }
  if (sent.ok) {
    await outcome(agentId, id, "succeeded", by, seq, sent.messageId ? `Brevo ${sent.messageId}` : undefined);
    return done({ state: "succeeded", detail: sent.messageId ?? null, blockers: [] });
  }
  const state: OutboxState = sent.unknown ? "unknown" : "failed";
  await outcome(agentId, id, state, by, seq, sent.error);
  return done({ state, detail: sent.error, blockers: [] });
}

export async function discard(agentId: string, id: string, by: string): Promise<DbResult<true>> {
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  if (!got.data) return failed("That message is not in your outbox");
  if (!canMove(got.data.item.state, "cancelled")) return failed("It cannot be discarded now");
  const e = await event(agentId, id, "cancelled", by, got.data.next);
  return e.ok ? done(true) : e;
}

/**
 * An edit is a new draft that replaces the old one, which is cancelled: no
 * approval carries over. The old one is cancelled FIRST, so if it was sent a
 * moment ago somewhere else the cancel is refused, and no second copy of a
 * message already on its way is left waiting for approval.
 */
export async function edit(agentId: string, id: string, by: string, subject: string, body: string): Promise<DbResult<{ id: string }>> {
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  if (!got.data) return failed("That message is not in your outbox");
  const { item } = got.data;
  if (!canMove(item.state, "cancelled")) return failed("It cannot be changed now");
  const cancelled = await event(agentId, id, "cancelled", by, got.data.next, { detail: "Replaced by an edit" });
  if (!cancelled.ok) return cancelled;
  return prepare(agentId, item.leadId, { ...item.draft, subject: subject.trim(), body: body.trim() }, by, item.id);
}

/** A person's answer to "may have sent": after checking Brevo's log. */
export async function resolveUnknown(agentId: string, id: string, by: string, outcome: "succeeded" | "failed"): Promise<DbResult<true>> {
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  if (!got.data || got.data.item.state !== "unknown") return failed("Only a message that may have sent can be resolved");
  const e = await event(agentId, id, outcome, by, got.data.next, { detail: "Checked by hand" });
  return e.ok ? done(true) : e;
}
