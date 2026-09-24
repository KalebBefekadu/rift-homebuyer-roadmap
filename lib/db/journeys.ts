import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { captureOpError } from "@/lib/monitoring/capture";
import {
  DEFAULT_SCOPES, INVITE_DAYS, labelError, memberState, normaliseEmail, SCOPES,
  type MemberState, type Role, type Scope, type Side,
} from "@/lib/core/journey";

/**
 * Journeys and their members, on the agent's side. The rules are in
 * lib/core/journey.ts; the client's side of membership is lib/db/client.ts.
 *
 * Every function here resolves the agent itself and scopes every query by it.
 * The service-role client bypasses RLS, so a bare journey id from a form is
 * never authority on its own (the same rule as app/(studio)/studio/actions.ts).
 */

/* The tables arrive in migrations. A deployment that runs ahead of them must
   still render the lead page, as a relationship with no journeys, which is
   true, rather than fail it. Same pattern as rift_offer_rooms. */
export const journeyTablesMissing = (msg: string) =>
  /rift_(journeys|journey_members|search_|shortlist_homes|home_reactions|tour_|journey_events|transaction|workstream_|bid|documents|deadline)/.test(msg)
  && /does not exist|schema cache|Could not find/i.test(msg);

export interface Journey {
  id: string;
  leadId: string;
  side: Side;
  label: string;
  createdAt: string;
  /** The relationship's name, for headings. */
  person: string;
}

export interface Member {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  scopes: Scope[];
  state: MemberState;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  inviteExpiresAt: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const inviteTokenHash = hashToken;

function shapeMember(r: Record<string, unknown>, now = new Date()): Member {
  const m = {
    acceptedAt: (r.accepted_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
    inviteExpiresAt: (r.invite_expires_at as string | null) ?? null,
  };
  return {
    id: r.id as string,
    email: r.email as string,
    name: (r.display_name as string | null) ?? null,
    role: r.role as Role,
    scopes: (r.scopes as Scope[]) ?? [],
    state: memberState(m, now),
    invitedAt: r.invited_at as string,
    ...m,
  };
}

const MEMBER_COLUMNS = "id,email,display_name,role,scopes,invited_at,accepted_at,revoked_at,invite_expires_at";

async function agentScope() {
  const db = serviceClient();
  if (!db) return { db: null, agentId: null, why: "no database configured" } as const;
  const agentId = await currentAgentId();
  if (!agentId) return { db: null, agentId: null, why: "no agent row exists yet" } as const;
  return { db, agentId, why: null } as const;
}

/** A relationship's journeys, newest first. */
export async function journeysFor(leadId: string): Promise<DbResult<Journey[]>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const r = await boundedRead(
    s.db.from("rift_journeys").select("id,origin_lead_id,side,label,created_at")
      .eq("origin_lead_id", leadId).eq("agent_id", s.agentId)
      .order("created_at", { ascending: false }).limit(20),
    "their journeys",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done([]) : r;
  const rows = ("data" in r ? r.data : []) as Record<string, unknown>[];
  return done(rows.map((x) => ({
    id: x.id as string, leadId: x.origin_lead_id as string, side: x.side as Side,
    label: x.label as string, createdAt: x.created_at as string, person: "",
  })));
}

/** One journey with its relationship's name, or null when it is not this agent's. */
export async function journeyFor(journeyId: string): Promise<DbResult<Journey | null>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const r = await boundedRead(
    s.db.from("rift_journeys").select("id,origin_lead_id,side,label,created_at")
      .eq("id", journeyId).eq("agent_id", s.agentId).maybeSingle(),
    "the journey",
  );
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  const lead = await boundedRead(
    s.db.from("rift_leads").select("name,email").eq("id", row.origin_lead_id as string).eq("agent_id", s.agentId).maybeSingle(),
    "their name",
  );
  const l = (lead.ok && "data" in lead ? lead.data : null) as { name: string | null; email: string | null } | null;
  return done({
    id: row.id as string, leadId: row.origin_lead_id as string, side: row.side as Side,
    label: row.label as string, createdAt: row.created_at as string,
    person: (l?.name ?? "").trim() || l?.email || "This client",
  });
}

/**
 * Start a journey on an existing relationship. The lead and its readout are
 * untouched (AT01): a journey is a new row that points at them.
 */
export async function createJourney(leadId: string, side: Side, label: string): Promise<DbResult<{ id: string }>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  if (side !== "buy" && side !== "sell") return failed("buying or selling");
  const bad = labelError(label);
  if (bad) return failed(bad);

