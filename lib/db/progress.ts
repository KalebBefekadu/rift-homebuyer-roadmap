import "server-only";
import { randomUUID } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { coverageFor } from "./tours";
import {
  WORKSTREAMS, contractError, endContractError, initialWork, progressOf, stageError, statusError, workError, workstreamView,
  type ContractInput, type ContractOutcome, type Financing, type JourneyEvent, type JourneyStatus, type Progress,
  type Stage, type StageContext, type WorkInput, type WorkState, type WorkUpdate, type Workstream, type WorkstreamView,
} from "@/lib/core/progress";

/**
 * Journey progress (blueprint v4 W07). The only writer of rift_journey_events,
 * rift_transactions, rift_transaction_outcomes and rift_workstream_updates;
 * the rules are lib/core/progress.ts.
 *
 * Every read and write names the agent and the journey, so an id posted from
 * a page is never authority on its own. The agent's pages come through
 * `progressFor` and the writers below; a member's through lib/db/client.ts,
 * which has already checked the membership.
 */

export interface ContractRecord {
  id: string;
  homeId: string;
  address: string;
  financing: Financing;
  evidence: string;
  by: string;
  at: string;
  outcome: { outcome: ContractOutcome; reason: string; by: string; at: string } | null;
  work: WorkstreamView[];
  history: Record<Workstream, WorkUpdate[]>;
}

export interface ProgressRecord {
  progress: Progress;
  events: JourneyEvent[];
  /** Newest first. */
  contracts: ContractRecord[];
  open: ContractRecord | null;
  coverage: { covered: boolean; note: string };
  /** Homes still on the list, for recording a contract. */
  homes: { id: string; address: string }[];
  /** Set when the tables are not there yet, so the page says so rather than showing Prepare. */
  unavailable?: string;
}

const NOT_YET = "Progress needs a database update that has not been applied yet (migration 20260924010000).";
const CHANGED = "This journey changed since the page loaded. Reload and try again";

const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export function shapeEvents(list: Record<string, unknown>[]): JourneyEvent[] {
  return list.map((e) => ({
    seq: e.seq as number, kind: e.kind as "stage" | "status", from: e.from_value as string, to: e.to_value as string,
    reason: e.reason as string, evidence: (e.evidence as string | null) ?? null,
    contractId: (e.transaction_id as string | null) ?? null, by: e.actor_label as string, at: e.created_at as string,
  })).sort((a, b) => a.seq - b.seq);
}

export function shapeUpdates(list: Record<string, unknown>[]): Map<string, WorkUpdate[]> {
  const out = new Map<string, WorkUpdate[]>();
  for (const u of list) {
    const key = `${u.transaction_id as string}:${u.workstream as string}`;
    const l = out.get(key) ?? [];
    l.push({
      seq: u.seq as number, state: u.state as WorkState, owner: u.owner as WorkUpdate["owner"],
      ownerName: (u.owner_name as string | null) ?? null, source: (u.source as string | null) ?? null,
      confirmedOn: (u.confirmed_on as string | null) ?? null, note: (u.note as string | null) ?? null,
      byKind: u.actor_kind as "agent" | "client", by: u.actor_label as string, at: u.created_at as string,
    });
    out.set(key, l);
  }
  for (const l of out.values()) l.sort((a, b) => a.seq - b.seq);
  return out;
}

