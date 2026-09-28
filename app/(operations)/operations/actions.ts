"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentAgent } from "@/lib/db/session";
import { promoteItem } from "@/lib/db/review";
import { stop } from "@/lib/db/nurture";
import { markReplied } from "@/lib/db/leads";
import { roster } from "@/lib/db/clients";
import type { StopId } from "@/lib/core/nurture";
import { journeysMatching } from "@/lib/db/journeys";
import { recordMark } from "@/lib/db/desk";
import type { MarkKind } from "@/lib/core/desk";

/**
 * Operations' shared write actions: Today, its rows and the frame (sign out,
 * the quick switcher). A page's own actions live beside it, in its folder's
 * actions.ts (campaigns, lead/[id], referrals, settings, questions, add,
 * outbox, programs), so a page and what it writes are read together.
 *
 * Every one re-checks the session. A server action is a public HTTP endpoint
 * with a generated name: it is not protected by the page that renders the
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
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, state: r.data.state };
}

/**
 * "I have replied to this."
 *
 * Stops the clock and stops the sequence in one action, because they are the
 * same event from the agent's side, and asking him to do two things after one
 * conversation is how the second one stops happening.
 */
export async function markRepliedTo(leadId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  /* A reply stops the sequence. Contract 4.11, and it is the same fact.

     Stopped first, and its answer read. It used to run second with its
     result dropped, so a stop that failed reported success while the next
     scheduled email stayed queued: the one outcome the contract exists to
     prevent. And Today drops a lead once it is replied to or stopped, so an
     error returned after the page refreshes lands on a row that is no longer
     there. A failure therefore returns before anything is refreshed: the row
     stays, says what did not happen, and pressing again is safe (both
     writes do nothing the second time). */
  const stopped = await stop(leadId, "replied", agent.agentId);
  if (!stopped.ok || "skipped" in stopped) {
    return {
      ok: false as const,
      error: `Nothing was recorded: the follow-up sequence could not be stopped (${stopped.ok ? stopped.reason : stopped.error}). Try again.`,
    };
  }
  const replied = await markReplied(leadId, agent.agentId);
  if (!replied.ok || "skipped" in replied) {
    return {
      ok: false as const,
      error: `The sequence is stopped, but your reply time was not recorded (${replied.ok ? replied.reason : replied.error}). Try again.`,
    };
  }
  revalidatePath("/operations");
  return { ok: true as const, repliedAt: replied.data.repliedAt };
}

export async function stopSequence(leadId: string, reason: StopId) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await stop(leadId, reason, agent.agentId);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  /* With no database nothing was stopped, and saying so is the difference
     between a paused sequence and a button that only closed its menu. */
  if ("skipped" in r) return { ok: false as const, error: `The sequence was not stopped: ${r.reason}` };
  return { ok: true as const };
}

/**
 * Signs out.
 *
 * Studio lists strangers' finances, and the agent works from a laptop that
 * leaves the house. Being able to end a session is not a courtesy on a surface
 * like this, and a product that can be signed into and not out of is one
 * people stay signed into on shared machines.
 */
export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/operations/sign-in");
}

export interface Jump { label: string; hint: string; href: string }

/**
 * People and journeys matching what was typed, for Cmd+K. Pages are matched
 * in the browser; only records need the database. Two characters at least,
 * because one matches half the book and tells him nothing.
 */
export async function jumpTo(q: string): Promise<Jump[]> {
  const agent = await currentAgent();
  if (!agent) return [];
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const [people, journeys] = await Promise.all([roster({ q: term, limit: 6 }), journeysMatching(term)]);
  const out: Jump[] = [];
  for (const p of people.ok && "data" in people ? people.data.people : []) {
    out.push({
      label: p.name ?? p.email ?? "Unnamed",
      hint: `${p.side === "buy" ? "Buyer" : "Seller"}${p.stage ? ` · ${p.stage}` : " · not picked up"}`,
      href: `/operations/lead/${p.id}`,
    });
  }
  for (const j of journeys.ok && "data" in journeys ? journeys.data : []) {
    out.push({ label: j.label, hint: `Journey · ${j.person}`, href: `/operations/journey/${j.id}` });
  }
  return out.slice(0, 10);
}

export async function markItem(input: {
  key: string; kind: MarkKind; until?: string | null; person?: string | null; reason?: string | null; requestId: string;
}) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };
  const r = await recordMark(agent.agentId, { ...input, by: agent.name });
  revalidatePath("/operations");
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}
