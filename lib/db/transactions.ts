import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { shapeUpdates } from "./progress";
import { shapeRevision } from "./deadlines";
import { WORKSTREAMS, workstreamView, type Financing } from "@/lib/core/progress";
import { deadlineView, type DeadlineKind, type Revision } from "@/lib/core/deadline";
import { dealRow, sortDeals, type DealRow } from "@/lib/core/transactions";

/**
 * Every open contract across the agent's journeys, for the Transactions page
 * (Blueprint v5 §8.4). Read in one round per table, agent-wide and bounded,
 * rather than one journey at a time: the page is a glance across the book.
 *
 * A contract is open until it has an outcome. A deployment without the
 * contract tables answers `null`, which the page says, rather than an empty
 * list that would read as "nothing under contract".
 */

const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export async function openDeals(now = new Date()): Promise<DbResult<DealRow[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const [contracts, ended] = await Promise.all([
    boundedRead(db.from("rift_transactions").select("id,journey_id,home_id,financing,created_at").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(500), "the contracts"),
    boundedRead(db.from("rift_transaction_outcomes").select("transaction_id").eq("agent_id", agentId).limit(2000), "how contracts ended"),
  ]);
  for (const r of [contracts, ended]) if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const endedIds = new Set(rows(ended).map((x) => x.transaction_id as string));
  const open = rows(contracts).filter((c) => !endedIds.has(c.id as string));
  if (!open.length) return done([]);

  const ids = open.map((c) => c.id as string);
  const journeyIds = [...new Set(open.map((c) => c.journey_id as string))];
  const [updates, homes, journeys, dates, revisions] = await Promise.all([
    boundedRead(db.from("rift_workstream_updates").select("transaction_id,workstream,seq,state,owner,owner_name,source,confirmed_on,note,actor_kind,actor_label,created_at").eq("agent_id", agentId).in("transaction_id", ids).order("seq").limit(20000), "the contracts' progress"),
    boundedRead(db.from("rift_shortlist_homes").select("id,address").eq("agent_id", agentId).in("id", [...new Set(open.map((c) => c.home_id as string))]), "the homes"),
    boundedRead(db.from("rift_journeys").select("id,origin_lead_id").eq("agent_id", agentId).in("id", journeyIds), "the journeys"),
    boundedRead(db.from("rift_deadlines").select("id,transaction_id,label,kind,workstream").eq("agent_id", agentId).in("transaction_id", ids).limit(2000), "the contract dates"),
    boundedRead(db.from("rift_deadline_revisions")
      .select("deadline_id,seq,state,due_date,due_time,timezone,due_at,rule,trigger_label,trigger_date,days,source_term,source_page,source_document_id,amendment,verified,note,actor_label,created_at")
      .eq("agent_id", agentId).in("journey_id", journeyIds).order("seq").limit(10000), "the contract dates"),
  ]);
  for (const r of [updates, homes, journeys]) if (!r.ok) return r as DbResult<never>;
  /* Dates are their own migration. Without them the deals still show, with
     no dates rather than no deals. */
  const datesOk = dates.ok && revisions.ok;
  if (!datesOk && !journeyTablesMissing((!dates.ok ? dates.error : !revisions.ok ? revisions.error : ""))) {
    return (!dates.ok ? dates : revisions) as DbResult<never>;
  }

  const leadOf = new Map(rows(journeys).map((x) => [x.id as string, x.origin_lead_id as string]));
  const leads = leadOf.size
    ? await boundedRead(db.from("rift_leads").select("id,name,email").eq("agent_id", agentId).in("id", [...new Set(leadOf.values())]), "their names")
    : done([]);
  const nameOf = new Map(rows(leads).map((l) => [l.id as string, ((l.name as string | null) ?? "").trim() || (l.email as string | null) || "A client"]));
  const address = new Map(rows(homes).map((h) => [h.id as string, h.address as string]));
  const byStream = shapeUpdates(rows(updates));
  const revs = new Map<string, Revision[]>();
  for (const r of datesOk ? rows(revisions) : []) {
    const l = revs.get(r.deadline_id as string) ?? [];
    l.push(shapeRevision(r));
    revs.set(r.deadline_id as string, l);
  }

  return done(sortDeals(open.map((c) => {
    const id = c.id as string;
    const jid = c.journey_id as string;
    return dealRow({
      journeyId: jid,
      person: nameOf.get(leadOf.get(jid) ?? "") ?? "A client",
      address: address.get(c.home_id as string) ?? "A home",
      financing: c.financing as Financing,
      contractedAt: c.created_at as string,
      work: WORKSTREAMS.map((w) => workstreamView(w, byStream.get(`${id}:${w}`) ?? [], now)),
      dates: (datesOk ? rows(dates) : [])
        .filter((d) => d.transaction_id === id && revs.has(d.id as string))
        .map((d) => ({
          label: d.label as string,
          workstream: (d.workstream as string | null) ?? null,
          view: deadlineView(revs.get(d.id as string)!, d.kind as DeadlineKind, now),
        })),
    });
  })));
}
