"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentAgent } from "@/lib/db/session";
import { promoteItem } from "@/lib/db/review";
import { stop } from "@/lib/db/nurture";
import { markReplied } from "@/lib/db/leads";
import { addLead, addNote, setStage, archiveLead, setNextAction, type NewLead, type NoteKind, type Stage } from "@/lib/db/clients";
import type { StopId } from "@/lib/core/nurture";
import { saveRule, clearRule } from "@/lib/db/settings";
import type { BusinessRules } from "@/lib/core/settings";

/**
 * Studio's write actions.
 *
 * Every one re-checks the session. A server action is a public HTTP endpoint
 * with a generated name — it is not protected by the page that renders the
 * button, and treating it as if it were is how an action ends up callable by
 * anybody who reads the network tab.
 *
 * And every one passes `agent.agentId` down to the write. "Somebody is signed
 * in" and "this record is theirs" are different questions, and three of these
 * used to ask only the first: the data layer runs on the service-role client,
 * which bypasses RLS, so the policies that would have caught a cross-agent
 * write are never consulted and a bare id is authority. One agent exists
 * today, which is exactly why this was cheap to fix now.
 */

export async function advanceReview(id: string, confirmedBy?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await promoteItem(id, agent.agentId, confirmedBy);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, state: r.data.state };
}

/**
 * "I have replied to this."
 *
 * Stops the clock and stops the sequence in one action, because they are the
 * same event from the agent's side — and asking him to do two things after one
 * conversation is how the second one stops happening.
 */
export async function markRepliedTo(leadId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const replied = await markReplied(leadId, agent.agentId);
  /* A reply stops the sequence. Contract 4.11, and it is the same fact. */
  await stop(leadId, "replied", agent.agentId);
  revalidatePath("/studio");

  if (!replied.ok) return { ok: false as const, error: replied.error };
  if ("skipped" in replied) return { ok: false as const, error: replied.reason };
  return { ok: true as const, repliedAt: replied.data.repliedAt };
}

export async function stopSequence(leadId: string, reason: StopId) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await stop(leadId, reason, agent.agentId);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const };
}


/**
 * Signs out.
 *
 * Studio lists strangers' finances, and the agent works from a laptop that
 * leaves the house. Being able to end a session is not a courtesy on a surface
 * like this — and a product that can be signed into and not out of is one
 * people stay signed into on shared machines.
 */
export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/studio/sign-in");
}

/* ------------------------------------------------------------------ *
 * Managing people who never took an assessment
 * ------------------------------------------------------------------ */

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
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}

export async function logContact(leadId: string, kind: NoteKind, body: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await addNote(leadId, kind, body);
  revalidatePath(`/studio/lead/${leadId}`);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function moveStage(leadId: string, stage: Stage, why?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setStage(leadId, stage, why);
  revalidatePath(`/studio/lead/${leadId}`);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, stage: r.data.stage };
}

export async function archive(leadId: string, reason: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await archiveLead(leadId, reason);
  revalidatePath(`/studio/lead/${leadId}`);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function planNextAction(leadId: string, action: string | null, due: string | null, completedNote?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setNextAction(leadId, action, due, completedNote);
  revalidatePath(`/studio/lead/${leadId}`);
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, cleared: r.data.cleared };
}

/**
 * One business rule, decided.
 *
 * These were in localStorage, on one device, readable by nothing the server
 * computes. `commissionPct` is the only number in the product that turns
 * pipeline into money and it ran on a default Kaleb could not see.
 *
 * The decider's name is recorded with the value. Two of the six are not his
 * to decide alone — client retention has a legal floor the broker sets, and
 * marketing to an unrepresented counterparty is a conflict question — and a
 * settings table that cannot distinguish "the broker confirmed this" from
 * "nobody has ever touched it" converts a default into a policy in silence.
 */
export async function decideRule<K extends keyof BusinessRules>(
  key: K, value: BusinessRules[K]["value"],
) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await saveRule(agent.agentId, key, value, agent.name || agent.email || "the agent");
  revalidatePath("/studio/settings");
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/** Back to the default, and visibly undecided again. */
export async function undecideRule(key: keyof BusinessRules) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await clearRule(agent.agentId, key);
  revalidatePath("/studio/settings");
  revalidatePath("/studio");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}