export async function readProgress(journeyId: string, agentId: string, now = new Date()): Promise<DbResult<ProgressRecord>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [events, contracts, outcomes, updates, homes, coverage] = await Promise.all([
    boundedRead(db.from("rift_journey_events").select("seq,kind,from_value,to_value,reason,evidence,transaction_id,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).order("seq").limit(1000), "the journey's history"),
    boundedRead(db.from("rift_transactions").select("id,home_id,financing,evidence,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(50), "the contracts"),
    boundedRead(db.from("rift_transaction_outcomes").select("transaction_id,outcome,reason,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).limit(50), "how contracts ended"),
    boundedRead(db.from("rift_workstream_updates").select("transaction_id,workstream,seq,state,owner,owner_name,source,confirmed_on,note,actor_kind,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).order("seq").limit(4000), "the contract's progress"),
    boundedRead(db.from("rift_shortlist_homes").select("id,address,withdrawn_at").eq("journey_id", journeyId).eq("agent_id", agentId).limit(200), "the homes"),
    coverageFor(journeyId, agentId),
  ]);
  for (const r of [events, contracts, outcomes, updates, homes]) {
    if (!r.ok) {
      return journeyTablesMissing(r.error)
        ? done({ progress: progressOf([]), events: [], contracts: [], open: null, coverage: { covered: false, note: "" }, homes: [], unavailable: NOT_YET })
        : r;
    }
  }
  if (!coverage.ok) return coverage;

  const address = new Map(rows(homes).map((h) => [h.id as string, h.address as string]));
  const ended = new Map(rows(outcomes).map((o) => [o.transaction_id as string, {
    outcome: o.outcome as ContractOutcome, reason: o.reason as string, by: o.actor_label as string, at: o.created_at as string,
  }]));
  const byStream = shapeUpdates(rows(updates));
  const list: ContractRecord[] = rows(contracts).map((c) => {
    const id = c.id as string;
    const history = Object.fromEntries(WORKSTREAMS.map((w) => [w, byStream.get(`${id}:${w}`) ?? []])) as Record<Workstream, WorkUpdate[]>;
    return {
      id, homeId: c.home_id as string, address: address.get(c.home_id as string) ?? "A home",
      financing: c.financing as Financing, evidence: c.evidence as string, by: c.actor_label as string, at: c.created_at as string,
      outcome: ended.get(id) ?? null,
      work: WORKSTREAMS.map((w) => workstreamView(w, history[w], now)),
      history,
    };
  });
  const evs = shapeEvents(rows(events));
  return done({
    progress: progressOf(evs),
    events: evs,
    contracts: list,
    open: list.find((c) => !c.outcome) ?? null,
    coverage: "data" in coverage ? coverage.data : { covered: false, note: "" },
    homes: rows(homes).filter((h) => h.withdrawn_at === null).map((h) => ({ id: h.id as string, address: h.address as string })),
  });
}

export async function progressFor(journeyId: string): Promise<DbResult<ProgressRecord>> {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return readProgress(journeyId, agentId);
}

/* ------------------------------------------------------------------ *
 * Writers
 * ------------------------------------------------------------------ */

type Loaded = { db: NonNullable<ReturnType<typeof serviceClient>>; agentId: string; rec: ProgressRecord };

async function load(journeyId: string, agentId?: string): Promise<DbResult<Loaded>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const id = agentId ?? await currentAgentId();
  if (!id) return skipped("no agent row exists yet");
  const r = await readProgress(journeyId, id);
  if (!r.ok || !("data" in r)) return r as DbResult<never>;
  if (r.data.unavailable) return failed(r.data.unavailable);
  return done({ db, agentId: id, rec: r.data });
}

const ctxOf = (rec: ProgressRecord): StageContext => ({
  covered: rec.coverage.covered, coverageNote: rec.coverage.note, openContract: rec.open !== null,
});

/** A replayed request id is the same change, already made. */
async function replayed(db: Loaded["db"], table: string, agentId: string, requestId: string): Promise<DbResult<boolean>> {
  const r = await boundedRead(db.from(table).select("id").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(), "the change");
  if (!r.ok) return r;
  return done(("data" in r ? r.data : null) !== null);
}

const seqConflict = (error: string) => /rift_journey_events_seq|rift_workstream_updates_seq|rift_transaction_outcomes_transaction_id_key|duplicate key/.test(error);

async function insertEvent(
  l: Loaded, journeyId: string, e: { kind: "stage" | "status"; from: string; to: string; reason: string; evidence?: string | null; transactionId?: string | null },
  agentLabel: string, requestId: string,
) {
  return boundedWrite(
    l.db.from("rift_journey_events").insert({
      agent_id: l.agentId, journey_id: journeyId, seq: l.rec.progress.seq + 1, kind: e.kind,
      from_value: e.from, to_value: e.to, reason: e.reason.trim(), evidence: e.evidence?.trim() || null,
      transaction_id: e.transactionId ?? null, actor_label: agentLabel.slice(0, 120), request_id: requestId,
    }),
    "the journey's stage",
  );
}

/** Move the journey to a stage by hand, with a reason. `expectedSeq` is what the page showed. */
export async function changeStage(
  journeyId: string, to: Stage, reason: string, evidence: string | null, expectedSeq: number, agentLabel: string, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const l = await load(journeyId);
  if (!l.ok || !("data" in l)) return l as DbResult<never>;
  const again = await replayed(l.data.db, "rift_journey_events", l.data.agentId, requestId);
  if (!again.ok) return again;
  if ("data" in again && again.data) return done({ seq: l.data.rec.progress.seq });
  if (l.data.rec.progress.seq !== expectedSeq) return failed(CHANGED);
  const bad = stageError(l.data.rec.progress, to, { reason, evidence }, ctxOf(l.data.rec));
  if (bad) return failed(bad);
  const w = await insertEvent(l.data, journeyId, { kind: "stage", from: l.data.rec.progress.stage, to, reason, evidence }, agentLabel, requestId);
  if (!w.ok) return seqConflict(w.error) ? failed(CHANGED) : w;
  return done({ seq: expectedSeq + 1 });
}

export async function changeStatus(
  journeyId: string, to: JourneyStatus, reason: string, expectedSeq: number, agentLabel: string, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const l = await load(journeyId);
  if (!l.ok || !("data" in l)) return l as DbResult<never>;
  const again = await replayed(l.data.db, "rift_journey_events", l.data.agentId, requestId);
  if (!again.ok) return again;
  if ("data" in again && again.data) return done({ seq: l.data.rec.progress.seq });
  if (l.data.rec.progress.seq !== expectedSeq) return failed(CHANGED);
  const bad = statusError(l.data.rec.progress, to, reason);
  if (bad) return failed(bad);
  const w = await insertEvent(l.data, journeyId, { kind: "status", from: l.data.rec.progress.status, to, reason }, agentLabel, requestId);
  if (!w.ok) return seqConflict(w.error) ? failed(CHANGED) : w;
  return done({ seq: expectedSeq + 1 });
}

/**
 * Record an executed contract: the attempt, its eight workstreams, and the
 * move to Under contract. If the move cannot be recorded (somebody changed
 * the journey meanwhile), the attempt is taken back out, so an attempt never
 * exists without the stage that says so.
 */
export async function recordContract(
  journeyId: string, input: ContractInput, expectedSeq: number, agentLabel: string, requestId: string,
): Promise<DbResult<{ id: string }>> {
  const l = await load(journeyId);
  if (!l.ok || !("data" in l)) return l as DbResult<never>;
  const { db, agentId, rec } = l.data;
  const prior = await boundedRead(db.from("rift_transactions").select("id").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(), "the contract");
  if (!prior.ok) return prior;
  const seen = ("data" in prior ? prior.data : null) as { id: string } | null;
  if (seen) return done({ id: seen.id });
  if (rec.progress.seq !== expectedSeq) return failed(CHANGED);
  const bad = contractError(rec.progress, input, { ...ctxOf(rec), homeOnList: rec.homes.some((h) => h.id === input.homeId) });
  if (bad) return failed(bad);

  const t = await boundedWrite(
    db.from("rift_transactions").insert({
      agent_id: agentId, journey_id: journeyId, home_id: input.homeId, financing: input.financing,
      evidence: input.evidence.trim(), actor_label: agentLabel.slice(0, 120), request_id: requestId,
    }).select("id").single(),
    "the contract",
  );
  if (!t.ok) return t;
  const id = (("data" in t ? t.data : null) as { id: string }).id;
  const undo = () => boundedWrite(db.from("rift_transactions").delete().eq("id", id).eq("agent_id", agentId), "the contract");

  const first = await boundedWrite(
    db.from("rift_workstream_updates").insert(initialWork(input.financing).map(({ workstream, input: w }) => ({
      agent_id: agentId, journey_id: journeyId, transaction_id: id, workstream, seq: 1,
      state: w.state, owner: w.owner, owner_name: w.ownerName ?? null, note: w.note ?? null,
      actor_kind: "agent", actor_label: agentLabel.slice(0, 120), request_id: randomUUID(),
    }))),
    "the contract's workstreams",
  );
  if (!first.ok) { await undo(); return first; }

  const moved = await insertEvent(l.data, journeyId, {
    kind: "stage", from: rec.progress.stage, to: "under-contract",
    reason: "Contract recorded", evidence: input.evidence, transactionId: id,
  }, agentLabel, randomUUID());
  if (!moved.ok) { await undo(); return seqConflict(moved.error) ? failed(CHANGED) : moved; }
  return done({ id });
}

/**
 * End the open attempt: closed (the journey moves to Own) or terminated (back
 * to Search or Offer). The ending is written once; if the stage move fails,
 * the ending is taken back out so the two never disagree.
 */
export async function endContract(
  journeyId: string, contractId: string, outcome: ContractOutcome, reason: string, backTo: Stage | null,
  expectedSeq: number, agentLabel: string, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const l = await load(journeyId);
  if (!l.ok || !("data" in l)) return l as DbResult<never>;
  const { db, agentId, rec } = l.data;
  const again = await replayed(db, "rift_journey_events", agentId, requestId);
  if (!again.ok) return again;
  if ("data" in again && again.data) return done({ seq: rec.progress.seq });
  if (!rec.open || rec.open.id !== contractId) return failed("That contract is not the open one on this journey. Reload");
  if (rec.progress.seq !== expectedSeq) return failed(CHANGED);
  const bad = endContractError(outcome, reason, backTo, rec.open.work);
  if (bad) return failed(bad);

  const o = await boundedWrite(
    db.from("rift_transaction_outcomes").insert({
      agent_id: agentId, journey_id: journeyId, transaction_id: contractId, outcome,
      reason: reason.trim(), actor_label: agentLabel.slice(0, 120),
    }),
    "how the contract ended",
  );
  if (!o.ok) return seqConflict(o.error) ? failed(CHANGED) : o;
  const to: Stage = outcome === "closed" ? "own" : backTo!;
  const moved = await insertEvent(l.data, journeyId, {
    kind: "stage", from: rec.progress.stage, to,
    reason: outcome === "closed" ? `Closed: ${reason.trim()}` : `Contract terminated: ${reason.trim()}`,
    transactionId: contractId,
  }, agentLabel, requestId);
  if (!moved.ok) {
    await boundedWrite(db.from("rift_transaction_outcomes").delete().eq("transaction_id", contractId).eq("agent_id", agentId), "how the contract ended");
    return seqConflict(moved.error) ? failed(CHANGED) : moved;
  }
  return done({ seq: expectedSeq + 1 });
}

type WorkActor = { kind: "agent"; label: string } | { kind: "client"; memberId: string; label: string };

/**
 * Record an update to one workstream of the open contract. Also called by
 * lib/db/client.ts for a member, who can only report their own part done.
 */
export async function recordWork(
  journeyId: string, agentId: string, contractId: string, workstream: Workstream, input: WorkInput,
  expectedSeq: number, actor: WorkActor, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const l = await load(journeyId, agentId);
  if (!l.ok || !("data" in l)) return l as DbResult<never>;
  const { db, rec } = l.data;
  if (!WORKSTREAMS.includes(workstream)) return failed("That is not one of the contract's workstreams");
  const again = await replayed(db, "rift_workstream_updates", agentId, requestId);
  if (!again.ok) return again;
  if ("data" in again && again.data) return done({ seq: expectedSeq + 1 });
  if (!rec.open || rec.open.id !== contractId) return failed("That contract is not open any more. Reload");
  const current = rec.open.work.find((w) => w.workstream === workstream)!;
  if (current.seq !== expectedSeq) return failed("This changed since the page loaded. Reload and try again");
  /* A client's report keeps the owner as it was; they cannot hand it on. */
  const effective: WorkInput = actor.kind === "client"
    ? { state: "reported", owner: current.owner, ownerName: current.ownerName, note: input.note ?? null }
    : input;
  const bad = workError(current.state, current.owner, actor.kind === "client" ? { ...effective, state: input.state } : effective, actor.kind);
  if (bad) return failed(bad);

  const w = await boundedWrite(
    db.from("rift_workstream_updates").insert({
      agent_id: agentId, journey_id: journeyId, transaction_id: contractId, workstream, seq: expectedSeq + 1,
      state: effective.state, owner: effective.owner,
      owner_name: effective.owner === "other" ? effective.ownerName?.trim() || null : null,
      source: effective.source?.trim() || null, confirmed_on: effective.confirmedOn || null, note: effective.note?.trim() || null,
      actor_kind: actor.kind, member_id: actor.kind === "client" ? actor.memberId : null,
      actor_label: actor.label.slice(0, 120), request_id: requestId,
    }),
    "the update",
  );
  if (!w.ok) return seqConflict(w.error) ? failed("This changed since the page loaded. Reload and try again") : w;
  return done({ seq: expectedSeq + 1 });
}

export async function recordWorkAsAgent(
  journeyId: string, contractId: string, workstream: Workstream, input: WorkInput, expectedSeq: number, agentLabel: string, requestId: string,
) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return recordWork(journeyId, agentId, contractId, workstream, input, expectedSeq, { kind: "agent", label: agentLabel }, requestId);
}
