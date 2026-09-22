import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { offersFor, releasedOffersFor } from "./offers";
import {
  EMPTY_ROOM, CLIENT_NOTE_MAX, draftTake, canApprove, canChoose, snapshotOf, takeIsCurrent,
  type OfferRoom, type ChoiceSnapshot,
} from "@/lib/core/offer-room";
import type { Offer, SellerCosts } from "@/lib/core/offers";

/**
 * The offer room, read and written. The rules are in lib/core/offer-room.ts.
 *
 * Two things this layer insists on that the core cannot:
 *
 * THE SERVER DRAFTS AND THE SERVER SNAPSHOTS. `approveTake` recomputes Rift's
 * draft from the database rather than accepting one from the browser, so
 * `prepared` is what the software actually wrote and not whatever the form
 * posted back. `chooseOffer` builds the seller's snapshot the same way. A
 * record of "what they were shown" that the client can write is a record of
 * what they typed.
 *
 * THE CLIENT READ NEVER CARRIES THE DRAFT. `clientRoomFor` does not select
 * `prepared`. The seller reads their agent's words; Rift's first draft of them
 * is an internal document, and returning it to a page that "just does not
 * render it" is one component change from rendering it.
 */

const AGENT_COLUMNS =
  "prepared,take,approved_at,approved_for,chosen_offer_id,chosen_at,chosen_seen,client_note" as const;
const CLIENT_COLUMNS =
  "take,approved_at,approved_for,chosen_offer_id,chosen_at,chosen_seen" as const;

/* The table arrives in a migration. A deployment that runs ahead of it must
   still render the seller's page and the agent's lead page — as a room with
   nothing in it, which is true — rather than fail them. Same pattern as
   `hasFollowUp` and `hasRef` elsewhere. */
const missingTable = (msg: string) =>
  /rift_offer_rooms/.test(msg) && /does not exist|schema cache|Could not find/i.test(msg);

function shape(r: Record<string, unknown> | null): OfferRoom {
  if (!r) return EMPTY_ROOM;
  return {
    prepared: (r.prepared as string | null) ?? null,
    take: (r.take as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
    approvedFor: (r.approved_for as string[] | null) ?? [],
    chosenOfferId: (r.chosen_offer_id as string | null) ?? null,
    chosenAt: (r.chosen_at as string | null) ?? null,
    chosenSeen: (r.chosen_seen as ChoiceSnapshot | null) ?? null,
    clientNote: (r.client_note as string | null) ?? null,
  };
}

/** The agent's view: the draft, the take, and the choice. */
export async function roomFor(leadId: string): Promise<DbResult<OfferRoom>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const r = await boundedRead(
    db.from("rift_offer_rooms").select(AGENT_COLUMNS)
      .eq("lead_id", leadId).eq("agent_id", agent_id).maybeSingle(),
    "the offer room",
  );
  if (!r.ok) return missingTable(r.error) ? done(EMPTY_ROOM) : r;
  return done(shape(("data" in r ? r.data : null) as Record<string, unknown> | null));
}

/**
 * The seller's view. No agent scope — the caller has already resolved the
 * seller from their token, which is the authorisation — and no draft.
 */
export async function clientRoomFor(leadId: string): Promise<DbResult<OfferRoom>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  const r = await boundedRead(
    db.from("rift_offer_rooms").select(CLIENT_COLUMNS).eq("lead_id", leadId).maybeSingle(),
    "the offer room",
  );
  if (!r.ok) return missingTable(r.error) ? done(EMPTY_ROOM) : r;
  const room = shape(("data" in r ? r.data : null) as Record<string, unknown> | null);
  return done({ ...room, prepared: null, clientNote: null });
}

/** Rift's current draft, for the agent to start from. Recomputed, never stored until approval. */
export async function currentDraft(leadId: string): Promise<DbResult<string | null>> {
  const o = await offersFor(leadId);
  if (!o.ok || "skipped" in o) return o as DbResult<never>;
  return done(draftTake(o.data.offers.filter((x) => x.releasedAt), o.data.costs));
}

/**
 * Approve a take. Records Rift's draft beside it, and the exact set of
 * released offers it describes.
 */
export async function approveTake(leadId: string, take: string): Promise<DbResult<{ approvedFor: string[] }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const o = await offersFor(leadId);
  if (!o.ok) return o;
  if ("skipped" in o) return o;

  /* offersFor is agent-scoped on the offers but returns an empty list, not an
     error, for a lead that is not his. Ask directly, because this is an upsert
     keyed by lead_id and it must not create a room on somebody else's seller. */
  const lead = await boundedRead(
    db.from("rift_leads").select("id").eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
    "the seller",
  );
  if (!lead.ok) return lead;
  if (!("data" in lead) || !lead.data) return failed("that seller is not in your book");

  const released = o.data.offers.filter((x) => x.releasedAt);
  const why = canApprove(take, released);
  if (why) return failed(why);

  const prepared = draftTake(released, o.data.costs)!;
  const approvedFor = released.map((x) => x.id);

  const wrote = await boundedWrite(
    db.from("rift_offer_rooms").upsert({
      lead_id: leadId,
      agent_id,
      prepared,
      take: take.trim(),
      approved_at: new Date().toISOString(),
      approved_for: approvedFor,
    }, { onConflict: "lead_id" }),
    "the take",
  );
  if (!wrote.ok) return wrote;
  return done({ approvedFor });
}

