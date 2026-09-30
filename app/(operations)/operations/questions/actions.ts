"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { publishQuestions } from "@/lib/db/questions";
import { cleanWording } from "@/lib/core/question-wording";

/**
 * Publishing the values' question wording (D37).
 *
 * Re-checks the session: a server action is a public HTTP endpoint, not
 * protected by the page that renders its button. The wording is rebuilt by
 * `cleanWording` from whatever arrived, so only words can be published,
 * never a type, a choice value or a compute input.
 */
export async function publishWording(input: { wording: unknown; expectedVersion: number; note: string | null; requestId: string }) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "Your session has ended. Sign in again; nothing was published" };
  const r = await publishQuestions({
    wording: cleanWording(input.wording),
    expectedVersion: Number.isInteger(input.expectedVersion) ? input.expectedVersion : -1,
    note: typeof input.note === "string" ? input.note : null,
    by: agent.name,
    requestId: input.requestId,
  });
  revalidatePath("/operations/questions");
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: `Nothing was published: ${r.reason}` };
  return { ok: true as const, version: r.data.version };
}
