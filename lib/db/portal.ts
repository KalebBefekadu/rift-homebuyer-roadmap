import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { inviteTokenHash, journeyTablesMissing } from "./journeys";
import { insertHome, insertReaction, readHomes, type Home, type NewHome } from "./shortlist";
import { insertFeedback, readTours, requestTour, type Tours } from "./tours";
import type { FeedbackInput } from "@/lib/core/tour";
import { readProgress, recordWork } from "./progress";
import { readDeadlines } from "./deadlines";
import type { DeadlineView } from "@/lib/core/deadline";
import { planItemsFor } from "./plan";
import { afterClose, visitedStages, type Progress, type Stage, type Workstream, type WorkstreamView } from "@/lib/core/progress";
import type { PlanItem } from "@/lib/core/plan";
import { describe, REACTION_LABEL, type Reaction } from "@/lib/core/search";
import { buyerLabel, OFFER_LABEL } from "@/lib/core/tour";
import { INSTRUCTION_LABEL } from "@/lib/core/bid";
import { buyerDateLine } from "@/lib/core/deadline";
import { STAGE_LABEL, workLine } from "@/lib/core/progress";
import { withTimeout, AUTH_DEADLINE_MS } from "@/lib/core/timeout";
import { acceptError, canRespond, memberState, normaliseEmail, type MemberState, type Role, type Scope, type Side } from "@/lib/core/journey";
import { showDay } from "@/lib/core/day";
import { clientBrief } from "./portal-brief";
import { clientBids } from "./portal-offers";

/**
 * The client's side of a journey: who is signed in, which journeys they are a
 * member of, and what they may read and write there. (Named portal, not
 * client, so it is never confused with lib/db/clients.ts, the agent's people.)
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
  /** How to reach the agent, for Help on every page (Blueprint v5 §7.2). */
  agentEmail: string | null;
}

const MEMBERSHIP_SELECT = "id,journey_id,agent_id,role,scopes,display_name,email,accepted_at,revoked_at,invite_expires_at";

async function hydrate(rows: Record<string, unknown>[], anyState = false): Promise<Membership[]> {
  const db = serviceClient();
  if (!db || rows.length === 0) return [];
  const live = anyState ? rows : rows.filter((r) => memberState({
    acceptedAt: r.accepted_at as string | null, revokedAt: r.revoked_at as string | null,
    inviteExpiresAt: r.invite_expires_at as string | null,
  }) === "active");
  if (live.length === 0) return [];
  const [journeys, agents] = await Promise.all([
    boundedReport(db.from("rift_journeys").select("id,label,side").in("id", live.map((r) => r.journey_id as string)), "your journeys"),
    boundedReport(db.from("rift_agents").select("id,name,email").in("id", [...new Set(live.map((r) => r.agent_id as string))]), "your agent"),
  ]);
  const j = new Map(((journeys.ok && "data" in journeys ? journeys.data : []) as { id: string; label: string; side: Side }[]).map((x) => [x.id, x]));
  const agentRows = (agents.ok && "data" in agents ? agents.data : []) as { id: string; name: string | null; email: string | null }[];
  const a = new Map(agentRows.map((x) => [x.id, x.name ?? "Your agent"]));
  const mail = new Map(agentRows.map((x) => [x.id, x.email ?? null]));
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
    agentEmail: mail.get(r.agent_id as string) ?? null,
  }));
}

