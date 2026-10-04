"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { recordOfferAnswer } from "@/lib/db/offer-answers";

/**
 * Record whether an offer that came in through the form has been answered,
 * and by when the sender needs one.
 *
 * Re-checks the session: a server action is a public HTTP endpoint, not
 * protected by the page that renders its button. The write itself checks the
 * offer is this agent's.
 */
export async function setOfferAnswer(offerId: string, answered: boolean, respondBy: string | null) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await recordOfferAnswer({ offerId, answered, respondBy: respondBy || null, actor: agent.name || agent.email || "the agent" });
  revalidatePath("/operations/offers");
  revalidatePath("/operations", "layout");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}
