import "server-only";
import { randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import type { Owner, PlanItem } from "@/lib/core/plan";
import type { Commitment } from "@/lib/core/agenda";
import type { Offer, SellerCosts } from "@/lib/core/offers";
import { releasedOffersFor } from "./offers";
import { clientRoomFor } from "./offer-room";
import { takeIsCurrent, type ChoiceSnapshot } from "@/lib/core/offer-room";

/**
 * The client's plan: reading it by token, and the agent's edits to it.
 *
 * The read is the interesting half. It is the only query in this product that
 * answers a request from somebody who is not the agent and has no session, so
 * it is written to return the narrowest possible thing: the plan, the person's
 * own first name, the stage, and nothing else.
 *
 * What it must never return is in `SAFE_LEAD_COLUMNS` below and is enforced by
 * a test. A lead row carries a score, a band, a contact basis, the agent's
 * archive reason and a list of signals about how promising this person is:
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
  /**
   * Offers the agent has RELEASED, and the costs to compare them against.
   *
   * Empty on a buyer, and empty on a seller until something is released. The
   * costs are null unless both figures are recorded, and the page then shows
   * the offers without a net rather than inventing one.
   */
  offers: Offer[];
  sellerCosts: SellerCosts | null;
  /**
   * The agent's approved take on those offers: null unless it was approved
   * for EXACTLY the offers released now. Decided here, not in the page: a
   * take about a table that has since changed is advice about a choice that no
   * longer exists, and "the component checks" is one refactor from nobody does.
   */
  take: { text: string; approvedAt: string } | null;
  /** Which offer they said they want, and what they were shown when they did. */
  choice: { offerId: string; at: string; seen: ChoiceSnapshot } | null;
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
 * No agent scope, because there is no agent asking: the token IS the
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

  /* Only a seller can have offers ON them, and only released ones are ever
     read: the filter is in the query in lib/db/offers.ts, not applied here,
     because a filter applied after the read is one refactor from being
     dropped. */
  const side = row.side as "buy" | "sell";
  let offers: Offer[] = [];
  let sellerCosts: SellerCosts | null = null;
  let take: ClientPlan["take"] = null;
  let choice: ClientPlan["choice"] = null;

  if (side === "sell") {
    const [released, costs, room] = await Promise.all([
      releasedOffersFor(row.id as string),
      boundedRead(
        db.from("rift_leads").select("payoff_cents,commission_pct").eq("id", row.id as string).maybeSingle(),
        "the seller's costs",
      ),
      clientRoomFor(row.id as string),
    ]);
    if (released.ok && "data" in released) offers = released.data;

    /* A failed room read costs the take and the recorded choice, never the
       offers themselves. The page then offers a choice it cannot record, and
       the write refuses (loudly) rather than the page going blank. */
    if (room.ok && "data" in room) {
      const r = room.data;
      if (takeIsCurrent(r, offers)) take = { text: r.take!, approvedAt: r.approvedAt! };
      if (r.chosenOfferId && r.chosenAt && r.chosenSeen) {
        choice = { offerId: r.chosenOfferId, at: r.chosenAt, seen: r.chosenSeen };
      }
    }

    const c = costs.ok && "data" in costs
      ? (costs.data as { payoff_cents: number | null; commission_pct: number | null } | null)
      : null;
    /* Both, or neither. A net computed against an assumed payoff of zero reads
       perfectly and is wrong by the size of their mortgage. */
    if (c && c.payoff_cents !== null && c.commission_pct !== null) {
      sellerCosts = { payoff: Number(c.payoff_cents) / 100, commissionPct: Number(c.commission_pct) };
    }
  }

  const name = ((row.name as string | null) ?? "").trim();
  return done({
    leadId: row.id as string,
    firstName: name ? name.split(/\s+/)[0]! : null,
    side,
    stage: (row.stage as string | null) ?? null,
    stageSince: (row.stage_since as string | null) ?? null,
    items: list,
    offers,
    sellerCosts,
    take,
    choice,
  });
}

/* ------------------------------------------------------------------ *
 * The agent's side
 * ------------------------------------------------------------------ */

