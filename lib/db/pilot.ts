import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { shapeEvents } from "./progress";
import { jobsHealth } from "./jobs";
import { progressOf, type JourneyStatus, type Stage } from "@/lib/core/progress";
import {
  asksFrom, checkError, checkState,
  type Ask, type Check, type Checkable, type CheckResult, type CheckState, type PilotRows, type SetupRow,
} from "@/lib/core/pilot";

/**
 * The pilot report and its checks (W12; lib/core/pilot.ts has the rules).
 * The only writer of rift_reconciliations.
 *
 * Reads the whole buying book at once, scoped to the agent and bounded: a
 * pilot of three to five buyers (D07) is far inside every limit here, and a
 * limit reached is said on the page rather than counted as the whole.
 */

type Row = Record<string, unknown>;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? ((r.data as Row[] | null) ?? []) : []);
const NOT_YET = "Pilot checks need a database update that has not been applied yet (migration 20260925010000).";
const LIMIT = 5000;

export interface PilotJourney {
  id: string;
  person: string;
  label: string;
  stage: Stage;
  status: JourneyStatus;
  members: { invited: number; accepted: number; withdrawn: number };
  /** The search recorded in Matrix, running or paused. */
  search: { packageId: string; status: "active-confirmed" | "paused"; ref: string | null } | null;
  dates: { active: number; unchecked: number };
  has: Checkable;
  check: CheckState;
}

export interface PilotReport {
  journeys: PilotJourney[];
  asks: (Ask & { person: string })[];
  setup: SetupRow[];
  /** Each scheduled job that failed or did not run, as Today says it. Null when runs are not tracked yet. */
  jobs: string[] | null;
  /** Set when the checks table is not there yet. */
  unavailable?: string;
  /** Set when a read reached its limit, so the figures may be short. */
  truncated?: boolean;
}