/** Take it back. The seller stops seeing it; the choice, if any, stays. */
export async function withdrawTake(leadId: string): Promise<DbResult<{ withdrawn: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const wrote = await boundedWrite(
    db.from("rift_offer_rooms")
      .update({ prepared: null, take: null, approved_at: null, approved_for: null })
      .eq("lead_id", leadId).eq("agent_id", agent_id),
    "the take",
  );
  if (!wrote.ok) return wrote;
  return done({ withdrawn: true as const });
}

/** Clear the seller's choice, so they can choose again. The agent's call, never theirs. */
export async function reopenChoice(leadId: string): Promise<DbResult<{ reopened: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const wrote = await boundedWrite(
    db.from("rift_offer_rooms")
      .update({ chosen_offer_id: null, chosen_at: null, chosen_seen: null, client_note: null })
      .eq("lead_id", leadId).eq("agent_id", agent_id),
    "the choice",
  );
  if (!wrote.ok) return wrote;
  return done({ reopened: true as const });
}

export interface Chosen {
  leadId: string;
  seller: string;
  agentId: string;
  snapshot: ChoiceSnapshot;
}

/**
 * The seller says which offer they want.
 *
 * `leadId` must come from a token the caller has already resolved — this does
 * not check who is asking, because the token was the check. Everything else is
 * re-derived here: that the offer is released on THIS seller, what they were
 * shown, and whether they have already chosen.
 */
export async function chooseOffer(leadId: string, offerId: string, note: string | null): Promise<DbResult<Chosen>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  const [lead, releasedRead, roomRead] = await Promise.all([
    boundedRead(
      db.from("rift_leads").select("agent_id,name,side,payoff_cents,commission_pct").eq("id", leadId).maybeSingle(),
      "the seller",
    ),
    releasedOffersFor(leadId),
    clientRoomFor(leadId),
  ]);
  if (!lead.ok) return lead;
  if (!releasedRead.ok) return releasedRead;
  if (!roomRead.ok) return roomRead;
  if ("skipped" in releasedRead || "skipped" in roomRead) return skipped("no database configured");

  const row = ("data" in lead ? lead.data : null) as {
    agent_id: string; name: string | null; side: string; payoff_cents: number | null; commission_pct: number | null;
  } | null;
  if (!row || row.side !== "sell") return failed("there are no offers here to choose between");

  const released: Offer[] = releasedRead.data;
  const room = roomRead.data;
  const why = canChoose(offerId, released, room);
  if (why) return failed(why);

  const costs: SellerCosts | null = row.payoff_cents !== null && row.commission_pct !== null
    ? { payoff: Number(row.payoff_cents) / 100, commissionPct: Number(row.commission_pct) }
    : null;
  const chosen = released.find((o) => o.id === offerId)!;
  const snapshot = snapshotOf(chosen, released, costs, takeIsCurrent(room, released) ? room.take : null);

  const choice = {
    chosen_offer_id: offerId,
    chosen_at: new Date().toISOString(),
    chosen_seen: snapshot,
    client_note: note?.trim().slice(0, CLIENT_NOTE_MAX) || null,
  };

  /* Conditional on nobody having chosen yet, in the WHERE clause. Two taps on
     a slow phone — or two people on one link — must produce one choice, and a
     read-then-write check lets both through. */
  const updated = await boundedWrite(
    db.from("rift_offer_rooms").update(choice)
      .eq("lead_id", leadId).is("chosen_offer_id", null).select("lead_id"),
    "your choice",
  );
  if (!updated.ok) return updated;
  const hit = ("data" in updated ? (updated.data as unknown[] | null) : null) ?? [];

  if (hit.length === 0) {
    /* Either no room row yet (no take was ever approved), or somebody chose
       first. An insert settles which: the primary key refuses the second. */
    const inserted = await boundedWrite(
      db.from("rift_offer_rooms").insert({ lead_id: leadId, agent_id: row.agent_id, ...choice }).select("lead_id"),
      "your choice",
    );
    if (!inserted.ok) {
      return /duplicate key|23505/.test(inserted.error)
        ? failed("You have already told your agent which offer you want. Ask them if you have changed your mind")
        : inserted;
    }
  }

  return done({ leadId, seller: (row.name ?? "").trim() || "Your seller", agentId: row.agent_id, snapshot });
}

export interface RecentChoice {
  leadId: string;
  name: string;
  chosenAt: string;
  seen: ChoiceSnapshot;
  note: string | null;
}

/** Choices made in the last `days`, newest first. For Today. */
export async function recentChoices(days = 7): Promise<DbResult<RecentChoice[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rooms = await boundedRead(
    db.from("rift_offer_rooms").select("lead_id,chosen_at,chosen_seen,client_note")
      .eq("agent_id", agent_id).not("chosen_offer_id", "is", null).gte("chosen_at", since)
      .order("chosen_at", { ascending: false }).limit(10),
    "recent choices",
  );
  if (!rooms.ok) return missingTable(rooms.error) ? done([]) : rooms;
  const list = ("data" in rooms ? (rooms.data as Record<string, unknown>[] | null) : null) ?? [];
  if (list.length === 0) return done([]);

  const names = await boundedRead(
    db.from("rift_leads").select("id,name").eq("agent_id", agent_id)
      .in("id", list.map((r) => r.lead_id as string)),
    "their names",
  );
  const byId = new Map(
    (names.ok && "data" in names ? (names.data as { id: string; name: string | null }[]) : [])
      .map((n) => [n.id, (n.name ?? "").trim()]),
  );

  return done(list.map((r) => ({
    leadId: r.lead_id as string,
    name: byId.get(r.lead_id as string) || "A seller",
    chosenAt: r.chosen_at as string,
    seen: r.chosen_seen as ChoiceSnapshot,
    note: (r.client_note as string | null) ?? null,
  })));
}
