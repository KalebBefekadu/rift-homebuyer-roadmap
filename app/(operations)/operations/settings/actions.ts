"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { saveRule, clearRule } from "@/lib/db/settings";
import type { BusinessRules } from "@/lib/core/settings";

/**
 * Deciding the business rules.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 */

/**
 * One business rule, decided.
 *
 * These were in localStorage, on one device, readable by nothing the server
 * computes. `commissionPct` is the only number in the product that turns
 * pipeline into money and it ran on a default Kaleb could not see.
 *
 * The decider's name is recorded with the value. Two of the six are not his
 * to decide alone: client retention has a legal floor the broker sets, and
 * marketing to an unrepresented counterparty is a conflict question, and a
 * settings table that cannot distinguish "the broker confirmed this" from
 * "nobody has ever touched it" converts a default into a policy in silence.
 */
export async function decideRule<K extends keyof BusinessRules>(
  key: K, value: BusinessRules[K]["value"],
) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await saveRule(agent.agentId, key, value, agent.name || agent.email || "the agent");
  revalidatePath("/operations/settings");
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function undecideRule(key: keyof BusinessRules) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await clearRule(agent.agentId, key);
  revalidatePath("/operations/settings");
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}
