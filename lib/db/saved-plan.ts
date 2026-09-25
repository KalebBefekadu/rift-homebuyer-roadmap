import "server-only";
import { randomBytes } from "node:crypto";
import { serviceClient } from "./service";
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
