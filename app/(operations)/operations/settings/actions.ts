"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { saveRule, clearRule } from "@/lib/db/settings";
import { agentProfile, saveAgentProfile } from "@/lib/db/profile";
import { askBrevoAboutSender } from "@/lib/db/sender";
import type { BusinessRules } from "@/lib/core/settings";
import { profileChanges, PROFILE_FIELDS, type ProfileField } from "@/lib/core/profile";
import type { SenderVerdict } from "@/lib/core/setup";

/**
 * Settings, written.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 *
 * Each revalidates the Operations layout, not just this page: the sidebar's
 * badge counts what is left to set up, and a decision made here should take
 * the number down on the next page, not the next deploy.
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
  revalidatePath("/operations", "layout");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function undecideRule(key: keyof BusinessRules) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await clearRule(agent.agentId, key);
  revalidatePath("/operations", "layout");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * The agent's details, changed.
 *
 * rift_agents is read-only to a session, deliberately (20260929100000), so
 * this goes through the service role, after the session check above makes it
 * the agent's own row. Only the five profile fields can move, and every
 * change is recorded with who made it (lib/db/profile.ts).
 *
 * Checked here against the value on record, so the answer can name the field
 * that stopped it and an untouched form writes no history.
 */
export async function saveProfile(submitted: Partial<Record<ProfileField, string>>) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const current = await agentProfile(agent.agentId);
  if (!current.ok) return { ok: false as const, error: current.error };
  if ("skipped" in current) return { ok: false as const, error: current.reason };

  /* Only our fields: a hand-made request carrying anything else is dropped
     here and refused again by the database. */
  const clean = Object.fromEntries(PROFILE_FIELDS.filter((f) => f in submitted).map((f) => [f, submitted[f]]));
  const diff = profileChanges(current.data, clean);
  if (!diff.ok) return { ok: false as const, error: diff.error, field: diff.field };

  const r = await saveAgentProfile(agent.agentId, diff.changes, agent.name || agent.email || "the agent");
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };

  revalidatePath("/operations", "layout");
  return { ok: true as const, changed: r.data.changed };
}

/**
 * Ask Brevo whether it will send from the configured address.
 *
 * On a button, never on page load: each call from a new serverless address
 * can make Brevo email the account owner a security alert (lib/db/sender.ts).
 */
export async function checkEmailSender(): Promise<{ ok: true; verdict: SenderVerdict | null } | { ok: false; error: string }> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, error: "not signed in" };
  const verdict = await askBrevoAboutSender();
  revalidatePath("/operations/settings");
  return { ok: true, verdict };
}
