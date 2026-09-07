"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentAgent } from "@/lib/db/session";
import { promoteItem } from "@/lib/db/review";
import { stop } from "@/lib/db/nurture";
import { markReplied } from "@/lib/db/leads";
import { addLead, addNote, setStage, archiveLead, type NewLead, type NoteKind, type Stage } from "@/lib/db/clients";
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

  const replied = await markReplied(leadId);
  /* A reply stops the sequence. Contract 4.11, and it is the same fact. */
  await stop(leadId, "replied");
  revalidatePath("/studio");

  if (!replied.ok) return { ok: false as const, error: replied.error };
  if ("skipped" in replied) return { ok: false as const, error: replied.reason };
  return { ok: true as const, repliedAt: replied.data.repliedAt };
}

export async function stopSequence(leadId: string, reason: StopId) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await stop(leadId, reason);
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
