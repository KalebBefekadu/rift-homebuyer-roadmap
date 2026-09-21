import "server-only";
import { randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import type { Owner, PlanItem } from "@/lib/core/plan";

/**
 * The client's plan — reading it by token, and the agent's edits to it.
 *
 * The read is the interesting half. It is the only query in this product that
 * answers a request from somebody who is not the agent and has no session, so
 * it is written to return the narrowest possible thing: the plan, the person's
 * own first name, the stage, and nothing else.
 *
 * What it must never return is in `SAFE_LEAD_COLUMNS` below and is enforced by
 * a test. A lead row carries a score, a band, a contact basis, the agent's
 * archive reason and a list of signals about how promising this person is —
 * all of it written for the agent, none of it written to be read by the person
 * it is about.
 */

/** Unguessable, like the readout's share token, and for the same reason. */
export const newClientToken = () => randomBytes(24).toString("base64url");

/**
 * Everything the client's own page is allowed to know about their lead row.
 *
 * A list rather than a `select("*")` with fields picked off afterwards. The
 * difference matters: picking afterwards means the score and the band travel
 * to the server that renders the page, where the next person to add a field to
 * the view has them in hand.
 */
export const SAFE_LEAD_COLUMNS = "id,name,side,stage,stage_since,client_token" as const;

export interface ClientPlan {
  leadId: string;
  /** Their own first name, or null. Used to address them, nothing else. */
  firstName: string | null;
  side: "buy" | "sell";
  stage: string | null;
  stageSince: string | null;
  items: PlanItem[];
}

const shapeItem = (r: Record<string, unknown>): PlanItem => ({
  id: r.id as string,
  title: r.title as string,
  owner: r.owner as Owner,
  ownerName: (r.owner_name as string | null) ?? null,
  dueOn: (r.due_on as string | null) ?? null,
  doneAt: (r.done_at as string | null) ?? null,
  sort: (r.sort as number | null) ?? 0,
});

/**
 * Open a plan by its token.
 *
 * No agent scope, because there is no agent asking — the token IS the
 * authorisation. That is the same trade the shared readout makes, and it is
 * only safe while the token is long, random, unique and revocable, which the
 * migration enforces and `newClientToken` provides.
 */
export async function readPlanByToken(token: string): Promise<DbResult<ClientPlan | null>> {
  const clean = token.trim();
  /* Refuse before asking. A short or empty token cannot be a real one, and a
     query with an empty filter is a query that could match something. */
  if (clean.length < 16 || clean.length > 128) return done(null);

  const db = serviceClient();
  if (!db) return skipped("no database configured");

  const lead = await boundedRead(
    db.from("rift_leads").select(SAFE_LEAD_COLUMNS).eq("client_token", clean).maybeSingle(),
    "the plan",
  );
  if (!lead.ok) return lead;
  const row = ("data" in lead ? lead.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);

  const items = await boundedRead(
    db.from("rift_plan_items")
      .select("id,title,owner,owner_name,due_on,done_at,sort")
      .eq("lead_id", row.id as string)
      .order("sort", { ascending: true })
      .limit(200),
    "the plan steps",
  );

  /* The plan renders even if the steps do not. Losing the list is a thin page;
     losing the page because a second query was slow is a client who thinks the
     link their agent sent them is broken. */
  const list = items.ok && "data" in items
    ? (items.data as Record<string, unknown>[]).map(shapeItem)
    : [];

  const name = ((row.name as string | null) ?? "").trim();
  return done({
    leadId: row.id as string,
    firstName: name ? name.split(/\s+/)[0]! : null,
    side: row.side as "buy" | "sell",
    stage: (row.stage as string | null) ?? null,
    stageSince: (row.stage_since as string | null) ?? null,
    items: list,
  });
}

/* ------------------------------------------------------------------ *
 * The agent's side
 * ------------------------------------------------------------------ */

/**
 * Mint the client's link, or return the one that already exists.
 *
 * Idempotent on purpose. An agent who clicks twice must not invalidate the
 * link he sent an hour ago — the client would open it, see nothing, and have
 * no way to tell that from the product being broken.
 */
export async function openPlan(leadId: string): Promise<DbResult<{ token: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const existing = await boundedRead(
    db.from("rift_leads").select("client_token").eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
    "the plan link",
  );
  if (!existing.ok) return existing;
  const row = ("data" in existing ? existing.data : null) as { client_token: string | null } | null;
  if (!row) return failed("no such person");
  if (row.client_token) return done({ token: row.client_token });

  const token = newClientToken();
  const wrote = await boundedWrite(
    db.from("rift_leads").update({ client_token: token }).eq("id", leadId).eq("agent_id", agent_id),
    "the plan link",
  );
  if (!wrote.ok) return wrote;
  return done({ token });
}

/**
 * Revoke it.
 *
 * Nulling the token breaks every copy of the link at once, which is the whole
 * point — a link that has been forwarded cannot be taken back any other way.
 * The plan itself is kept: the relationship may resume, and deleting somebody's
 * agreed steps because a link was shared too widely is a second mistake.
 */
export async function closePlan(leadId: string): Promise<DbResult<{ closed: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const wrote = await boundedWrite(
    db.from("rift_leads").update({ client_token: null }).eq("id", leadId).eq("agent_id", agent_id),
    "the plan link",
  );
  if (!wrote.ok) return wrote;
  return done({ closed: true as const });
}

export interface NewPlanItem {
  leadId: string;
  title: string;
  owner: Owner;
  ownerName?: string | null;
  dueOn?: string | null;
}

export async function addPlanItem(input: NewPlanItem): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const title = input.title.trim();
  if (title.length < 3) return failed("a step needs a few words");
  if (input.owner === "other" && !(input.ownerName ?? "").trim()) {
    /* The database says the same thing. Said here too so the agent gets a
       sentence rather than a constraint name. */
    return failed("say who it is waiting on");
  }

  /* Appended, not inserted. The agent's order is his, and a new step arriving
     in the middle of a plan the client has already read is disorienting. */
  const last = await boundedRead(
    db.from("rift_plan_items").select("sort").eq("lead_id", input.leadId).eq("agent_id", agent_id)
      .order("sort", { ascending: false }).limit(1).maybeSingle(),
    "the plan order",
  );
  const sort = last.ok && "data" in last && last.data
    ? ((last.data as { sort: number }).sort ?? 0) + 1
    : 0;

  const created = await boundedWrite(
    db.from("rift_plan_items").insert({
      agent_id,
      lead_id: input.leadId,
      title: title.slice(0, 160),
      owner: input.owner,
      owner_name: input.owner === "other" ? (input.ownerName ?? "").trim().slice(0, 80) : null,
      due_on: input.dueOn || null,
      sort,
    }).select("id").single(),
    "the plan step",
  );
  if (!created.ok) return created;
  const row = ("data" in created ? created.data : null) as { id: string } | null;
  if (!row) return failed("the step was not returned after insert");
  return done({ id: row.id });
}

