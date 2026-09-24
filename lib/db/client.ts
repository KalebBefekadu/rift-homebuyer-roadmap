import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { inviteTokenHash, journeyTablesMissing } from "./journeys";
import { shapeRevision, type Revision } from "./search";
import { insertHome, insertReaction, readHomes, type Home, type NewHome } from "./shortlist";
import { insertFeedback, readTours, requestTour, type Tours } from "./tours";
import type { FeedbackInput } from "@/lib/core/tour";
import { withTimeout, AUTH_DEADLINE_MS } from "@/lib/core/timeout";
import {
  acceptError, canRespond, memberState, normaliseEmail,
  type MemberState, type Role, type Scope, type Side,
} from "@/lib/core/journey";
import {
  briefErrors, FIELDS, statusOf, SEARCH_SCHEMA_VERSION,
  type Response, type SearchBrief, type SearchCriterion, type SearchStatus,
} from "@/lib/core/search";

/**
 * The client's side of a journey: who is signed in, which journeys they are a
 * member of, and what they may read and write there.
 *
 * AUTHORISATION IS MEMBERSHIP, CHECKED EVERY TIME. A session proves an
 * address; `memberOf` turns it into access only if a live, accepted,
 * unrevoked membership exists for that exact login on that exact journey.
 * Every read and every write below starts there, so revoking a member stops
 * the next request, not the next deploy (AT05).
 *
 * THE PROJECTION IS DELIBERATE. What leaves this file is what the member may
 * see: no agent notes, no lead score, no package internals, no other member's
 * address, and price criteria only with the money scope (REQ-OPS-01, AT06).
 * A field that is not selected cannot be rendered by accident later.
 *
 * The old /plan/<token> link is untouched and grants none of this (AT04).
 */

export type ClientSessionState =
  | { state: "signed-in"; userId: string; email: string | null }
  | { state: "signed-out" }
  | { state: "unknown"; reason: string };

export async function clientSession(): Promise<ClientSessionState> {
  const supabase = await createClient();
  if (!supabase) return { state: "unknown", reason: "sign-in is not configured on this deployment" };
  const { value: auth, timedOut } = await withTimeout(
    supabase.auth.getUser().then((r) => r).catch(() => null),
    AUTH_DEADLINE_MS,
    null,
  );
  if (timedOut) return { state: "unknown", reason: "the sign-in check did not answer in time" };
  if (!auth) return { state: "unknown", reason: "the sign-in check failed" };
  if (auth.error || !auth.data?.user) return { state: "signed-out" };
  return { state: "signed-in", userId: auth.data.user.id, email: auth.data.user.email ?? null };
}

export interface Membership {
  memberId: string;
  journeyId: string;
  agentId: string;
  role: Role;
  scopes: Scope[];
  name: string;
  journeyLabel: string;
  side: Side;
  agentName: string;
}

const MEMBERSHIP_SELECT = "id,journey_id,agent_id,role,scopes,display_name,email,accepted_at,revoked_at,invite_expires_at";

async function hydrate(rows: Record<string, unknown>[]): Promise<Membership[]> {
  const db = serviceClient();
  if (!db || rows.length === 0) return [];
  const live = rows.filter((r) => memberState({
    acceptedAt: r.accepted_at as string | null, revokedAt: r.revoked_at as string | null,
    inviteExpiresAt: r.invite_expires_at as string | null,
  }) === "active");
  if (live.length === 0) return [];
  const [journeys, agents] = await Promise.all([
    boundedRead(db.from("rift_journeys").select("id,label,side").in("id", live.map((r) => r.journey_id as string)), "your journeys"),
    boundedRead(db.from("rift_agents").select("id,name").in("id", [...new Set(live.map((r) => r.agent_id as string))]), "your agent"),
  ]);
  const j = new Map(((journeys.ok && "data" in journeys ? journeys.data : []) as { id: string; label: string; side: Side }[]).map((x) => [x.id, x]));
  const a = new Map(((agents.ok && "data" in agents ? agents.data : []) as { id: string; name: string | null }[]).map((x) => [x.id, x.name ?? "Your agent"]));
  return live.filter((r) => j.has(r.journey_id as string)).map((r) => ({
    memberId: r.id as string,
    journeyId: r.journey_id as string,
    agentId: r.agent_id as string,
    role: r.role as Role,
    scopes: (r.scopes as Scope[]) ?? [],
    name: (r.display_name as string | null)?.trim() || (r.email as string),
    journeyLabel: j.get(r.journey_id as string)!.label,
    side: j.get(r.journey_id as string)!.side,
    agentName: a.get(r.agent_id as string) ?? "Your agent",
  }));
}

