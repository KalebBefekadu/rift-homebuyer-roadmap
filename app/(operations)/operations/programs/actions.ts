"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { reviewCheck, programFlags } from "@/lib/db/program-checks";
import { alertSubscribers } from "@/lib/db/saved-plan";
import { outbox, prepare } from "@/lib/db/outbox";
import { programAlertDraft } from "@/lib/core/outbox";
import { mayFit } from "@/lib/core/alerts";
import { siteUrl } from "@/lib/core/site";
import { isUuid } from "@/lib/core/ids";

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
  if (!isUuid(checkId)) return;
  await reviewCheck({ checkId, outcome, reviewedBy: agent.name, note: String(form.get("note") ?? "") || null });
  revalidatePath("/operations/programs");
  revalidatePath("/operations");
  /* The public pages read the same records: a program withdrawn here must
     stop reaching buyers on the next request, not in an hour. */
  revalidatePath("/buy/programs");
}

/**
 * Drafts, one per person who asked about a changed program and may fit it
 * (D14 program alerts). Prepared only: each waits in the outbox for Kaleb's
 * approval (D04). A person who already has a draft or a sent message about
 * this program is skipped, so pressing twice prepares nothing twice.
 */
export async function prepareProgramAlerts(form: FormData) {
  const agent = await currentAgent();
  if (!agent) return;
  const checkId = String(form.get("checkId") ?? "");
  const [flags, subs, box] = await Promise.all([programFlags(), alertSubscribers(), outbox(agent.agentId, 500)]);
  const flag = flags.ok && "data" in flags ? flags.data?.find((f) => f.check.id === checkId) : null;
  if (!flag || !subs.ok || !("data" in subs)) return;
  const existing = box.ok && "data" in box && box.data ? box.data : [];
  const agentFirst = agent.name.trim().split(/\s+/)[0] || agent.name;
  for (const p of flag.programs.filter((x) => x.status === "active")) {
    const change = flag.check.summary?.split("\n")[0] ?? `its official page changed on ${flag.check.checkedAt.slice(0, 10)}. The record is being checked against it.`;
    for (const x of subs.data.filter((s) => s.email && mayFit(p, s.plan))) {
      const subject = `${p.name} has changed`;
      if (existing.some((e) => e.leadId === x.leadId && e.draft.subject === subject && e.state !== "cancelled")) continue;
      await prepare(agent.agentId, x.leadId, programAlertDraft({
        to: x.email!, name: x.name, program: p.name, change, sourceUrl: p.sourceUrl,
        planUrl: x.token ? `${siteUrl()}/saved/${x.token}` : null, agentFirst,
      }), "Rift, for " + agent.name);
    }
  }
  revalidatePath("/operations/outbox");
  revalidatePath("/operations/programs");
}
