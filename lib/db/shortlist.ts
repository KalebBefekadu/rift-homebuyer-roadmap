import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyFor, journeyTablesMissing } from "./journeys";
import { EMPTY_FACTS, factsError, safeListingUrl, type PropertyFacts, type Reaction } from "@/lib/core/search";

/**
 * The shared shortlist (journey contract B05).
 *
 * A home is a link and a handful of facts somebody typed in, each set with a
 * source and an as-of date. No feed and no scraping: Rift has no licensed
 * listing data for this account, and a copied listing page is not a
 * substitute for one (REQ-SEARCH-05, AT16).
 */

export interface HomeReaction {
  memberId: string | null;
  who: string;
  reaction: Reaction;
  reason: string | null;
  at: string;
}

export interface Home {
  id: string;
  address: string;
  url: string | null;
  facts: PropertyFacts;
  factsSource: string;
  factsAsOf: string;
  addedBy: string;
  createdAt: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  /** Each person's CURRENT reaction, one entry per person. */
  current: HomeReaction[];
  /** Every reaction ever recorded, oldest first. */
  history: HomeReaction[];
}

const HOME_COLUMNS =
  "id,address,url,facts,facts_source,facts_as_of,added_by_label,created_at,withdrawn_at,withdrawn_reason";

export function shapeHomes(homes: Record<string, unknown>[], reactions: Record<string, unknown>[]): Home[] {
  const byHome = new Map<string, HomeReaction[]>();
  for (const r of reactions) {
    const list = byHome.get(r.home_id as string) ?? [];
    list.push({
      memberId: (r.member_id as string | null) ?? null, who: r.actor_label as string, reaction: r.reaction as Reaction,
      reason: (r.reason as string | null) ?? null, at: r.created_at as string,
    });
    byHome.set(r.home_id as string, list);
  }
  return homes.map((h) => {
    const history = (byHome.get(h.id as string) ?? []).sort((a, b) => a.at.localeCompare(b.at));
    const latest = new Map<string, HomeReaction>();
    for (const r of history) latest.set(r.memberId ?? `agent:${r.who}`, r);
    return {
      id: h.id as string,
      address: h.address as string,
      url: (h.url as string | null) ?? null,
      facts: { ...EMPTY_FACTS, ...((h.facts as Partial<PropertyFacts>) ?? {}) },
      factsSource: h.facts_source as string,
      factsAsOf: h.facts_as_of as string,
      addedBy: h.added_by_label as string,
      createdAt: h.created_at as string,
      withdrawnAt: (h.withdrawn_at as string | null) ?? null,
      withdrawnReason: (h.withdrawn_reason as string | null) ?? null,
      current: [...latest.values()],
      history,
    };
  });
}

/** Homes on a journey with reactions. Read for the agent, or for a member via lib/db/client.ts. */
export async function readHomes(journeyId: string, agentId: string): Promise<DbResult<Home[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [homes, reactions] = await Promise.all([
    boundedRead(
      db.from("rift_shortlist_homes").select(HOME_COLUMNS)
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(100),
      "the shortlist",
    ),
    boundedRead(
      db.from("rift_home_reactions").select("home_id,member_id,actor_label,reaction,reason,created_at")
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(1000),
      "the reactions",
    ),
  ]);
  if (!homes.ok) return journeyTablesMissing(homes.error) ? done([]) : homes;
  if (!reactions.ok) return journeyTablesMissing(reactions.error) ? done([]) : reactions;
  return done(shapeHomes(
    ("data" in homes ? homes.data : []) as Record<string, unknown>[],
    ("data" in reactions ? reactions.data : []) as Record<string, unknown>[],
  ));
}

export async function homesOf(journeyId: string): Promise<DbResult<Home[]>> {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return readHomes(journeyId, agentId);
}

export interface NewHome {
  address: string;
  url: string | null;
  facts: PropertyFacts;
  factsSource: string;
  factsAsOf: string;
}