/** Every journey this login is a live member of. */
export async function myJourneys(userId: string): Promise<DbResult<Membership[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_journey_members").select(MEMBERSHIP_SELECT)
      .eq("auth_user_id", userId).is("revoked_at", null).limit(20),
    "your journeys",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done([]) : r;
  return done(await hydrate(("data" in r ? r.data : []) as Record<string, unknown>[]));
}

/** The one gate. Null means no access, whatever the reason. */
export async function memberOf(userId: string, journeyId: string): Promise<DbResult<Membership | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_journey_members").select(MEMBERSHIP_SELECT)
      .eq("auth_user_id", userId).eq("journey_id", journeyId).is("revoked_at", null).maybeSingle(),
    "your access",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  const [m] = await hydrate([row]);
  return done(m ?? null);
}

/* ------------------------------------------------------------------------ */
/* Invitations                                                               */
/* ------------------------------------------------------------------------ */

export interface InvitationView {
  memberId: string;
  /** Masked: "d***@example.com". The page is reachable by anybody holding the link. */
  maskedEmail: string;
  email: string;
  journeyLabel: string;
  agentName: string;
  state: MemberState;
}

export const maskEmail = (e: string) => {
  const [user, host] = e.split("@");
  return `${(user ?? "").slice(0, 1)}***@${host ?? ""}`;
};

export async function invitationByToken(token: string): Promise<DbResult<InvitationView | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return done(null);
  const r = await boundedRead(
    db.from("rift_journey_members").select("id,email,journey_id,agent_id,accepted_at,revoked_at,invite_expires_at")
      .eq("invite_token_hash", inviteTokenHash(token)).maybeSingle(),
    "the invitation",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  const [journey, agent] = await Promise.all([
    boundedRead(db.from("rift_journeys").select("label").eq("id", row.journey_id as string).maybeSingle(), "the journey"),
    boundedRead(db.from("rift_agents").select("name").eq("id", row.agent_id as string).maybeSingle(), "your agent"),
  ]);
  return done({
    memberId: row.id as string,
    email: row.email as string,
    maskedEmail: maskEmail(row.email as string),
    journeyLabel: ((journey.ok && "data" in journey ? journey.data : null) as { label: string } | null)?.label ?? "Your move",
    agentName: ((agent.ok && "data" in agent ? agent.data : null) as { name: string | null } | null)?.name ?? "Your agent",
    state: memberState({
      acceptedAt: row.accepted_at as string | null, revokedAt: row.revoked_at as string | null,
      inviteExpiresAt: row.invite_expires_at as string | null,
    }),
  });
}

/**
 * Accept: attach this login to the invitation. Conditional on it still being
 * unaccepted and unrevoked in the WHERE clause, so two tabs produce one
 * membership, and the link dies in the same write.
 */
