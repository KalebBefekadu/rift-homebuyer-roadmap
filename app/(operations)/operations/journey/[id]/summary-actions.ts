"use server";

import { currentAgent } from "@/lib/db/session";
import { createSummaryLink, revokeSummaryLink } from "@/lib/db/summary-links";
import { siteUrl } from "@/lib/core/site";
import { isUuid } from "@/lib/core/ids";

/**
 * Making and revoking read-only summary links (ACCESS-02). The session is
 * checked here; the link's address is returned to the page that asked, once,
 * and not stored or logged anywhere.
 *
 * Neither revalidates. These are server actions on the journey page, where a
 * page tree sent back with an action sometimes never finishes applying (why:
 * ../ops.ts), and the action's promise waits for it: the button sat on
 * "Making…" and the one-time address it would have shown was lost with a
 * live link already made. The page refreshes itself after the answer
 * (SummaryLinks.tsx).
 */
export async function makeSummaryLink(journeyId: string, label: string, scopes: string[], days: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, error: "Not signed in" };
  if (!isUuid(journeyId)) return { ok: false, error: "That journey is not right" };
  /* Checked before anything is made: without it the address read
     "null/summary/…", and a link nobody can open had been made anyway. */
  const origin = siteUrl();
  if (!origin) return { ok: false, error: "This deployment does not know its own address, so it cannot make a link. Nothing was made" };
  const r = await createSummaryLink({ journeyId, label, scopes, days, by: agent.name });
  if (!r.ok) return { ok: false, error: r.error };
  if ("skipped" in r) return { ok: false, error: r.reason };
  return { ok: true, url: `${origin}/summary/${r.data.token}` };
}

/** Its answer is returned: a turn-off that failed used to look exactly like one that worked, with the link still open. */
export async function revokeLink(journeyId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, error: "Not signed in. The link is still on." };
  if (!isUuid(journeyId) || !isUuid(id)) return { ok: false, error: "Reload the page and try again. The link is still on." };
  const r = await revokeSummaryLink(id, agent.name);
  if (!r.ok) return { ok: false, error: `The link is still on: ${r.error}` };
  if ("skipped" in r) return { ok: false, error: `The link is still on: ${r.reason}` };
  return { ok: true };
}