  const lead = await boundedRead(
    s.db.from("rift_leads").select("id").eq("id", leadId).eq("agent_id", s.agentId).maybeSingle(),
    "the relationship",
  );
  if (!lead.ok) return lead;
  if (!("data" in lead) || !lead.data) return failed("that person is not in your book");

  const wrote = await boundedWrite(
    s.db.from("rift_journeys").insert({ agent_id: s.agentId, origin_lead_id: leadId, side, label: label.trim() }).select("id").single(),
    "the journey",
  );
  if (!wrote.ok) return wrote;

  /* They are a client now. The follow-up sequence is marketing to a lead and
     would talk past the journey, so it stops here, recorded as "They became a
     client" (AT37). If this write misses, the journey still stands: the nurture
     run also skips anyone with a journey, and rechecks just before each send. */
  const stopped = await boundedWrite(
    s.db.from("rift_enrolments")
      .update({ stopped_at: new Date().toISOString(), stop_reason: "converted" })
      .eq("lead_id", leadId).eq("agent_id", s.agentId).is("stopped_at", null),
    "the follow-up sequence",
  );
  if (!stopped.ok) captureOpError(new Error(stopped.error), { op: "journeys.stopNurture" });

  return done({ id: (("data" in wrote ? wrote.data : null) as { id: string }).id });
}

export async function renameJourney(journeyId: string, label: string): Promise<DbResult<{ id: string }>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const bad = labelError(label);
  if (bad) return failed(bad);
  const wrote = await boundedWrite(
    s.db.from("rift_journeys").update({ label: label.trim() }).eq("id", journeyId).eq("agent_id", s.agentId).select("id"),
    "the journey",
  );
  if (!wrote.ok) return wrote;
  if (!((("data" in wrote ? wrote.data : null) as unknown[] | null)?.length)) return failed("that journey is not in your book");
  return done({ id: journeyId });
}

export async function membersOf(journeyId: string): Promise<DbResult<Member[]>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const r = await boundedRead(
    s.db.from("rift_journey_members").select(MEMBER_COLUMNS)
      .eq("journey_id", journeyId).eq("agent_id", s.agentId).order("invited_at").limit(20),
    "who is on it",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done([]) : r;
  return done((("data" in r ? r.data : []) as Record<string, unknown>[]).map((x) => shapeMember(x)));
}

export interface Invitation { memberId: string; token: string; expiresAt: string }

function newToken() {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  return { token, hash: hashToken(token), expiresAt };
}

/**
 * Invite somebody into a journey. Returns the link's token ONCE; only its hash
 * is stored, so a leaked table is not a leaked set of invitations.
 *
 * Inviting an address that already has a live row reissues that row's link
 * (a new token, a new expiry, the old link dead) rather than adding a second
 * membership for the same person.
 */