export async function acceptInvitation(token: string, userId: string, sessionEmail: string | null): Promise<DbResult<{ journeyId: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return failed("This invitation link is not valid");
  const hash = inviteTokenHash(token);
  const r = await boundedRead(
    db.from("rift_journey_members").select("id,email,journey_id,accepted_at,revoked_at,invite_expires_at")
      .eq("invite_token_hash", hash).maybeSingle(),
    "the invitation",
  );
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  if (!row) return failed("This invitation link is not valid, or has already been used");
  const why = acceptError({
    email: row.email as string, acceptedAt: row.accepted_at as string | null,
    revokedAt: row.revoked_at as string | null, inviteExpiresAt: row.invite_expires_at as string | null,
  }, sessionEmail);
  if (why) return failed(why);

  const wrote = await boundedWrite(
    db.from("rift_journey_members")
      .update({ auth_user_id: userId, accepted_at: new Date().toISOString(), invite_token_hash: null })
      .eq("id", row.id as string).eq("invite_token_hash", hash).is("accepted_at", null).is("revoked_at", null)
      .select("journey_id"),
    "joining",
  );
  if (!wrote.ok) {
    return /one_live_user|duplicate key/.test(wrote.error)
      ? failed("You are already a member of this journey with this login")
      : wrote;
  }
  const hit = (("data" in wrote ? wrote.data : null) as { journey_id: string }[] | null) ?? [];
  if (hit.length === 0) return failed("This invitation was used or withdrawn a moment ago");
  return done({ journeyId: hit[0]!.journey_id });
}

/**
 * Whether an address may be sent a sign-in link. True for anybody with a live
 * membership or a waiting invitation, so the sign-in page never creates an
 * account for a stranger. The page answers the same thing either way, so this
 * does not reveal which addresses are clients.
 */
export async function mayReceiveSignIn(email: string): Promise<boolean> {
  const db = serviceClient();
  const e = normaliseEmail(email);
  if (!db || !e) return false;
  const r = await boundedRead(
    db.from("rift_journey_members").select("id").eq("email", e).is("revoked_at", null).limit(1),
    "the address",
  );
  return r.ok && "data" in r && ((r.data as unknown[]) ?? []).length > 0;
}

/* ------------------------------------------------------------------------ */
/* The brief, as a member sees it                                            */
/* ------------------------------------------------------------------------ */

export interface ClientBrief {
  revision: Revision | null;
  /** Criteria the member cannot see (money without the money scope) are removed, and counted. */
  hidden: number;
  /** The previous revision, projected the same way, for "what changed". */
  previous: Revision | null;
  myResponse: { response: Response; note: string | null; at: string } | null;
  status: SearchStatus;
  /** When the agent last recorded setting the search up. Never "Matrix says". */
  activeSince: string | null;
}

const hide = (rev: Revision, scopes: Scope[]): { rev: Revision; hidden: number } => {
  if (scopes.includes("money")) return { rev, hidden: 0 };
  const kept = rev.brief.criteria.filter((c) => !FIELDS[c.field].money);
  return { rev: { ...rev, brief: { ...rev.brief, criteria: kept } }, hidden: rev.brief.criteria.length - kept.length };
};

export async function clientBrief(m: Membership): Promise<DbResult<ClientBrief>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!m.scopes.includes("search")) return failed("Your agent has not shared the search with you");

  const [revs, pkgs, mine] = await Promise.all([
    boundedRead(
      db.from("rift_search_revisions").select("id,revision,criteria,questions,note,author_kind,author_label,created_at")
        .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).order("revision", { ascending: false }).limit(2),
      "your search",
    ),
    boundedRead(
      db.from("rift_search_packages").select("status,package,confirmed_at")
        .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).in("status", ["manual-action-needed", "active-confirmed", "paused"]),
      "your search",
    ),
    boundedRead(
      db.from("rift_search_responses").select("revision_id,response,note,created_at")
        .eq("journey_id", m.journeyId).eq("member_id", m.memberId).order("created_at", { ascending: false }).limit(1),
      "your answer",
    ),
  ]);
  if (!revs.ok) return revs;
  if (!pkgs.ok) return pkgs;
  const rows = (("data" in revs ? revs.data : []) as Record<string, unknown>[]).map(shapeRevision);
  const latest = rows[0] ? hide(rows[0], m.scopes) : null;
  const previous = rows[1] ? hide(rows[1], m.scopes).rev : null;

  const live = ("data" in pkgs ? pkgs.data : []) as { status: string; package: { revision: number }; confirmed_at: string | null }[];
  const active = live.find((p) => p.status !== "manual-action-needed");
  const pending = live.find((p) => p.status === "manual-action-needed");
  const status = statusOf({
    latest: rows[0]?.revision ?? null,
    active: active ? { revision: active.package.revision, status: active.status as "active-confirmed" | "paused" } : null,
    pending: pending ? { revision: pending.package.revision } : null,
  });

  const lastMine = mine.ok && "data" in mine ? ((mine.data as Record<string, unknown>[])[0] ?? null) : null;
  return done({
    revision: latest?.rev ?? null,
    hidden: latest?.hidden ?? 0,
    previous,
    myResponse: lastMine && rows[0] && lastMine.revision_id === rows[0].id
      ? { response: lastMine.response as Response, note: (lastMine.note as string | null) ?? null, at: lastMine.created_at as string }
      : null,
    status,
    activeSince: active?.confirmed_at ?? null,
  });
}

