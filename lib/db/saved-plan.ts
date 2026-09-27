import "server-only";
import { randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead, boundedWrite } from "./bounded";
import type { SavedPlan } from "@/lib/core/saved-plan";

/**
 * "Save my plan" (Blueprint v5 §5.5): the plan is stored on the lead the save
 * created, with a private link token. The token is the credential for the
 * page that reopens it, so it is long, random and never listed anywhere.
 */

export const newPlanToken = () => randomBytes(24).toString("base64url");

export async function attachPlan(leadId: string, plan: SavedPlan): Promise<DbResult<{ token: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const token = newPlanToken();
  const w = await boundedWrite(
    db.from("rift_leads")
      .update({ plan: plan as never, plan_token: token, plan_saved_at: new Date().toISOString() })
      .eq("id", leadId)
      .select("id"),
    "saving the plan",
  );
  if (!w.ok) return w;
  if (!("data" in w) || !Array.isArray(w.data) || !w.data.length) return failed("the lead for this plan was not found");
  return done({ token });
}

export interface OpenedPlan {
  name: string | null;
  plan: SavedPlan;
  savedAt: string;
}

export async function readSavedPlan(token: string): Promise<DbResult<OpenedPlan | null>> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return done(null);
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_leads").select("name, plan, plan_saved_at").eq("plan_token", token).maybeSingle(),
    "opening the plan",
  );
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as { name: string | null; plan: SavedPlan | null; plan_saved_at: string | null } | null;
  if (!row || !row.plan) return done(null);
  return done({ name: row.name, plan: row.plan, savedAt: row.plan_saved_at ?? "" });
}

/**
 * The plan a lead saved, for the agent (Blueprint v5 §5.5: "each lead shows
 * what they did"). Scoped to the signed-in agent; a failed read is a failure,
 * never "they saved nothing".
 */
export async function savedPlanFor(leadId: string): Promise<DbResult<{ plan: SavedPlan; savedAt: string } | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const r = await boundedRead(
    db.from("rift_leads").select("plan, plan_saved_at").eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "their saved plan",
  );
  /* Before migration 20260926010000 there is no plan to read. */
  if (!r.ok) return /plan/.test(r.error) ? done(null) : r;
  const row = ("data" in r ? r.data : null) as { plan: SavedPlan | null; plan_saved_at: string | null } | null;
  if (!row?.plan || !row.plan_saved_at) return done(null);
  return done({ plan: row.plan, savedAt: row.plan_saved_at });
}

/**
 * Leads who asked to hear about program changes (D14), with the answers to
 * check a program against. Read for the agent, who writes to them (D04).
 */
export async function alertSubscribers(): Promise<DbResult<{ leadId: string; name: string | null; plan: SavedPlan }[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const r = await boundedRead(
    db.from("rift_leads").select("id, name, plan").eq("agent_id", agentId).eq("plan->>alerts", "true").limit(500),
    "who asked for program alerts",
  );
  if (!r.ok) return /plan/.test(r.error) ? done([]) : r;
  const rows = ("data" in r ? r.data : []) as { id: string; name: string | null; plan: SavedPlan }[];
  return done(rows.filter((x) => x.plan).map((x) => ({ leadId: x.id, name: x.name, plan: x.plan })));
}
