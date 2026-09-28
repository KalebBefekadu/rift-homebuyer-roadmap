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
import { showDay } from "@/lib/core/day";

type Answer = { ok: boolean; text: string };

/**
 * A reviewer's answer to a flagged program page (Blueprint v5 §6.5).
 *
 * The session is checked here, not trusted from the page: a server action is
 * a public endpoint with a generated name. The reviewer's name comes from the
 * session, never from the form, so a review always names the person who made
 * it (handoff §4.13).
 *
 * Both return what happened, in words: they were bare form actions, and a
 * review or a batch of drafts that failed looked exactly like one that saved.
 */
export async function reviewProgramPage(input: { checkId: string; outcome: string; note: string }): Promise<Answer> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, text: "You are signed out. Nothing was recorded." };
  const checkId = String(input.checkId ?? "");
  const outcome = input.outcome === "needs-update" ? "needs-update" : "still-right";
  if (!isUuid(checkId)) return { ok: false, text: "Reload the page and try again. Nothing was recorded." };
  const r = await reviewCheck({ checkId, outcome, reviewedBy: agent.name, note: String(input.note ?? "") || null });
  /* A review that did not save leaves the program as it was: still shown, or
     still withheld. Saying nothing let "It needs updating: stop showing it"
     look done while buyers kept seeing the record. */
  if (!r.ok) return { ok: false, text: `Not recorded: ${r.error}. Buyers see the program exactly as before.` };
  if ("skipped" in r) return { ok: false, text: `Not recorded: ${r.reason}.` };
  revalidatePath("/operations/programs");
  revalidatePath("/operations");
  /* The public pages read the same records: a program withdrawn here must
     stop reaching buyers on the next request, not in an hour. */
  revalidatePath("/buy/programs");
  return { ok: true, text: outcome === "needs-update" ? "Recorded. Buyers no longer see it until its record is edited." : "Recorded. The program is renewed." };
}

/**
 * Drafts, one per person who asked about a changed program and may fit it
 * (D14 program alerts). Prepared only: each waits in the outbox for Kaleb's
 * approval (D04). A person who already has a draft or a sent message about
 * this program is skipped, so pressing twice prepares nothing twice.
 */
export async function prepareProgramAlerts(input: { checkId: string }): Promise<Answer> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, text: "You are signed out. Nothing was prepared." };
  const checkId = String(input.checkId ?? "");
  if (!isUuid(checkId)) return { ok: false, text: "Reload the page and try again. Nothing was prepared." };
  const [flags, subs, box] = await Promise.all([programFlags(), alertSubscribers(), outbox(agent.agentId, 500)]);
  if (!flags.ok) return { ok: false, text: `Nothing was prepared: ${flags.error}.` };
  if (!subs.ok) return { ok: false, text: `Nothing was prepared: ${subs.error}.` };
  if ("skipped" in flags) return { ok: false, text: `Nothing was prepared: ${flags.reason}.` };
  if ("skipped" in subs) return { ok: false, text: `Nothing was prepared: ${subs.reason}.` };
  const flag = flags.data?.find((f) => f.check.id === checkId) ?? null;
  if (!flag) return { ok: false, text: "That change is no longer waiting for review. Nothing was prepared." };
  /* Without the outbox read, "already has a draft" cannot be checked, and
     pressing again would prepare every message twice. */
  if (!box.ok || !("data" in box)) return { ok: false, text: `Nothing was prepared: the outbox could not be read (${box.ok ? box.reason : box.error}).` };
  const existing = box.data ?? [];
  const agentFirst = agent.name.trim().split(/\s+/)[0] || agent.name;
  /* The saved-plan link goes into an email. With no site address it would
     read "null/saved/…", so the line is left out rather than sent broken. */
  const origin = siteUrl();
  let made = 0;
  let had = 0;
  const failures: string[] = [];
  for (const p of flag.programs.filter((x) => x.status === "active")) {
    const change = flag.check.summary?.split("\n")[0] ?? `its official page changed on ${showDay(flag.check.checkedAt, { month: "long", day: "numeric", year: "numeric" })}. The record is being checked against it.`;
    for (const x of subs.data.filter((s) => s.email && mayFit(p, s.plan))) {
      const subject = `${p.name} has changed`;
      if (existing.some((e) => e.leadId === x.leadId && e.draft.subject === subject && e.state !== "cancelled")) { had++; continue; }
      const r = await prepare(agent.agentId, x.leadId, programAlertDraft({
        to: x.email!, name: x.name, program: p.name, change, sourceUrl: p.sourceUrl,
        planUrl: x.token && origin ? `${origin}/saved/${x.token}` : null, agentFirst,
      }), "Rift, for " + agent.name);
      if (r.ok && "data" in r) made++;
      else failures.push(`${x.name ?? x.email}: ${r.ok ? r.reason : r.error}`);
    }
  }
  revalidatePath("/operations/outbox");
  revalidatePath("/operations/programs");
  const said = [
    made ? `${made} prepared for your approval in the Outbox.` : "None prepared.",
    had ? `${had} already had one.` : "",
    failures.length ? `${failures.length} could not be prepared: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "; and more" : ""}.` : "",
  ].filter(Boolean).join(" ");
  return { ok: failures.length === 0, text: said };
}