/**
 * Confirm the latest revision, or ask for changes to it. Against the exact
 * revision the member was shown: an answer to revision 3 after revision 4
 * exists is refused, so nobody confirms a brief they never read (AT22's rule,
 * applied here).
 */
export async function respondToBrief(
  m: Membership, revisionId: string, response: Response, note: string | null,
): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!canRespond(m.role) || !m.scopes.includes("search")) return failed("Your access lets you read this, not answer it");
  if (response !== "confirmed" && response !== "changes-requested") return failed("Confirm it or ask for changes");
  const why = note?.trim() || null;
  if (response === "changes-requested" && !why) return failed("Say what should change");
  if (why && why.length > 1000) return failed("Keep it under 1,000 characters");

  const latest = await boundedRead(
    db.from("rift_search_revisions").select("id").eq("journey_id", m.journeyId).eq("agent_id", m.agentId)
      .order("revision", { ascending: false }).limit(1).maybeSingle(),
    "your search",
  );
  if (!latest.ok) return latest;
  const id = (("data" in latest ? latest.data : null) as { id: string } | null)?.id;
  if (!id || id !== revisionId) return failed("The search changed since you opened this page. Reload to see the latest version");

  const wrote = await boundedWrite(
    db.from("rift_search_responses").insert({
      agent_id: m.agentId, journey_id: m.journeyId, revision_id: revisionId, member_id: m.memberId, response, note: why,
    }),
    "your answer",
  );
  if (!wrote.ok) return wrote;
  return done({ recorded: true as const });
}

/**
 * A member proposes a change: a new revision authored by them. Attribution is
 * set HERE: a criterion they changed is "stated by" them, today, from the
 * client page, whatever the browser sent, so nobody can post a change that
 * reads as the agent's. Criteria they cannot see (money, without the scope)
 * are carried over untouched from the latest revision.
 */
export async function proposeRevision(
  m: Membership, submitted: SearchBrief, expectedLatest: number, note: string | null,
): Promise<DbResult<{ revision: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!canRespond(m.role) || !m.scopes.includes("search")) return failed("Your access lets you read this, not change it");

  const latestRead = await boundedRead(
    db.from("rift_search_revisions").select("id,revision,criteria,questions,note,author_kind,author_label,created_at")
      .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).order("revision", { ascending: false }).limit(1).maybeSingle(),
    "your search",
  );
  if (!latestRead.ok) return latestRead;
  const latestRow = ("data" in latestRead ? latestRead.data : null) as Record<string, unknown> | null;
  const latest = latestRow ? shapeRevision(latestRow) : null;
  if ((latest?.revision ?? 0) !== expectedLatest) {
    return failed("The search changed since you opened this page. Reload to see the latest version, then make your change");
  }

  const today = new Date().toISOString().slice(0, 10);
  const before = new Map((latest?.brief.criteria ?? []).map((c) => [c.id, c]));
  const canSeeMoney = m.scopes.includes("money");
  const visible: SearchCriterion[] = submitted.criteria
    .filter((c) => canSeeMoney || !FIELDS[c.field]?.money)
    .map((c) => {
      const was = before.get(c.id);
      const same = was && JSON.stringify(was.value) === JSON.stringify(c.value) && was.operator === c.operator
        && was.strength === c.strength && was.field === c.field;
      return same ? was : { ...c, statedBy: `${m.name.slice(0, 60)} (buyer)`, statedAt: today, sourceRef: "client page" };
    });
  const carried = canSeeMoney ? [] : (latest?.brief.criteria ?? []).filter((c) => FIELDS[c.field].money);
  const brief: SearchBrief = { criteria: [...carried, ...visible], questions: submitted.questions ?? [] };
  const errors = briefErrors(brief);
  if (errors.length) return failed(errors[0]!);

  const revision = expectedLatest + 1;
  const wrote = await boundedWrite(
    db.from("rift_search_revisions").insert({
      agent_id: m.agentId, journey_id: m.journeyId, revision, schema_version: SEARCH_SCHEMA_VERSION,
      criteria: brief.criteria, questions: brief.questions, note: note?.trim().slice(0, 2000) || null,
      author_kind: "client", author_member_id: m.memberId, author_label: m.name.slice(0, 120),
    }),
    "your change",
  );
  if (!wrote.ok) {
    return /out of order|one_number|duplicate key/.test(wrote.error)
      ? failed("Somebody saved a change a moment ago. Reload to see it, then make yours")
      : wrote;
  }
  return done({ revision });
}

