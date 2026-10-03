"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { addLead, lookalikes, type NewLead } from "@/lib/db/clients";

/**
 * Putting somebody in by hand.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 */

export interface Same { id: string; name: string | null; email: string | null; phone: string | null; stage: string | null }

/**
 * Put somebody in by hand.
 *
 * Returns the id so the caller can go straight to their record. An agent who
 * has just typed in everything he knows about a client wants to be looking at
 * that client, not back at a list wondering whether it saved.
 *
 * Refuses, with who, when somebody with the same email or phone is already on
 * record, unless the agent has seen that and says to add anyway. A second
 * record splits the history, the plan and the follow-up between two people who
 * are one, and nothing afterwards will join them. If the check itself cannot
 * run, it does not block: a database blip is not a reason to stop somebody
 * writing down a client, and the form says it could not check.
 */
export async function createLead(input: NewLead, addAnyway = false) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  let unchecked = false;
  if (!addAnyway) {
    const same = await lookalikes(input.email, input.phone);
    if (same.ok && "data" in same && same.data.length) return { ok: false as const, same: same.data as Same[] };
    unchecked = !same.ok;
  }

  const r = await addLead(input);
  revalidatePath("/operations");
  revalidatePath("/operations/clients");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id, unchecked };
}