/**
 * Mint the client's link, or return the one that already exists.
 *
 * Idempotent on purpose. An agent who clicks twice must not invalidate the
 * link he sent an hour ago: the client would open it, see nothing, and have
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
 * point: a link that has been forwarded cannot be taken back any other way.
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

/* ------------------------------------------------------------------ *
 * Everything dated, across everybody
 * ------------------------------------------------------------------ */

/**
 * Every commitment with a date on it, from both places they live.
 *
 * Two queries rather than one, because they are two different promises. A
 * next action is something the agent promised himself; a plan step is
 * something a CLIENT can see he promised them, on a page they may have open.
 * The agenda leads with the second for exactly that reason, so the difference
 * has to survive the read.
 *
 * Unfinished steps only. A completed step with a date in the future is not a
 * commitment, and a completed one in the past is not overdue.
 */
export async function datedCommitments(): Promise<DbResult<Commitment[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const [steps, actions] = await Promise.all([
    boundedRead(
      db.from("rift_plan_items")
        .select("id,title,owner,owner_name,due_on,lead_id")
        .eq("agent_id", agent_id)
        .is("done_at", null)
        .not("due_on", "is", null)
        .order("due_on", { ascending: true }).limit(300),
      "the dated steps",
    ),
    boundedRead(
      db.from("rift_leads")
        .select("id,name,side,next_action,next_due,client_token")
        .eq("agent_id", agent_id)
        .is("archived_at", null)
        .not("next_due", "is", null)
        .order("next_due", { ascending: true }).limit(300),
      "the dated actions",
    ),
  ]);

  /* Either half may be missing without the page being wrong: the follow-up
     columns and the plan table shipped separately from the code that reads
     them. What must not happen is an empty agenda that looks like a clear
     month. If BOTH fail, that is reported. */
  if (!steps.ok && !actions.ok) return steps;

  const leadRows = actions.ok && "data" in actions
    ? (actions.data as Record<string, unknown>[])
    : [];
  const byLead = new Map(leadRows.map((l) => [l.id as string, l]));

  const out: Commitment[] = [];

  for (const l of leadRows) {
    if (!l.next_action || !l.next_due) continue;
    out.push({
      id: `action:${l.id as string}`,
      kind: "action",
      what: l.next_action as string,
      dueOn: (l.next_due as string).slice(0, 10),
      personId: l.id as string,
      personName: ((l.name as string | null) ?? "").trim() || "Someone who left no name",
      side: l.side as "buy" | "sell",
      /* A next action is his own note. Nothing on the client's page shows it. */
      visibleToThem: false,
    });
  }

  if (steps.ok && "data" in steps) {
    /* The steps' own leads may not be in the map above: that query only
       returns people who have a next action. One more read rather than a
       guess: a step attributed to the wrong person is worse than a slow page. */
    const stepRows = steps.data as Record<string, unknown>[];
    const missing = [...new Set(stepRows.map((s) => s.lead_id as string))]
      .filter((id) => !byLead.has(id));

    if (missing.length) {
      const extra = await boundedRead(
        db.from("rift_leads").select("id,name,side,client_token")
          .eq("agent_id", agent_id).in("id", missing.slice(0, 200)),
        "the people those steps belong to",
      );
      if (extra.ok && "data" in extra) {
        for (const l of extra.data as Record<string, unknown>[]) byLead.set(l.id as string, l);
      }
    }

    for (const s of stepRows) {
      const lead = byLead.get(s.lead_id as string);
      if (!lead) continue;
      out.push({
        id: `step:${s.id as string}`,
        kind: "step",
        what: s.title as string,
        dueOn: (s.due_on as string).slice(0, 10),
        personId: s.lead_id as string,
        personName: ((lead.name as string | null) ?? "").trim() || "Someone who left no name",
        side: lead.side as "buy" | "sell",
        /* Only if a link is actually open. A step on a plan nobody can reach
           carries no more exposure than a private note, and saying otherwise
           would make every agenda look alarming. */
        visibleToThem: Boolean(lead.client_token),
        owner: s.owner as "client" | "agent" | "other",
        ownerName: (s.owner_name as string | null) ?? null,
      });
    }
  }

  return done(out);
}