export async function pilotReport(now = new Date()): Promise<DbResult<PilotReport>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const read = (table: string, cols: string) =>
    boundedRead(db.from(table).select(cols).eq("agent_id", agentId).limit(LIMIT), "the pilot report");

  const journeys = await boundedRead(
    db.from("rift_journeys").select("id,label,origin_lead_id").eq("agent_id", agentId).eq("side", "buy")
      .order("created_at", { ascending: false }).limit(200),
    "the pilot report",
  );
  if (!journeys.ok) return journeyTablesMissing(journeys.error) ? done({ journeys: [], asks: [], setup: [], jobs: null }) : journeys;
  const list = rows(journeys);
  if (!list.length) return done({ journeys: [], asks: [], setup: [], jobs: null });
  const ids = list.map((j) => j.id as string);
  const mine = new Set(ids);

  const [people, events, members, packages, revisions, responses, stops, steps, work, answers, bidSteps, contracts, outcomes, deadlines, dateRevs, checks] = await Promise.all([
    boundedRead(db.from("rift_leads").select("id,name,email").eq("agent_id", agentId).in("id", [...new Set(list.map((j) => j.origin_lead_id as string))]), "the pilot report"),
    read("rift_journey_events", "journey_id,seq,kind,from_value,to_value,reason,evidence,transaction_id,actor_label,created_at"),
    read("rift_journey_members", "journey_id,accepted_at,revoked_at"),
    read("rift_search_packages", "id,journey_id,status,approved_at,confirmed_at,ended_at,external_ref"),
    read("rift_search_revisions", "journey_id,author_kind,created_at"),
    read("rift_search_responses", "journey_id,response,created_at"),
    read("rift_tour_stops", "id,journey_id,requested_by_kind,created_at"),
    read("rift_tour_steps", "stop_id,seq,created_at"),
    read("rift_workstream_updates", "transaction_id,journey_id,workstream,seq,state,actor_kind,created_at"),
    read("rift_bid_responses", "bid_id,journey_id,told_agent,created_at"),
    read("rift_bid_steps", "bid_id,created_at"),
    read("rift_transactions", "id,journey_id,created_at"),
    read("rift_transaction_outcomes", "transaction_id"),
    read("rift_deadlines", "id,journey_id,transaction_id"),
    read("rift_deadline_revisions", "deadline_id,journey_id,seq,state,verified,created_at"),
    boundedRead(db.from("rift_reconciliations").select("journey_id,search,dates,note,actor_label,created_at")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(LIMIT), "the pilot report"),
  ]);
  for (const r of [people, events, members, packages, revisions, responses, stops, steps, work, answers, bidSteps, contracts, outcomes, deadlines, dateRevs]) {
    if (!r.ok && !journeyTablesMissing(r.error)) return r;
  }
  const unavailable = !checks.ok ? (journeyTablesMissing(checks.error) ? NOT_YET : null) : undefined;
  if (unavailable === null) return checks as DbResult<never>;
  const truncated = [events, members, packages, revisions, responses, stops, steps, work, answers, bidSteps, contracts, outcomes, deadlines, dateRevs, checks]
    .some((r) => rows(r).length >= LIMIT);

  const own = (r: DbResult<unknown>) => rows(r).filter((x) => x.journey_id === undefined || mine.has(x.journey_id as string));
  const at = (x: Row) => x.created_at as string;

  /* The rows the pairing reads, in its own shape. */
  const setup: SetupRow[] = own(packages).map((p) => ({
    id: p.id as string, journeyId: p.journey_id as string, status: p.status as SetupRow["status"],
    approvedAt: p.approved_at as string, confirmedAt: (p.confirmed_at as string | null) ?? null, endedAt: (p.ended_at as string | null) ?? null,
  }));
  const pilotRows: PilotRows = {
    stops: own(stops).map((s) => ({ id: s.id as string, journeyId: s.journey_id as string, byMember: s.requested_by_kind === "client", at: at(s) })),
    tourSteps: rows(steps).map((s) => ({ stopId: s.stop_id as string, seq: s.seq as number, at: at(s) })),
    work: own(work).map((w) => ({
      transactionId: w.transaction_id as string, journeyId: w.journey_id as string, workstream: w.workstream as string,
      seq: w.seq as number, state: w.state as string, byMember: w.actor_kind === "client", at: at(w),
    })),
    briefResponses: own(responses).map((r) => ({ journeyId: r.journey_id as string, response: r.response as "confirmed" | "changes-requested", at: at(r) })),
    revisions: own(revisions).map((r) => ({ journeyId: r.journey_id as string, byMember: r.author_kind === "client", at: at(r) })),
    packages: setup,
    bidAnswers: own(answers).map((a) => ({ bidId: a.bid_id as string, journeyId: a.journey_id as string, byMember: !a.told_agent, at: at(a) })),
    bidSteps: rows(bidSteps).map((s) => ({ bidId: s.bid_id as string, at: at(s) })),
  };

  const names = new Map(rows(people).map((l) => [l.id as string, ((l.name as string | null) ?? "").trim() || (l.email as string | null) || "A buyer"]));
  const personOf = new Map(list.map((j) => [j.id as string, names.get(j.origin_lead_id as string) ?? "A buyer"]));

  /* Per journey: the open contract, its active dates, and when anything checked last changed. */
  const ended = new Set(rows(outcomes).map((o) => o.transaction_id as string));
  const openContract = new Map<string, string>();
  for (const t of own(contracts)) if (!ended.has(t.id as string)) openContract.set(t.journey_id as string, t.id as string);
  const deadlineOf = new Map(own(deadlines).map((d) => [d.id as string, { journeyId: d.journey_id as string, transactionId: d.transaction_id as string }]));
  const currentRev = new Map<string, Row>();
  const lastDateChange = new Map<string, string>();
  for (const r of own(dateRevs)) {
    const id = r.deadline_id as string;
    const cur = currentRev.get(id);
    if (!cur || (cur.seq as number) < (r.seq as number)) currentRev.set(id, r);
    const j = r.journey_id as string;
    if (!lastDateChange.has(j) || Date.parse(lastDateChange.get(j)!) < Date.parse(at(r))) lastDateChange.set(j, at(r));
  }
  const lastSearchChange = new Map<string, string>();
  for (const p of setup) {
    for (const t of [p.approvedAt, p.confirmedAt, p.endedAt]) {
      if (t && (!lastSearchChange.has(p.journeyId) || Date.parse(lastSearchChange.get(p.journeyId)!) < Date.parse(t))) lastSearchChange.set(p.journeyId, t);
    }
  }
  const latestCheck = new Map<string, Check>();
  for (const c of rows(checks)) {
    const j = c.journey_id as string;
    if (latestCheck.has(j)) continue;
    latestCheck.set(j, {
      search: c.search as CheckResult, dates: c.dates as CheckResult, note: (c.note as string | null) ?? null,
      by: c.actor_label as string, at: at(c),
    });
  }
  const eventsBy = new Map<string, Row[]>();
  for (const e of own(events)) eventsBy.set(e.journey_id as string, [...(eventsBy.get(e.journey_id as string) ?? []), e]);

  const out: PilotJourney[] = list.map((j) => {
    const id = j.id as string;
    const p = progressOf(shapeEvents(eventsBy.get(id) ?? []));
    const ms = own(members).filter((m) => m.journey_id === id);
    const live = setup.find((x) => x.journeyId === id && (x.status === "active-confirmed" || x.status === "paused"));
    const liveRef = live ? (own(packages).find((x) => x.id === live.id)?.external_ref as string | null) ?? null : null;
    const contract = openContract.get(id);
    const active = [...currentRev.entries()]
      .filter(([d, r]) => deadlineOf.get(d)?.transactionId === contract && contract !== undefined && r.state === "active")
      .map(([, r]) => r);
    const has: Checkable = { search: Boolean(live), dates: active.length > 0 };
    return {
      id, person: personOf.get(id)!, label: j.label as string, stage: p.stage, status: p.status,
      members: {
        invited: ms.length,
        accepted: ms.filter((m) => m.accepted_at).length,
        withdrawn: ms.filter((m) => m.revoked_at).length,
      },
      search: live ? { packageId: live.id, status: live.status as "active-confirmed" | "paused", ref: liveRef } : null,
      dates: { active: active.length, unchecked: active.filter((r) => !r.verified).length },
      has,
      check: checkState(latestCheck.get(id) ?? null, { search: lastSearchChange.get(id) ?? null, dates: lastDateChange.get(id) ?? null }),
    };
  });

  const jobs = await jobsHealth(now);
  if (!jobs.ok) return jobs;

  return done({
    journeys: out,
    asks: asksFrom(pilotRows).map((a) => ({ ...a, person: personOf.get(a.journeyId) ?? "A buyer" })),
    setup,
    jobs: "data" in jobs && jobs.data ? jobs.data.flatMap((x) => (x.problem ? [x.problem] : [])) : null,
    ...(unavailable ? { unavailable } : {}),
    ...(truncated ? { truncated } : {}),
  });
}

