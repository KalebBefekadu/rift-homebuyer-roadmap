"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { publishWording } from "@/lib/db/funnel";
import type { Wording } from "@/lib/core/funnel";

/**
 * Publishing the agent's own funnel wording.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../actions.ts.
 */

/**
 * The agent's own words, published as a new version.
 *
 * Wording only, and the server does not trust the client about that: it
 * rebuilds the questions from `lib/core/funnel.ts` and applies the words on
 * top. A payload claiming to change a question's type or what it is bound to
 * gets its title applied and everything else ignored.
 *
 * A new version rather than an edit in place, so that a lead captured last
 * Tuesday still points at the words that person actually read.
 */
export async function publishQuestions(
  side: "buy" | "sell", wording: Record<string, Wording>, note: string,
) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await publishWording(side, wording, agent.name || agent.email || "the agent", note);
  revalidatePath("/operations/questions");
  revalidatePath(`/${side}/start`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, version: r.data.version };
}