/** Every journey this login is a live member of. */
export async function myJourneys(userId: string): Promise<DbResult<Membership[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedReport(
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
  const r = await boundedReport(
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

/**
 * A member as the agent previews them (manual review WS10.2). Scoped to the
 * agent's own journeys by the caller's agent id, and including a member who
 * has not joined yet, so the agent can check what an invitation will show
 * before it is opened. It grants nothing: the preview page only reads, and
 * the agent's session is never turned into the member's.
 */
export async function memberForPreview(agentId: string, journeyId: string, memberId: string): Promise<DbResult<Membership | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedReport(
    db.from("rift_journey_members").select(MEMBERSHIP_SELECT)
      .eq("id", memberId).eq("journey_id", journeyId).eq("agent_id", agentId).is("revoked_at", null).maybeSingle(),
    "that member",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  const [m] = await hydrate([row], true);
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
  const r = await boundedReport(
    db.from("rift_journey_members").select("id,email,journey_id,agent_id,accepted_at,revoked_at,invite_expires_at")
      .eq("invite_token_hash", inviteTokenHash(token)).maybeSingle(),
    "the invitation",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  const [journey, agent] = await Promise.all([
    boundedReport(db.from("rift_journeys").select("label").eq("id", row.journey_id as string).maybeSingle(), "the journey"),
    boundedReport(db.from("rift_agents").select("name").eq("id", row.agent_id as string).maybeSingle(), "your agent"),
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
  const r = await boundedReport(
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
  const r = await boundedReport(
    db.from("rift_journey_members").select("id").eq("email", e).is("revoked_at", null).limit(1),
    "the address",
  );
  return r.ok && "data" in r && ((r.data as unknown[]) ?? []).length > 0;
}

/**
 * Who else is on a journey, for the account page. Names and roles only, never
 * another member's address (the projection rule at the top of this file), and
 * only people who have joined or are still invited, not withdrawn ones.
 */
export async function householdOf(m: Membership): Promise<DbResult<{ name: string; role: Role; joined: boolean; you: boolean }[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedReport(
    db.from("rift_journey_members").select("id,display_name,role,accepted_at,revoked_at,invite_expires_at")
      .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).is("revoked_at", null).order("invited_at").limit(20),
    "who is on your move",
  );
  if (!r.ok) return r;
  const rows = (("data" in r ? r.data : null) ?? []) as Record<string, unknown>[];
  return done(rows
    .filter((x) => memberState({ acceptedAt: x.accepted_at as string | null, revokedAt: null, inviteExpiresAt: x.invite_expires_at as string | null }) !== "expired")
    .map((x) => ({
      name: (x.display_name as string | null)?.trim() || (x.id === m.memberId ? m.name : "Invited guest"),
      role: x.role as Role,
      joined: Boolean(x.accepted_at),
      you: x.id === m.memberId,
    })));
}

/**
 * Whether this member wants an email when something new is shared (manual
 * review WS11.5). Null when it could not be read or the column is not
 * migrated yet, so the page does not offer a switch that would not stick.
 */
export async function myNotices(m: Membership): Promise<boolean | null> {
  const db = serviceClient();
  if (!db) return null;
  const r = await boundedReport(
    db.from("rift_journey_members").select("notices").eq("id", m.memberId).eq("agent_id", m.agentId).maybeSingle(),
    "your email settings",
  );
  if (!r.ok) return null;
  const row = ("data" in r ? r.data : null) as { notices: boolean | null } | null;
  return row ? row.notices !== false : null;
}

export async function setMyNotices(m: Membership, on: boolean): Promise<DbResult<{ on: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const w = await boundedWrite(
    db.from("rift_journey_members").update({ notices: on }).eq("id", m.memberId).eq("agent_id", m.agentId),
    "your email settings",
  );
  if (!w.ok) return w;
  return done({ on });
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

/* ------------------------------------------------------------------ *
 * Progress and Today (blueprint v4 W07)
 * ------------------------------------------------------------------ */

export interface ClientProgress {
  progress: Progress;
  /** The stages this journey was recorded at, so the strip ticks only those. */
  visited: Stage[];
  /** False for a viewer: they see where the move is, not the details of it. */
  detail: boolean;
  open: { id: string; address: string; work: WorkstreamView[] } | null;
  /** Once the contract closed: the home, possession, and who confirmed the closing (W11). */
  closed: { id: string; address: string; work: WorkstreamView[]; closing: { on: string; from: string } | null } | null;
  /** Contracts that ended before the current one, newest first: the address, how it ended and when. */
  earlier: { address: string; outcome: "closed" | "terminated"; at: string }[];
  plan: PlanItem[];
  /** The open contract's contractual dates, for Today on the server only: they carry the agent's notes. */
  dates: { label: string; workstream: Workstream | null; view: DeadlineView }[];
  unavailable?: string;
}

/**
 * Where the journey is, the open contract's workstreams and the plan, for a
 * member. A viewer (a parent helping with the search, say) sees the stage
 * only: workstream notes can be about somebody's loan, and the plan was
 * written for the buyers.
 */
export async function clientProgress(m: Membership): Promise<DbResult<ClientProgress>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await readProgress(m.journeyId, m.agentId);
  if (!r.ok || !("data" in r)) return r as DbResult<never>;
  const rec = r.data;
  const visited = visitedStages(rec.events);
  if (rec.unavailable) return done({ progress: rec.progress, visited, detail: false, open: null, closed: null, earlier: [], plan: [], dates: [], unavailable: rec.unavailable });
  if (!canRespond(m.role)) return done({ progress: rec.progress, visited, detail: false, open: null, closed: null, earlier: [], plan: [], dates: [] });
  const after = afterClose(rec.contracts, rec.open);

  const j = await boundedReport(
    db.from("rift_journeys").select("origin_lead_id").eq("id", m.journeyId).eq("agent_id", m.agentId).maybeSingle(),
    "your plan",
  );
  if (!j.ok) return j;
  const leadId = (("data" in j ? j.data : null) as { origin_lead_id: string } | null)?.origin_lead_id;
  const [plan, deadlines] = await Promise.all([
    leadId ? planItemsFor(leadId, m.agentId) : Promise.resolve(done([] as PlanItem[])),
    rec.open ? readDeadlines(m.journeyId, m.agentId) : Promise.resolve(null),
  ]);
  if (!plan.ok) return plan;
  /* Dates that did not load leave Today without them; the page never
     invents "nothing is due" from a failed read, because the work list and
     plan still carry what is owed. */
  const dates = deadlines && deadlines.ok && "data" in deadlines && rec.open
    ? deadlines.data.deadlines.filter((d) => d.transactionId === rec.open!.id && d.kind === "contractual")
      .map((d) => ({ label: d.label, workstream: d.workstream, view: d.view }))
    : [];
  return done({
    progress: rec.progress,
    visited,
    detail: true,
    open: rec.open ? { id: rec.open.id, address: rec.open.address, work: rec.open.work } : null,
    closed: after ? { id: after.contract.id, address: after.contract.address, work: after.work, closing: after.closing } : null,
    earlier: rec.contracts.filter((c) => c.outcome && c.id !== after?.contract.id)
      .map((c) => ({ address: c.address, outcome: c.outcome!.outcome, at: c.outcome!.at })),
    plan: "data" in plan ? plan.data : [],
    dates,
  });
}

/** "I have done my part." Recorded as reported; the agent confirms (REQ-UX-02). */
export async function reportWorkAsMember(
  m: Membership, contractId: string, workstream: Workstream, note: string | null, expectedSeq: number, requestId: string,
) {
  if (!canRespond(m.role)) return failed("Your access lets you look, not report progress");
  return recordWork(m.journeyId, m.agentId, contractId, workstream,
    { state: "reported", owner: "client", note }, expectedSeq, { kind: "client", memberId: m.memberId, label: m.name }, requestId);
}

/* ------------------------------------------------------------------ *
 * Records (blueprint v4 W11; B20, AT36)
 * ------------------------------------------------------------------ */

export interface RecordSection {
  title: string;
  lines: string[];
}

export interface ClientRecords {
  sections: RecordSection[];
  /** Documents the household was asked about, which this member may open. */
  documents: { id: string; label: string; family: string }[];
}

/**
 * Everything this member may see about the journey, worded for them, on one
 * page they can print or save (B20: exportable records). Built from the same
 * reads as their journey page, so it shows nothing they could not already
 * see: no agent notes, no references, no criteria outside their scopes. A
 * section that could not be read says so rather than looking empty.
 */
export async function clientRecords(m: Membership): Promise<DbResult<ClientRecords>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentFirst = m.agentName.trim().split(/\s+/)[0] ?? m.agentName;
  const buy = m.side === "buy";
  const [brief, homes, tours, prog, bids, deadlines] = await Promise.all([
    buy && m.scopes.includes("search") ? clientBrief(m) : Promise.resolve(null),
    buy && m.scopes.includes("homes") ? clientHomes(m) : Promise.resolve(null),
    buy && m.scopes.includes("homes") ? clientTours(m) : Promise.resolve(null),
    buy ? clientProgress(m) : Promise.resolve(null),
    buy && m.scopes.includes("money") ? clientBids(m) : Promise.resolve(null),
    buy && canRespond(m.role) ? readDeadlines(m.journeyId, m.agentId) : Promise.resolve(null),
  ]);
  const NOT_READ = "This part could not be read just now. Reload to try again.";
  const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });
  const sections: RecordSection[] = [];
  const got = <T,>(r: DbResult<T> | null): T | null | undefined => (r === null ? undefined : r.ok && "data" in r ? r.data : null);

  const b = got(brief);
  if (b !== undefined) {
    const lines = b === null ? [NOT_READ]
      : !b.revision ? ["No search priorities have been written down yet."]
      : [
        `Revision ${b.revision.revision}, ${DAY(b.revision.createdAt)}.`,
        ...b.revision.brief.criteria.map((c) => `${describe(c, m.scopes.includes("money"))} (${c.strength === "hard" ? "must have" : c.strength === "preference" ? "preferred" : "not decided"})`),
        ...(b.hidden ? [`${b.hidden} more ${b.hidden === 1 ? "item is" : "items are"} not shared with you.`] : []),
        b.myResponse ? `Your answer: ${b.myResponse.response === "confirmed" ? "confirmed" : "asked for changes"}, ${DAY(b.myResponse.at)}.` : "You have not answered this revision.",
      ];
    sections.push({ title: "Search priorities", lines });
  }

  const h = got(homes);
  if (h !== undefined) {
    const lines = h === null ? [NOT_READ] : !h.length ? ["No homes on the list."] : h.map((x) => {
      const mine = x.current.find((r) => r.memberId === m.memberId);
      return `${x.address}${x.withdrawnAt ? ` (off the list: ${x.withdrawnReason})` : ""}. Facts from ${x.factsSource}, as of ${DAY(x.factsAsOf)}.${mine ? ` Your reaction: ${REACTION_LABEL[mine.reaction as Reaction] ?? mine.reaction}.` : ""}`;
    });
    sections.push({ title: "Homes", lines });
  }

  const t = got(tours);
  if (t !== undefined) {
    const lines = t === null ? [NOT_READ] : !t.stops.length ? ["No showings."] : t.stops.map((s) => {
      const f = s.feedback.filter((x) => x.memberId === m.memberId).at(-1);
      return `${s.address}: ${buyerLabel(s.view, agentFirst)}${f ? ` Your answer: ${OFFER_LABEL[f.offer]}.` : ""}`;
    });
    sections.push({ title: "Showings", lines });
  }

  const o = got(bids);
  const documents: ClientRecords["documents"] = [];
  if (o !== undefined) {
    const lines = o === null ? [NOT_READ] : !o.bids.length ? ["No offers you were asked about."] : o.bids.map((x) => {
      for (const d of x.asked?.documents ?? []) if (!documents.some((y) => y.id === d.id)) documents.push(d);
      return `${x.address}: ${x.line}${x.asked?.myAnswer ? ` Your answer on version ${x.asked.version}: ${INSTRUCTION_LABEL[x.asked.myAnswer]}.` : ""}`;
    });
    sections.push({ title: "Offers", lines });
  }

  const p = got(prog);
  if (p !== undefined) {
    const lines: string[] = [];
    if (p === null) lines.push(NOT_READ);
    else {
      lines.push(p.progress.stage === "own" && p.closed?.closing
        ? `You own your home. ${p.closed.closing.from} confirmed the closing on ${DAY(p.closed.closing.on)}.`
        : `Stage: ${STAGE_LABEL[p.progress.stage]}.`);
      const c = p.open ?? p.closed;
      if (c) {
        lines.push(p.open ? `Under contract: ${c.address}.` : `Your home: ${c.address}.`);
        for (const w of c.work) lines.push(`${w.label}: ${workLine(w, agentFirst)}`);
      }
      for (const e of p.earlier) lines.push(`Earlier contract on ${e.address}: ${e.outcome}, ${DAY(e.at)}.`);
    }
    sections.push({ title: "Where things stand", lines });
  }

  /* Only the current contract's dates: an earlier, terminated contract's
     dates are not live, and a countdown to one would be wrong. Once the
     contract closed, its dates are history, said without a countdown. */
  const d = got(deadlines);
  if (d !== undefined) {
    const current = p ? (p.open ?? p.closed) : null;
    const lines = d === null ? [NOT_READ] : !current ? [] : d.deadlines
      .filter((x) => x.kind === "contractual" && x.transactionId === current.id && x.view.verified && x.view.state !== "removed")
      .map((x) => (p?.open ? buyerDateLine(x.label, x.view, agentFirst) : `${x.label}: ${x.view.when}.`))
      .filter((x): x is string => x !== null);
    sections.push({ title: "Contract dates", lines: lines.length ? lines : ["No checked contract dates."] });
  }

  return done({ sections, documents });
}

export * from "./portal-brief";
export * from "./portal-offers";
