import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { withTimeout, AUTH_DEADLINE_MS } from "@/lib/core/timeout";
import { memberError, type TeamMember } from "@/lib/core/team";

/**
 * The agent's team (Blueprint v5 §8.7): coordinators he lets in to record
 * their part of the checklist.
 *
 * A coordinator is not an agent. They sign in with the address they were
 * invited at; the first sign-in binds the account to the membership, and a
 * removed membership stops working on the next request. Nothing a coordinator
 * posts is authority on its own: every write resolves the membership again
 * from the session and checks the step is theirs (lib/db/checklist.ts).
 *
 * A missing table (the migration not applied yet) is `null`, which the pages
 * say, rather than an empty team.
 */

export const TEAM_NOT_YET =
  "The team needs the database update (migration 20260929000000, in output/pending-migrations.sql).";
export const teamTablesMissing = (msg: string) =>
  /rift_(team_members|step_assignments)|actor_kind|team_member_id/.test(msg) && /does not exist|schema cache|Could not find/i.test(msg);

const COLUMNS = "id,email,display_name,role,invited_at,accepted_at,revoked_at,revoked_reason,actor_label";

function shape(r: Record<string, unknown>): TeamMember {
  return {
    id: r.id as string, email: r.email as string, name: r.display_name as string, role: "coordinator",
    invitedAt: r.invited_at as string, acceptedAt: (r.accepted_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null, revokedReason: (r.revoked_reason as string | null) ?? null,
    invitedBy: r.actor_label as string,
  };
}

type Scope = { skip: DbResult<never> } | { db: NonNullable<ReturnType<typeof serviceClient>>; agentId: string };

async function scope(): Promise<Scope> {
  const db = serviceClient();
  if (!db) return { skip: skipped("no database configured") };
  const agentId = await currentAgentId();
  if (!agentId) return { skip: skipped("no agent row exists yet") };
  return { db, agentId };
}

/** Everyone on the team, live first, then removed. */
export async function readTeam(): Promise<DbResult<TeamMember[] | null>> {
  const s = await scope();
  if ("skip" in s) return s.skip;
  const r = await boundedRead(s.db.from("rift_team_members").select(COLUMNS).eq("agent_id", s.agentId).order("invited_at").limit(100), "the team");
  if (!r.ok) return teamTablesMissing(r.error) ? done(null) : r;
  const list = (("data" in r ? r.data : []) as Record<string, unknown>[]).map(shape);
  return done([...list.filter((m) => !m.revokedAt), ...list.filter((m) => m.revokedAt)]);
}

export async function addTeamMember(input: { name: string; email: string }, agentLabel: string): Promise<DbResult<{ id: string }>> {
  const bad = memberError(input);
  if (bad) return failed(bad);
  const s = await scope();
  if ("skip" in s) return s.skip;
  const w = await boundedWrite(
    s.db.from("rift_team_members").insert({
      agent_id: s.agentId, email: input.email.trim().toLowerCase(), display_name: input.name.trim(), actor_label: agentLabel.slice(0, 120),
    }).select("id").single(),
    "the team",
  );
  if (!w.ok) {
    if (teamTablesMissing(w.error)) return failed(TEAM_NOT_YET);
    return /email_live|duplicate key/.test(w.error) ? failed("That address is already on your team") : w;
  }
  return done({ id: ((w as { data?: { id: string } }).data ?? { id: "" }).id });
}

export async function removeTeamMember(memberId: string, reason: string): Promise<DbResult<{ id: string }>> {
  if (!reason.trim()) return failed("Say why they are being removed");
  const s = await scope();
  if ("skip" in s) return s.skip;
  const w = await boundedWrite(
    s.db.from("rift_team_members").update({ revoked_at: new Date().toISOString(), revoked_reason: reason.trim().slice(0, 300) })
      .eq("id", memberId).eq("agent_id", s.agentId).is("revoked_at", null).select("id"),
    "the team",
  );
  if (!w.ok) return w;
  const rows = ((w as { data?: unknown[] }).data ?? []) as unknown[];
  return rows.length ? done({ id: memberId }) : failed("They are not on your team, or were already removed");
}

/** Whether an address may be sent a coordinator sign-in link: a live membership. */
export async function mayReceiveTeamSignIn(email: string): Promise<boolean> {
  const db = serviceClient();
  const e = email.trim().toLowerCase();
  if (!db || !e) return false;
  const r = await boundedRead(db.from("rift_team_members").select("id").eq("email", e).is("revoked_at", null).limit(1), "the address");
  return r.ok && "data" in r && ((r.data as unknown[]) ?? []).length > 0;
}

export interface TeamSession {
  memberId: string;
  agentId: string;
  name: string;
  email: string;
}

export type TeamSessionState =
  | { state: "signed-in"; member: TeamSession }
  | { state: "signed-out"; reason: string }
  | { state: "unknown"; reason: string };

/**
 * Who is asking, on the coordinator's pages. Same three answers as
 * agentSession(): a slow check is never shown a sign-in form.
 *
 * The first sign-in binds the account: the membership for this address that
 * has no account yet gets this one. After that the account, not the address,
 * is what is matched, so changing the email on the account does not move the
 * membership, and a removed membership is not found.
 */
export async function teamSession(): Promise<TeamSessionState> {
  const supabase = await createClient();
  if (!supabase) return { state: "unknown", reason: "sign-in is not configured on this deployment" };
  const { value: auth, timedOut } = await withTimeout(supabase.auth.getUser().then((r) => r).catch(() => null), AUTH_DEADLINE_MS, null);
  if (timedOut) return { state: "unknown", reason: "the sign-in check did not answer in time" };
  if (!auth) return { state: "unknown", reason: "the sign-in check failed" };
  if (auth.error || !auth.data?.user) return { state: "signed-out", reason: "no session" };
  const user = auth.data.user;
  const db = serviceClient();
  if (!db) return { state: "unknown", reason: "the database is not configured" };

  const bound = await boundedRead(
    db.from("rift_team_members").select("id,agent_id,display_name,email").eq("auth_user_id", user.id).is("revoked_at", null).maybeSingle(),
    "your membership",
  );
  if (!bound.ok) return teamTablesMissing(bound.error) ? { state: "signed-out", reason: TEAM_NOT_YET } : { state: "unknown", reason: bound.error };
  let row = ("data" in bound ? bound.data : null) as Record<string, unknown> | null;

  if (!row && user.email) {
    const email = user.email.trim().toLowerCase();
    const w = await boundedWrite(
      db.from("rift_team_members").update({ auth_user_id: user.id, accepted_at: new Date().toISOString() })
        .eq("email", email).is("revoked_at", null).is("auth_user_id", null).select("id,agent_id,display_name,email"),
      "your membership",
    );
    if (!w.ok) return { state: "unknown", reason: w.error };
    row = (((w as { data?: unknown[] }).data ?? []) as Record<string, unknown>[])[0] ?? null;
  }
  if (!row) return { state: "signed-out", reason: "signed in, but not on an agent's team" };
  return {
    state: "signed-in",
    member: { memberId: row.id as string, agentId: row.agent_id as string, name: row.display_name as string, email: row.email as string },
  };
}
