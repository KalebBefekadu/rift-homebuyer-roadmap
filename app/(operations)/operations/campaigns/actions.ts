"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { campaignFor, createCampaign, publish, saveRevision } from "@/lib/db/campaigns";
import { draftCampaign } from "@/lib/db/campaign-draft";
import { briefError } from "@/lib/core/campaign-draft";
import { assistanceRecipe, cleanRecipe, type PublicationAction } from "@/lib/core/campaign";

/**
 * Campaigns (Blueprint v5 §5.10; CAMP-01 to CAMP-03).
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 */

export async function newCampaign(input: { name: string; slug: string; county: string; requestId: string }) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };
  const r = await createCampaign({ name: input.name, slug: input.slug.trim().toLowerCase(), recipe: assistanceRecipe(input.county), by: agent.name, requestId: input.requestId });
  revalidatePath("/operations/campaigns");
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}

export async function saveCampaign(input: { id: string; recipe: unknown; expectedVersion: number; note: string | null; requestId: string }) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };
  const mine = await campaignFor(input.id);
  if (!mine.ok || !("data" in mine) || !mine.data) return { ok: false as const, error: "That campaign is not yours" };
  const r = await saveRevision(input.id, cleanRecipe(input.recipe), input.expectedVersion, input.note, agent.name, input.requestId);
  revalidatePath(`/operations/campaigns/${input.id}`);
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, version: r.data.version };
}

export async function draftCampaignRecipe(input: { id: string; brief: string }) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };
  const why = briefError(input.brief);
  if (why) return { ok: false as const, error: why };
  const mine = await campaignFor(input.id);
  if (!mine.ok || !("data" in mine) || !mine.data) return { ok: false as const, error: "That campaign is not yours" };
  const r = await draftCampaign(input.brief.slice(0, 600));
  return { ok: true as const, status: r.status, say: r.say, draft: r.draft };
}

export async function publishCampaign(input: { id: string; action: PublicationAction; version: number | null; requestId: string }) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };
  const r = await publish(input.id, input.action, input.version, agent.name, input.requestId);
  revalidatePath(`/operations/campaigns/${input.id}`);
  revalidatePath("/operations/campaigns");
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, live: r.data.live };
}