/** Tick or untick. Untick exists because a step marked done by mistake is a
 *  step the client believes is handled. */
export async function setPlanItemDone(itemId: string, isDone: boolean): Promise<DbResult<{ done: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const wrote = await boundedWrite(
    db.from("rift_plan_items")
      .update({ done_at: isDone ? new Date().toISOString() : null })
      .eq("id", itemId).eq("agent_id", agent_id),
    "the plan step",
  );
  if (!wrote.ok) return wrote;
  return done({ done: isDone });
}

export async function removePlanItem(itemId: string): Promise<DbResult<{ removed: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const gone = await boundedWrite(
    db.from("rift_plan_items").delete().eq("id", itemId).eq("agent_id", agent_id),
    "the plan step",
  );
  if (!gone.ok) return gone;
  return done({ removed: true as const });
}

/** The agent's view of the same plan, plus whether a link is open. */
export async function readPlanForAgent(leadId: string): Promise<DbResult<{ items: PlanItem[]; token: string | null }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const [lead, items] = await Promise.all([
    boundedRead(
      db.from("rift_leads").select("client_token").eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
      "the plan link",
    ),
    boundedRead(
      db.from("rift_plan_items")
        .select("id,title,owner,owner_name,due_on,done_at,sort")
        .eq("lead_id", leadId).eq("agent_id", agent_id)
        .order("sort", { ascending: true }).limit(200),
      "the plan steps",
    ),
  ]);

  if (!items.ok) return items;
  const token = lead.ok && "data" in lead && lead.data
    ? ((lead.data as { client_token: string | null }).client_token ?? null)
    : null;

  return done({
    items: ("data" in items ? (items.data as Record<string, unknown>[]) : []).map(shapeItem),
    token,
  });
}
