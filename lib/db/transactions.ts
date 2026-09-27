import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { shapeEvents, shapeUpdates } from "./progress";
import { REVISION_COLUMNS, shapeRevision } from "./revisions";
import { WORKSTREAMS, progressOf, workstreamView, type ContractOutcome, type Financing } from "@/lib/core/progress";
import { deadlineView, type DeadlineKind, type Revision } from "@/lib/core/deadline";
import type { Workstream } from "@/lib/core/progress";
import type { ContractSummary } from "@/lib/core/transactions";

/**
 * Every contract the agent has recorded, across journeys, in one read
 * (Blueprint v5 §8.7). The rules are lib/core/transactions.ts.
 *
 * A bounded number of queries whatever the size of the book: contracts, how
 * they ended, their workstream updates, their dates and revisions, then the
 * homes, journeys, histories and names they belong to. Null means the tables
 * are not there yet, which is not the same as having no contracts.
 */

const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export async function allContracts(now = new Date()): Promise<DbResult<ContractSummary[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const [contracts, outcomes, updates, deadlines, revisions] = await Promise.all([
    boundedRead(db.from("rift_transactions").select("id,journey_id,home_id,financing,created_at").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(300), "the contracts"),
    boundedRead(db.from("rift_transaction_outcomes").select("transaction_id,outcome,created_at").eq("agent_id", agentId).limit(300), "how contracts ended"),
    boundedRead(db.from("rift_workstream_updates").select("transaction_id,workstream,seq,state,owner,owner_name,source,confirmed_on,note,actor_kind,actor_label,created_at").eq("agent_id", agentId).order("seq").limit(8000), "the contracts' progress"),
    boundedRead(db.from("rift_deadlines").select("id,transaction_id,label,kind,workstream").eq("agent_id", agentId).limit(2000), "the contract dates"),
    boundedRead(db.from("rift_deadline_revisions").select(REVISION_COLUMNS).eq("agent_id", agentId).order("seq").limit(8000), "the contract dates"),
  ]);
  for (const r of [contracts, outcomes, updates, deadlines, revisions]) if (!r.ok) return journeyTablesMissing(r.error) ? done(null) : r;
  const list = rows(contracts);
  if (!list.length) return done([]);

  const journeyIds = [...new Set(list.map((c) => c.journey_id as string))];
  const homeIds = [...new Set(list.map((c) => c.home_id as string))];
  const [journeys, homes, events] = await Promise.all([
    boundedRead(db.from("rift_journeys").select("id,label,origin_lead_id").eq("agent_id", agentId).in("id", journeyIds), "the journeys"),
    boundedRead(db.from("rift_shortlist_homes").select("id,address").eq("agent_id", agentId).in("id", homeIds), "the homes"),
    boundedRead(db.from("rift_journey_events").select("journey_id,seq,kind,from_value,to_value,reason,evidence,transaction_id,actor_label,created_at").eq("agent_id", agentId).in("journey_id", journeyIds).order("seq").limit(4000), "the journeys' history"),
  ]);
  for (const r of [journeys, homes, events]) if (!r.ok) return r;
  const leadIds = [...new Set(rows(journeys).map((j) => j.origin_lead_id as string))];
  const leads = await boundedRead(db.from("rift_leads").select("id,name,email").eq("agent_id", agentId).in("id", leadIds), "the people");
  if (!leads.ok) return leads;

  const journeyOf = new Map(rows(journeys).map((j) => [j.id as string, j]));
  const nameOf = new Map(rows(leads).map((l) => [l.id as string, ((l.name as string | null) ?? "").trim() || (l.email as string | null) || "A client"]));
  const addressOf = new Map(rows(homes).map((h) => [h.id as string, h.address as string]));
  const endedOf = new Map(rows(outcomes).map((o) => [o.transaction_id as string, { outcome: o.outcome as ContractOutcome, at: o.created_at as string }]));
  const byStream = shapeUpdates(rows(updates));
  const eventsOf = new Map<string, Record<string, unknown>[]>();
  for (const e of rows(events)) {
    const l = eventsOf.get(e.journey_id as string) ?? [];
    l.push(e);
    eventsOf.set(e.journey_id as string, l);
  }
  const revsOf = new Map<string, Revision[]>();
  for (const r of rows(revisions)) {
    const l = revsOf.get(r.deadline_id as string) ?? [];
    l.push(shapeRevision(r));
    revsOf.set(r.deadline_id as string, l);
  }
  const datesOf = new Map<string, ContractSummary["dates"]>();
  for (const d of rows(deadlines)) {
    const revs = revsOf.get(d.id as string);
    if (!revs?.length) continue;
    const l = datesOf.get(d.transaction_id as string) ?? [];
    l.push({ id: d.id as string, label: d.label as string, kind: d.kind as DeadlineKind, workstream: (d.workstream as Workstream | null) ?? null, view: deadlineView(revs, d.kind as DeadlineKind, now) });
    datesOf.set(d.transaction_id as string, l);
  }

  return done(list.map((c) => {
    const id = c.id as string;
    const j = journeyOf.get(c.journey_id as string);
    const leadId = (j?.origin_lead_id as string | undefined) ?? "";
    return {
      id,
      journeyId: c.journey_id as string,
      journeyLabel: (j?.label as string | undefined) ?? "",
      leadId,
      person: nameOf.get(leadId) ?? "A client",
      address: addressOf.get(c.home_id as string) ?? "A home",
      financing: c.financing as Financing,
      stage: progressOf(shapeEvents(eventsOf.get(c.journey_id as string) ?? [])).stage,
      recordedAt: c.created_at as string,
      outcome: endedOf.get(id) ?? null,
      work: WORKSTREAMS.map((w) => workstreamView(w, byStream.get(`${id}:${w}`) ?? [], now)),
      dates: (datesOf.get(id) ?? []).sort((a, b) => a.view.current.dueDate.localeCompare(b.view.current.dueDate)),
    };
  }));
}
