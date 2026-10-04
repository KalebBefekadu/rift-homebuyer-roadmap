import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { dependencyError, eventError, stateOf, type Dependency, type DependencyEvent, type DependencyKind } from "@/lib/core/dependency";
import { isUuid } from "@/lib/core/ids";

/**
 * The only reader and writer of rift_dependencies and their events
 * (STATE-07). Rules: lib/core/dependency.ts. Writing one moves nothing.
 */

const MISSING = /rift_dependenc|does not exist|schema cache/;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

/** Dependencies touching a journey, on either side; or every one when no journey is given. Null before the tables exist. */
export async function dependenciesFor(journeyId: string | null, agentIdIn?: string): Promise<DbResult<Dependency[] | null>> {
  /* The id goes into a PostgREST filter string, so it must be only an id. */
  if (journeyId !== null && !isUuid(journeyId)) return done([]);
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = agentIdIn ?? await currentAgentId();
  if (!agentId) return skipped("not signed in");
  let q = db.from("rift_dependencies").select("id,sale_journey_id,purchase_journey_id,kind,note,owner,actor_label,created_at").eq("agent_id", agentId);
  if (journeyId) q = q.or(`sale_journey_id.eq.${journeyId},purchase_journey_id.eq.${journeyId}`);
  const d = await boundedReport(q.order("created_at").limit(200), "the linked journeys");
  if (!d.ok) return MISSING.test(d.error) ? done(null) : d;
  const list = rows(d);
  if (!list.length) return done([]);
  const ids = list.map((x) => x.id as string);
  const journeyIds = [...new Set(list.flatMap((x) => [x.sale_journey_id as string, x.purchase_journey_id as string]))];
  const [ev, js] = await Promise.all([
    boundedReport(db.from("rift_dependency_events").select("dependency_id,state,evidence,actor_label,created_at").eq("agent_id", agentId).in("dependency_id", ids).order("created_at").limit(1000), "what happened to them"),
    boundedReport(db.from("rift_journeys").select("id,label").eq("agent_id", agentId).in("id", journeyIds), "their journeys"),
  ]);
  if (!ev.ok) return ev;
  if (!js.ok) return js;
  const label = new Map(rows(js).map((j) => [j.id as string, j.label as string]));
  const events = new Map<string, DependencyEvent[]>();
  for (const e of rows(ev)) {
    const l = events.get(e.dependency_id as string) ?? [];
    l.push({ state: e.state as DependencyEvent["state"], evidence: e.evidence as string, by: e.actor_label as string, at: e.created_at as string });
    events.set(e.dependency_id as string, l);
  }
  return done(list.map((x) => ({
    id: x.id as string, saleJourneyId: x.sale_journey_id as string, purchaseJourneyId: x.purchase_journey_id as string,
    saleLabel: label.get(x.sale_journey_id as string) ?? "A sale", purchaseLabel: label.get(x.purchase_journey_id as string) ?? "A purchase",
    kind: x.kind as DependencyKind, note: x.note as string, owner: x.owner as string, by: x.actor_label as string, at: x.created_at as string,
    events: events.get(x.id as string) ?? [],
  })));
}

export async function recordDependency(input: {
  saleJourneyId: string; purchaseJourneyId: string; kind: string; note: string; owner: string; by: string; requestId: string;
}): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const bad = dependencyError(input);
  if (bad) return failed(bad);
  const w = await boundedWrite(db.from("rift_dependencies").insert({
    agent_id: agentId, sale_journey_id: input.saleJourneyId, purchase_journey_id: input.purchaseJourneyId, kind: input.kind,
    note: input.note.trim(), owner: input.owner.trim(), actor_label: input.by.slice(0, 120), request_id: input.requestId,
  }).select("id").single(), "the link");
  if (!w.ok) {
    if (/rift_dependencies_request|duplicate key/.test(w.error)) return failed("Already recorded. Reload the page.");
    if (/selling journeys/.test(w.error)) return failed("Link one of your selling journeys to one of your buying journeys");
    return MISSING.test(w.error) ? failed("Linked journeys need migration 20260928020000") : w;
  }
  return done({ id: (("data" in w ? w.data : null) as { id: string }).id });
}

export async function recordDependencyEvent(input: { dependencyId: string; state: DependencyEvent["state"]; evidence: string; by: string; requestId: string }): Promise<DbResult<{ state: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const cur = await dependenciesFor(null, agentId);
  if (!cur.ok || !("data" in cur)) return cur as DbResult<never>;
  const dep = (cur.data ?? []).find((d) => d.id === input.dependencyId);
  if (!dep) return failed("That link is not yours");
  const bad = eventError(stateOf(dep), input.state, input.evidence);
  if (bad) return failed(bad);
  const w = await boundedWrite(db.from("rift_dependency_events").insert({
    agent_id: agentId, dependency_id: input.dependencyId, state: input.state, evidence: input.evidence.trim(),
    actor_label: input.by.slice(0, 120), request_id: input.requestId,
  }), "what happened");
  if (!w.ok) return /duplicate key/.test(w.error) ? done({ state: input.state }) : w;
  return done({ state: input.state });
}
