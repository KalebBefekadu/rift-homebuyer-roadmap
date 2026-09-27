"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { reviewCheck } from "@/lib/db/program-checks";

/**
 * A reviewer's answer to a flagged program page (Blueprint v5 §6.5).
 *
 * The session is checked here, not trusted from the page: a server action is
 * a public endpoint with a generated name. The reviewer's name comes from the
 * session, never from the form, so a review always names the person who made
 * it (handoff §4.13).
 */
export async function reviewProgramPage(form: FormData) {
  const agent = await currentAgent();
  if (!agent) return;
  const checkId = String(form.get("checkId") ?? "");
  const outcome = form.get("outcome") === "needs-update" ? "needs-update" : "still-right";
  if (!/^[0-9a-f-]{36}$/i.test(checkId)) return;
  await reviewCheck({ checkId, outcome, reviewedBy: agent.name, note: String(form.get("note") ?? "") || null });
  revalidatePath("/operations/programs");
  revalidatePath("/operations");
  /* The public pages read the same records: a program withdrawn here must
     stop reaching buyers on the next request, not in an hour. */
  revalidatePath("/buy/programs");
}