/* ------------------------------------------------------------------------ */
/* Homes, as a member sees them                                              */
/* ------------------------------------------------------------------------ */

/** Homes with reactions. A member sees names on reactions, never addresses. */
export async function clientHomes(m: Membership): Promise<DbResult<Home[]>> {
  if (!m.scopes.includes("homes")) return failed("Your agent has not shared the homes with you");
  const r = await readHomes(m.journeyId, m.agentId);
  if (!r.ok || !("data" in r)) return r;
  if (m.scopes.includes("money")) return r;
  /* Price and HOA are money. A viewer helping with the search sees the homes,
     not what they cost against the buyer's budget. */
  return done(r.data.map((h) => ({ ...h, facts: { ...h.facts, price: null, hoaMonthly: null } })));
}

export async function reactAsMember(m: Membership, homeId: string, reaction: string, reason: string | null) {
  if (!canRespond(m.role) || !m.scopes.includes("homes")) return failed("Your access lets you look, not react");
  return insertReaction(m.journeyId, m.agentId, homeId, { memberId: m.memberId, label: m.name }, reaction as never, reason);
}

export async function addHomeAsMember(m: Membership, h: NewHome) {
  if (!canRespond(m.role) || !m.scopes.includes("homes")) return failed("Your access lets you look, not add homes");
  return insertHome(m.journeyId, m.agentId, h, { kind: "client", memberId: m.memberId, label: m.name });
}

/* ------------------------------------------------------------------ *
 * Showings (journey contract B06)
 * ------------------------------------------------------------------ */

/** The showings on this journey, for anybody who can see its homes. */
export async function clientTours(m: Membership): Promise<DbResult<Tours>> {
  if (!m.scopes.includes("homes")) return done({ stops: [], coverage: { covered: false, note: "" } });
  return readTours(m.journeyId, m.agentId);
}

/**
 * "Would like to see it": asks for a showing and records the reaction, so the
 * agent sees both the request and who wanted it. Asking is never booking
 * (AT17); the agent arranges it in ShowingTime.
 */
export async function requestTourAsMember(m: Membership, homeId: string, availability: string | null, requestId: string) {
  if (!canRespond(m.role) || !m.scopes.includes("homes")) return failed("Your access lets you look, not ask for showings");
  const r = await requestTour(m.journeyId, m.agentId, homeId, availability, { kind: "client", memberId: m.memberId, label: m.name }, requestId);
  if (!r.ok || !("data" in r)) return r;
  if (!r.data.existing) {
    await insertReaction(m.journeyId, m.agentId, homeId, { memberId: m.memberId, label: m.name }, "tour-requested", null);
  }
  return r;
}

/** The short answer after a showing. */
export async function tourFeedbackAsMember(m: Membership, stopId: string, f: FeedbackInput) {
  if (!canRespond(m.role) || !m.scopes.includes("homes")) return failed("Your access lets you look, not answer");
  return insertFeedback(m.journeyId, m.agentId, stopId, f, { memberId: m.memberId, label: m.name });
}
