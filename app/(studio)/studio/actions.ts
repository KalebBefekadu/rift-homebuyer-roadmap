"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { promoteItem } from "@/lib/db/review";
import { stop } from "@/lib/db/nurture";
import type { StopId } from "@/lib/core/nurture";

/**
 * Studio's write actions.
 *
 * Every one re-checks the session. A server action is a public HTTP endpoint
 * with a generated name — it is not protected by the page that renders the
 * button, and treating it as if it were is how an action ends up callable by
 * anybody who reads the network tab.
 */

export async function advanceReview(id: string, confirmedBy?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await promoteItem(id, confirmedBy);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, state: r.data.state };
}

export async function stopSequence(leadId: string, reason: StopId) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await stop(leadId, reason);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const };
}