export function newHomeError(h: NewHome): string | null {
  if (!h.address.trim() || h.address.trim().length < 3 || h.address.length > 200) return "Give the address";
  if (h.url && !safeListingUrl(h.url)) return "The link must start with https://";
  if (!h.factsSource.trim() || h.factsSource.length > 200) return "Say where the facts came from, like \"Matrix listing\"";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.factsAsOf) || Number.isNaN(Date.parse(h.factsAsOf))) return "Say when the facts were checked";
  return factsError(h.facts);
}

/** Written by lib/db/client.ts for a member too, which passes its own actor. */
export async function insertHome(
  journeyId: string, agentId: string, h: NewHome,
  actor: { kind: "agent"; label: string } | { kind: "client"; memberId: string; label: string },
): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const bad = newHomeError(h);
  if (bad) return failed(bad);
  const wrote = await boundedWrite(
    db.from("rift_shortlist_homes").insert({
      agent_id: agentId, journey_id: journeyId, address: h.address.trim(),
      url: h.url ? safeListingUrl(h.url) : null, facts: h.facts,
      facts_source: h.factsSource.trim(), facts_as_of: h.factsAsOf,
      added_by_kind: actor.kind, added_by_member: actor.kind === "client" ? actor.memberId : null,
      added_by_label: actor.label.slice(0, 120),
    }).select("id").single(),
    "the home",
  );
  if (!wrote.ok) return wrote;
  return done({ id: (("data" in wrote ? wrote.data : null) as { id: string }).id });
}

export async function addHome(journeyId: string, h: NewHome, agentLabel: string): Promise<DbResult<{ id: string }>> {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const j = await journeyFor(journeyId);
  if (!j.ok || !("data" in j)) return j as DbResult<never>;
  if (!j.data) return failed("that journey is not in your book");
  return insertHome(journeyId, agentId, h, { kind: "agent", label: agentLabel });
}

/** Off the active list, kept in the history (REQ-SEARCH-09). */
export async function withdrawHome(homeId: string, reason: string): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const why = reason.trim();
  if (!why || why.length > 300) return failed("Say why, in a few words: \"sold\", \"they passed\"");
  const wrote = await boundedWrite(
    db.from("rift_shortlist_homes").update({ withdrawn_at: new Date().toISOString(), withdrawn_reason: why })
      .eq("id", homeId).eq("agent_id", agentId).is("withdrawn_at", null).select("id"),
    "the home",
  );
  if (!wrote.ok) return wrote;
  if (!((("data" in wrote ? wrote.data : null) as unknown[] | null)?.length)) return failed("Already off the list");
  return done({ id: homeId });
}

export async function insertReaction(
  journeyId: string, agentId: string, homeId: string,
  actor: { memberId: string | null; label: string }, reaction: Reaction, reason: string | null,
): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!["interested", "maybe", "pass", "tour-requested"].includes(reaction)) return failed("Choose a reaction");
  const why = reason?.trim() || null;
  if (why && why.length > 500) return failed("Keep the reason under 500 characters");

  const home = await boundedRead(
    db.from("rift_shortlist_homes").select("id,withdrawn_at").eq("id", homeId).eq("journey_id", journeyId).eq("agent_id", agentId).maybeSingle(),
    "the home",
  );
  if (!home.ok) return home;
  const h = ("data" in home ? home.data : null) as { withdrawn_at: string | null } | null;
  if (!h) return failed("That home is not on this list");
  if (h.withdrawn_at) return failed("That home is off the list now");

  const wrote = await boundedWrite(
    db.from("rift_home_reactions").insert({
      agent_id: agentId, journey_id: journeyId, home_id: homeId, member_id: actor.memberId,
      actor_label: actor.label.slice(0, 120), reaction, reason: why,
    }),
    "the reaction",
  );
  if (!wrote.ok) return wrote;
  return done({ recorded: true as const });
}
