import "server-only";
import { cache } from "react";
import { serviceClient } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead, boundedWrite } from "./bounded";
import { PROFILE_FIELDS, type AgentProfile, type ProfileField } from "@/lib/core/profile";

/**
 * The agent's own details: reading them, and the one way to change them.
 *
 * Through the service client because a session can only read rift_agents
 * (20260929100000), and must go on only reading it: the row is what makes a
 * login the agent. Every caller checks the session first; this module takes
 * the agent id it is given, as every other writer in lib/db does.
 */

export interface ProfileChange {
  field: ProfileField;
  before: string | null;
  after: string | null;
  by: string;
  at: string;
}

async function read(agentId: string): Promise<DbResult<AgentProfile>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!agentId) return failed("no agent");
  const r = await boundedRead(
    db.from("rift_agents").select(PROFILE_FIELDS.join(",")).eq("id", agentId).maybeSingle(),
    "your profile",
  );
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as Record<ProfileField, string | null> | null;
  if (!row) return failed("the agent record is missing");
  return done(Object.fromEntries(PROFILE_FIELDS.map((f) => [f, row[f] ?? null])) as AgentProfile);
}

/**
 * Once per request: the Operations sidebar counts missing details on every
 * page, and the settings page reads the same row.
 */
export const agentProfile = cache(read);

/** The most recent changes, newest first. Null when the table is not there yet. */
export async function profileHistory(agentId: string, limit = 8): Promise<DbResult<ProfileChange[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_agent_profile_changes").select("field,before,after,by_name,created_at")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit),
    "the profile history",
  );
  /* Before the migration there is nothing to read: say so (null), never "no changes". */
  if (!r.ok) return /rift_agent_profile_changes|does not exist|schema cache/.test(r.error) ? done(null) : r;
  return done((("data" in r ? r.data : []) as Record<string, string | null>[]).map((x) => ({
    field: x.field as ProfileField, before: x.before, after: x.after, by: x.by_name ?? "", at: x.created_at ?? "",
  })));
}

/**
 * Changes, applied and recorded in one transaction by rift_update_agent_profile.
 * `changes` has already been through profileChanges() in lib/core/profile.ts;
 * the database checks again, as the floor for any other caller.
 */
export async function saveAgentProfile(
  agentId: string, changes: Partial<AgentProfile>, by: string,
): Promise<DbResult<{ changed: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!agentId) return failed("no agent");
  if (!Object.keys(changes).length) return done({ changed: 0 });
  const r = await boundedWrite(
    db.rpc("rift_update_agent_profile", { p_agent: agentId, p_changes: changes, p_by: by.slice(0, 120) }),
    "your profile",
  );
  if (!r.ok) {
    return /rift_update_agent_profile|schema cache|does not exist/.test(r.error)
      ? failed("the profile cannot be changed until the database update 20260929410000 is applied")
      : r;
  }
  return done({ changed: Number(("data" in r ? r.data : 0) ?? 0) });
}