/**
 * Record one check of a journey's search and dates against Matrix and the
 * documents. What there is to check is worked out here, not taken from the
 * page, so a check can never claim a search or dates the journey does not
 * have. The same request twice records once.
 */
export async function recordCheck(
  journeyId: string, input: { search: CheckResult; dates: CheckResult; note: string | null }, agentLabel: string, requestId: string,
): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const replay = await boundedRead(db.from("rift_reconciliations").select("id").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(), "the check");
  if (!replay.ok) return journeyTablesMissing(replay.error) ? failed(NOT_YET) : replay;
  if ("data" in replay && replay.data) return done({ id: (replay.data as { id: string }).id });

  const [journey, live, contracts, outcomes] = await Promise.all([
    boundedRead(db.from("rift_journeys").select("id").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey"),
    boundedRead(db.from("rift_search_packages").select("id").eq("journey_id", journeyId).eq("agent_id", agentId)
      .in("status", ["active-confirmed", "paused"]).limit(1), "the Matrix search"),
    boundedRead(db.from("rift_transactions").select("id").eq("journey_id", journeyId).eq("agent_id", agentId).limit(50), "the contracts"),
    boundedRead(db.from("rift_transaction_outcomes").select("transaction_id").eq("journey_id", journeyId).eq("agent_id", agentId).limit(50), "the contracts"),
  ]);
  for (const r of [journey, live, contracts, outcomes]) if (!r.ok) return r;
  if (!("data" in journey && journey.data)) return failed("That journey is not in your book");

  const ended = new Set(rows(outcomes).map((o) => o.transaction_id as string));
  const open = rows(contracts).find((t) => !ended.has(t.id as string))?.id as string | undefined;
  let dates = 0;
  if (open) {
    const [ds, rs] = await Promise.all([
      boundedRead(db.from("rift_deadlines").select("id").eq("transaction_id", open).eq("agent_id", agentId).limit(200), "the contract dates"),
      boundedRead(db.from("rift_deadline_revisions").select("deadline_id,seq,state").eq("journey_id", journeyId).eq("agent_id", agentId).limit(LIMIT), "the contract dates"),
    ]);
    for (const r of [ds, rs]) if (!r.ok) return r;
    const onOpen = new Set(rows(ds).map((d) => d.id as string));
    const current = new Map<string, Row>();
    for (const r of rows(rs)) {
      const id = r.deadline_id as string;
      if (onOpen.has(id) && (!current.has(id) || (current.get(id)!.seq as number) < (r.seq as number))) current.set(id, r);
    }
    dates = [...current.values()].filter((r) => r.state === "active").length;
  }
  const packageId = (rows(live)[0]?.id as string | undefined) ?? null;
  const bad = checkError(input, { search: Boolean(packageId), dates: dates > 0 });
  if (bad) return failed(bad);

  const w = await boundedWrite(db.from("rift_reconciliations").insert({
    agent_id: agentId, journey_id: journeyId, search_package_id: input.search === "none" ? null : packageId,
    search: input.search, dates: input.dates, note: input.note?.trim() || null,
    actor_label: agentLabel.slice(0, 120), request_id: requestId,
  }).select("id").single(), "the check");
  if (!w.ok) return journeyTablesMissing(w.error) ? failed(NOT_YET) : w;
  return done({ id: (("data" in w ? w.data : null) as { id: string }).id });
}