export async function invite(journeyId: string, input: {
  email: string; name: string | null; role: Role; scopes?: Scope[];
}): Promise<DbResult<Invitation>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const email = normaliseEmail(input.email);
  if (!email) return failed("That email address does not look right");
  if (!["buyer", "co-buyer", "viewer"].includes(input.role)) return failed("Choose a role");
  const scopes = [...new Set(input.scopes ?? DEFAULT_SCOPES[input.role])].filter((x) => SCOPES.includes(x));
  if (scopes.length === 0) return failed("Give them access to at least one part");
  const name = input.name?.trim().slice(0, 120) || null;

  const j = await journeyFor(journeyId);
  if (!j.ok || !("data" in j)) return j as DbResult<never>;
  if (!j.data) return failed("that journey is not in your book");

  const existing = await boundedRead(
    s.db.from("rift_journey_members").select("id,accepted_at")
      .eq("journey_id", journeyId).eq("agent_id", s.agentId).eq("email", email).is("revoked_at", null).maybeSingle(),
    "who is on it",
  );
  if (!existing.ok) return existing;
  const live = ("data" in existing ? existing.data : null) as { id: string; accepted_at: string | null } | null;
  if (live?.accepted_at) return failed(`${email} has already joined`);

  const t = newToken();
  if (live) {
    const wrote = await boundedWrite(
      s.db.from("rift_journey_members")
        .update({ invite_token_hash: t.hash, invite_expires_at: t.expiresAt, role: input.role, scopes, display_name: name })
        .eq("id", live.id).eq("agent_id", s.agentId).is("accepted_at", null),
      "the invitation",
    );
    if (!wrote.ok) return wrote;
    return done({ memberId: live.id, token: t.token, expiresAt: t.expiresAt });
  }

  const wrote = await boundedWrite(
    s.db.from("rift_journey_members").insert({
      agent_id: s.agentId, journey_id: journeyId, email, display_name: name, role: input.role, scopes,
      invite_token_hash: t.hash, invite_expires_at: t.expiresAt,
    }).select("id").single(),
    "the invitation",
  );
  if (!wrote.ok) {
    return /one_live_email|duplicate key/.test(wrote.error) ? failed(`${email} was invited a moment ago. Refresh the page`) : wrote;
  }
  return done({ memberId: (("data" in wrote ? wrote.data : null) as { id: string }).id, token: t.token, expiresAt: t.expiresAt });
}

/** A fresh link for an invitation that has not been accepted. */
export async function reissueInvite(memberId: string): Promise<DbResult<Invitation>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const t = newToken();
  const wrote = await boundedWrite(
    s.db.from("rift_journey_members")
      .update({ invite_token_hash: t.hash, invite_expires_at: t.expiresAt })
      .eq("id", memberId).eq("agent_id", s.agentId).is("accepted_at", null).is("revoked_at", null).select("id"),
    "the invitation",
  );
  if (!wrote.ok) return wrote;
  if (!((("data" in wrote ? wrote.data : null) as unknown[] | null)?.length)) return failed("That invitation was already used or withdrawn");
  return done({ memberId, token: t.token, expiresAt: t.expiresAt });
}

/**
 * Withdraw access. The row stays as the record of who could see what; every
 * client read and write checks `revoked_at` when it runs (AT05).
 */
export async function revokeMember(memberId: string): Promise<DbResult<{ id: string }>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const wrote = await boundedWrite(
    s.db.from("rift_journey_members")
      .update({ revoked_at: new Date().toISOString(), invite_token_hash: null })
      .eq("id", memberId).eq("agent_id", s.agentId).is("revoked_at", null).select("id"),
    "the access",
  );
  if (!wrote.ok) return wrote;
  if (!((("data" in wrote ? wrote.data : null) as unknown[] | null)?.length)) return failed("Already withdrawn");
  return done({ id: memberId });
}

/**
 * Every buying journey, for the Search list in Operations. Bounded: one agent's
 * book, newest first, capped.
 */
export async function buyingJourneys(): Promise<DbResult<Journey[]>> {
  const s = await agentScope();
  if (!s.db) return skipped(s.why!);
  const r = await boundedRead(
    s.db.from("rift_journeys").select("id,origin_lead_id,side,label,created_at")
      .eq("agent_id", s.agentId).eq("side", "buy").order("created_at", { ascending: false }).limit(200),
    "the buying journeys",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done([]) : r;
  const rows = ("data" in r ? r.data : []) as Record<string, unknown>[];
  if (rows.length === 0) return done([]);
  const leads = await boundedRead(
    s.db.from("rift_leads").select("id,name,email").eq("agent_id", s.agentId)
      .in("id", [...new Set(rows.map((x) => x.origin_lead_id as string))]),
    "their names",
  );
  const names = new Map(
    (leads.ok && "data" in leads ? (leads.data as { id: string; name: string | null; email: string | null }[]) : [])
      .map((l) => [l.id, (l.name ?? "").trim() || l.email || "A buyer"]),
  );
  return done(rows.map((x) => ({
    id: x.id as string, leadId: x.origin_lead_id as string, side: x.side as Side, label: x.label as string,
    createdAt: x.created_at as string, person: names.get(x.origin_lead_id as string) ?? "A buyer",
  })));
}
