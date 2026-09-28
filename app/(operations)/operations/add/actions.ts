"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { addLead, type NewLead } from "@/lib/db/clients";

/**
 * Putting somebody in by hand.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 */

/**
 * Put somebody in by hand.
 *
 * Returns the id so the caller can go straight to their record. An agent who
 * has just typed in everything he knows about a client wants to be looking at
 * that client, not back at a list wondering whether it saved.
 */
export async function createLead(input: NewLead) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await addLead(input);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}
