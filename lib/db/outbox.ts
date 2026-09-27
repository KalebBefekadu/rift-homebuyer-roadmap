import "server-only";
import { createHash } from "node:crypto";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { blockedContacts, sendApproved } from "./email";
import { canMove, canonical, currentState, sendBlockers, type Draft, type OutboxEvent, type OutboxState } from "@/lib/core/outbox";

/**
 * The only reader and writer of rift_outbox and rift_outbox_events
 * (Blueprint v5 §10.2). Rules: lib/core/outbox.ts.
 */

const MISSING = /rift_outbox|does not exist|schema cache/;
const hashOf = (d: Draft) => createHash("sha256").update(canonical(d)).digest("hex");

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

async function event(agentId: string, outboxId: string, state: OutboxState, by: string, extra: { hash?: string; detail?: string } = {}) {
  const db = serviceClient()!;
  return boundedWrite(db.from("rift_outbox_events").insert({
    agent_id: agentId, outbox_id: outboxId, state, by_name: by.slice(0, 120),
    hash: extra.hash ?? null, detail: extra.detail?.slice(0, 300) ?? null,
  }), "the outbox step");
}

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
  const e = await event(agentId, id, "prepared", by);
  if (!e.ok) return e;
  return done({ id });
}

export async function outbox(agentId: string, limit = 100): Promise<DbResult<OutboxItem[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [items, events] = await Promise.all([
    boundedRead(db.from("rift_outbox").select("id,lead_id,channel,purpose,to_address,to_name,subject,body,content_hash,replaces,created_at")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit), "the outbox"),
    boundedRead(db.from("rift_outbox_events").select("outbox_id,state,at,by_name,hash,detail").eq("agent_id", agentId).order("at").limit(2000), "the outbox history"),
  ]);
  if (!items.ok) return MISSING.test(items.error) ? done(null) : items;
  if (!events.ok) return MISSING.test(events.error) ? done(null) : events;
  const byItem = new Map<string, OutboxEvent[]>();
  for (const e of ("data" in events ? events.data : []) as { outbox_id: string; state: OutboxState; at: string; by_name: string; hash: string | null; detail: string | null }[]) {
    byItem.set(e.outbox_id, [...(byItem.get(e.outbox_id) ?? []), { state: e.state, at: e.at, by: e.by_name, hash: e.hash, detail: e.detail }]);
  }
  return done((("data" in items ? items.data : []) as Row[]).map((r) => {
    const ev = byItem.get(r.id) ?? [];
    return {
      id: r.id, leadId: r.lead_id, hash: r.content_hash, replaces: r.replaces, createdAt: r.created_at, events: ev, state: currentState(ev),
      draft: { channel: r.channel, purpose: r.purpose, to: r.to_address, name: r.to_name, subject: r.subject, body: r.body },
    };
  }));
}

async function one(agentId: string, id: string): Promise<DbResult<OutboxItem | null>> {
  const all = await outbox(agentId, 500);
  if (!all.ok || "skipped" in all) return all;
  return done(all.data?.find((x) => x.id === id) ?? null);
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
  const item = got.data;
  if (!item) return failed("That message is not in your outbox");
  /* The stored hash is checked against the stored words, so a row changed
     outside this code cannot be approved under its old hash. */
  if (hashOf(item.draft) !== item.hash) return failed("This draft does not match its record. Prepare it again");

  let events = item.events;
  if (currentState(events) !== "approved") {
    if (!canMove(currentState(events), "approved")) return failed(`It is ${currentState(events)} and cannot be approved`);
    const a = await event(agentId, id, "approved", by, { hash: item.hash });
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

  const run = await event(agentId, id, "running", by);
  if (!run.ok) return run;
  const sent = await sendApproved({ to: item.draft.to, name: item.draft.name, subject: item.draft.subject, text: item.draft.body, tag: item.draft.purpose });
  if (sent.ok && "skipped" in sent) {
    await event(agentId, id, "failed", by, { detail: `Not sent: ${sent.reason}` });
    return done({ state: "failed", detail: sent.reason, blockers: [] });
  }
  if (sent.ok) {
    await event(agentId, id, "succeeded", by, { detail: sent.messageId ? `Brevo ${sent.messageId}` : undefined });
    return done({ state: "succeeded", detail: sent.messageId ?? null, blockers: [] });
  }
  const state: OutboxState = sent.unknown ? "unknown" : "failed";
  await event(agentId, id, state, by, { detail: sent.error });
  return done({ state, detail: sent.error, blockers: [] });
}

export async function discard(agentId: string, id: string, by: string): Promise<DbResult<true>> {
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  if (!got.data) return failed("That message is not in your outbox");
  if (!canMove(got.data.state, "cancelled")) return failed("It cannot be discarded now");
  const e = await event(agentId, id, "cancelled", by);
  return e.ok ? done(true) : e;
}

/** An edit is a new draft that replaces the old one, which is cancelled: no approval carries over. */
export async function edit(agentId: string, id: string, by: string, subject: string, body: string): Promise<DbResult<{ id: string }>> {
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  const item = got.data;
  if (!item) return failed("That message is not in your outbox");
  if (!canMove(item.state, "cancelled")) return failed("It cannot be changed now");
  const next = await prepare(agentId, item.leadId, { ...item.draft, subject: subject.trim(), body: body.trim() }, by, item.id);
  if (!next.ok || "skipped" in next) return next;
  await event(agentId, id, "cancelled", by, { detail: "Replaced by an edit" });
  return next;
}

/** A person's answer to "may have sent": after checking Brevo's log. */
export async function resolveUnknown(agentId: string, id: string, by: string, outcome: "succeeded" | "failed"): Promise<DbResult<true>> {
  const got = await one(agentId, id);
  if (!got.ok || "skipped" in got) return got;
  if (!got.data || got.data.state !== "unknown") return failed("Only a message that may have sent can be resolved");
  const e = await event(agentId, id, outcome, by, { detail: "Checked by hand" });
  return e.ok ? done(true) : e;
}
