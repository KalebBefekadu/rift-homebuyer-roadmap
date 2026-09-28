"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { recordMood, recordMoment } from "@/lib/db/referral";
import type { Mood, MomentId, MomentState } from "@/lib/core/referral";

/**
 * The Advocacy moments: the private service check and what was decided about each moment.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 */

/**
 * Answer the private satisfaction check.
 *
 * The one write in this product that decides whether anything public may ever
 * be asked of a person, which is why it is its own action rather than a field
 * on a bigger form. Nothing here can set it to a default: the three answers
 * and `null` are the whole vocabulary, and `null` means nobody has asked.
 */
export async function setMood(leadId: string, mood: Mood) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await recordMood(leadId, mood);
  revalidatePath("/operations/referrals");
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * Record what was decided about one moment.
 *
 * `occurrence` is carried from the screen rather than recomputed here, so the
 * decision lands on the moment the agent was actually looking at. Recomputing
 * it would attach a decision taken on the second anniversary to whichever
 * anniversary the clock says it is by the time the action runs, which is the
 * same year in every case that matters and the wrong one on the day it is not.
 */
export async function decideMoment(
  leadId: string,
  momentId: MomentId,
  occurrence: number,
  state: MomentState,
  note?: string,
) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await recordMoment({ leadId, momentId, occurrence, state, note: note ?? null });
  revalidatePath("/operations/referrals");
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}
