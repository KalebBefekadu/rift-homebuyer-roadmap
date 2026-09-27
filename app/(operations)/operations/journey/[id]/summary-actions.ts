"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { createSummaryLink, revokeSummaryLink } from "@/lib/db/summary-links";
import { siteUrl } from "@/lib/core/site";

/**
 * Making and revoking read-only summary links (ACCESS-02). The session is
 * checked here; the link's address is returned to the page that asked, once,
 * and not stored or logged anywhere.
 */
export async function makeSummaryLink(journeyId: string, label: string, scopes: string[], days: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, error: "Not signed in" };
  if (!/^[0-9a-f-]{36}$/i.test(journeyId)) return { ok: false, error: "That journey is not right" };
  const r = await createSummaryLink({ journeyId, label, scopes, days, by: agent.name });
  if (!r.ok) return { ok: false, error: r.error };
  if ("skipped" in r) return { ok: false, error: r.reason };
  revalidatePath(`/operations/journey/${journeyId}`);
  return { ok: true, url: `${siteUrl()}/summary/${r.data.token}` };
}

export async function revokeLink(journeyId: string, id: string): Promise<void> {
  const agent = await currentAgent();
  if (!agent || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await revokeSummaryLink(id, agent.name);
  revalidatePath(`/operations/journey/${journeyId}`);
}
