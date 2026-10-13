import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedReport } from "./bounded";
import { allContracts } from "./transactions";
import { rulesOrDefaults } from "./settings";
import { tellHousehold } from "./notices";
import { datesToRemind } from "@/lib/core/notice";

/**
 * Remind a household of a checked contract date of theirs, two days out or
 * less (audit portals-2026-10, decision 4). Run every morning by the
 * follow-up emails job, and does nothing unless Kaleb has turned the
 * business rule clientDateReminders on. Each date is said once per person
 * (rift_client_notices.about); the email names no date.
 *
 * Best effort, like every notice: a reminder that does not go is recorded,
 * and never fails the job that called it.
 */
export async function remindDates(now: Date, opts: { dry?: boolean } = {}): Promise<{ on: boolean; dates: number; told: number; reason?: string }> {
  const agentId = await currentAgentId();
  if (!agentId) return { on: false, dates: 0, told: 0, reason: "no agent row exists yet" };
  const { rules } = await rulesOrDefaults(agentId);
  if (!rules.clientDateReminders.value) return { on: false, dates: 0, told: 0, reason: "switched off in Settings" };

  const contracts = await allContracts(now);
  if (!contracts.ok || !("data" in contracts) || !contracts.data) {
    return { on: true, dates: 0, told: 0, reason: contracts.ok ? "no contracts" : contracts.error };
  }
  const due = datesToRemind(contracts.data);
  if (opts.dry || !due.length) return { on: true, dates: due.length, told: 0 };

  const db = serviceClient();
  const agent = db
    ? await boundedReport(db.from("rift_agents").select("name").eq("id", agentId).maybeSingle(), "the agent")
    : null;
  const name = (agent && agent.ok && "data" in agent ? (agent.data as { name: string | null } | null)?.name : null) ?? "Your agent";
  let told = 0;
  for (const d of due) told += (await tellHousehold(d.journeyId, "date", name, undefined, d.deadlineId)).told;
  return { on: true, dates: due.length, told };
}
