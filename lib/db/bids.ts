import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { coverageFor } from "./tours";
import { memberState } from "@/lib/core/journey";
import {
  bidStepError, bidView, responseError, termsError,
  type BidContext, type BidResponse, type BidStep, type BidView, type Instruction, type StepInput, type StepKind, type Terms,
} from "@/lib/core/bid";

/**
 * Buyer offers (blueprint v4 W08; B08 to B10). The only writer of rift_bids,
 * rift_bid_steps and rift_bid_responses; the rules are lib/core/bid.ts.
 *
 * Every read and write names the agent and the journey. A member's answer
 * comes through lib/db/client.ts, which has checked the membership; this file
 * checks that the answer is to the version being asked about now, from
 * somebody whose say was asked for.
 */

export interface BidRecord {
  id: string;
  homeId: string;
  address: string;
  homeWithdrawn: boolean;
  createdAt: string;
  steps: BidStep[];
  responses: BidResponse[];
  view: BidView;
}

export interface Bids {
  bids: BidRecord[];
  coverage: { covered: boolean; note: string };
  /** Household members who can give an instruction: buyer or co-buyer, invited or joined, not withdrawn. */
  deciders: { memberId: string; name: string }[];
  unavailable?: string;
}

const NOT_YET = "Offers need a database update that has not been applied yet (migration 20260924020000).";
const CHANGED = "This offer changed since the page loaded. Reload and try again";
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export function shapeSteps(list: Record<string, unknown>[]): Map<string, BidStep[]> {
  const out = new Map<string, BidStep[]>();
  for (const s of list) {
    const l = out.get(s.bid_id as string) ?? [];
    l.push({
      seq: s.seq as number, kind: s.kind as StepKind, version: s.version as number,
      terms: (s.terms as Terms | null) ?? null, origin: (s.origin as "ours" | "theirs" | null) ?? null,
      required: (s.required as { memberId: string; name: string }[]) ?? [],
      documentIds: (s.document_ids as string[]) ?? [], note: (s.note as string | null) ?? null,
      by: s.actor_label as string, at: s.created_at as string,
    });
    out.set(s.bid_id as string, l);
  }
  for (const l of out.values()) l.sort((a, b) => a.seq - b.seq);
  return out;
}

export async function readBids(journeyId: string, agentId: string, agentFirst: string): Promise<DbResult<Bids>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [bids, steps, responses, homes, members, coverage] = await Promise.all([
    boundedRead(db.from("rift_bids").select("id,home_id,created_at").eq("journey_id", journeyId).eq("agent_id", agentId)
      .order("created_at", { ascending: false }).limit(50), "the offers"),
    boundedRead(db.from("rift_bid_steps").select("bid_id,seq,kind,version,terms,origin,required,document_ids,note,actor_label,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("seq").limit(2000), "the offer steps"),
    boundedRead(db.from("rift_bid_responses").select("bid_id,member_id,version,instruction,note,told_agent,actor_label,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(2000), "the household's answers"),
    boundedRead(db.from("rift_shortlist_homes").select("id,address,withdrawn_at").eq("journey_id", journeyId).eq("agent_id", agentId).limit(200), "the homes"),
    boundedRead(db.from("rift_journey_members").select("id,display_name,email,role,accepted_at,revoked_at,invite_expires_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).limit(50), "the household"),
    coverageFor(journeyId, agentId),
  ]);
  for (const r of [bids, steps, responses, homes, members]) {
    if (!r.ok) {
      return journeyTablesMissing(r.error)
        ? done({ bids: [], coverage: { covered: false, note: "" }, deciders: [], unavailable: NOT_YET })
        : r;
    }
  }
  if (!coverage.ok) return coverage;

  const home = new Map(rows(homes).map((h) => [h.id as string, { address: h.address as string, withdrawn: h.withdrawn_at !== null }]));
  const names = new Map(rows(members).map((m) => [m.id as string, ((m.display_name as string | null)?.trim() || (m.email as string))]));
  const deciders = rows(members)
    .filter((m) => (m.role === "buyer" || m.role === "co-buyer") && !m.revoked_at)
    .filter((m) => memberState({
      acceptedAt: m.accepted_at as string | null, revokedAt: m.revoked_at as string | null, inviteExpiresAt: m.invite_expires_at as string | null,
    }) !== "revoked")
    .map((m) => ({ memberId: m.id as string, name: names.get(m.id as string)! }));
  const stepsOf = shapeSteps(rows(steps));
  const responsesOf = new Map<string, BidResponse[]>();
  for (const r of rows(responses)) {
    const l = responsesOf.get(r.bid_id as string) ?? [];
    l.push({
      memberId: r.member_id as string, name: names.get(r.member_id as string) ?? "Someone who left", version: r.version as number,
      instruction: r.instruction as Instruction, note: (r.note as string | null) ?? null,
      toldAgent: (r.told_agent as string | null) ?? null, at: r.created_at as string,
    });
    responsesOf.set(r.bid_id as string, l);
  }
  return done({
    bids: rows(bids).map((b) => {
      const id = b.id as string;
      const h = home.get(b.home_id as string);
      const s = stepsOf.get(id) ?? [];
      const rs = responsesOf.get(id) ?? [];
      return {
        id, homeId: b.home_id as string, address: h?.address ?? "A home", homeWithdrawn: h?.withdrawn ?? true,
        createdAt: b.created_at as string, steps: s, responses: rs, view: bidView(s, rs, agentFirst),
      };
    }),
    coverage: "data" in coverage ? coverage.data : { covered: false, note: "" },
    deciders,
  });
}

async function agent(): Promise<{ id: string } | null> {
  const id = await currentAgentId();
  return id ? { id } : null;
}

export async function bidsFor(journeyId: string, agentFirst: string) {
  const a = await agent();
  if (!a) return skipped("no agent row exists yet");
  return readBids(journeyId, a.id, agentFirst);
}

/** Documents attached to a step must be this journey's. */
async function ownDocuments(journeyId: string, agentId: string, ids: string[]): Promise<DbResult<true>> {
  if (!ids.length) return done(true as const);
  const db = serviceClient()!;
  const r = await boundedRead(db.from("rift_documents").select("id").eq("journey_id", journeyId).eq("agent_id", agentId).in("id", ids), "the documents");
  if (!r.ok) return r;
  return rows(r).length === new Set(ids).size ? done(true as const) : failed("One of those documents is not on this journey");
}

/**
 * Start an offer on a home with its first terms. One open offer per home: a
 * second one on the same home would split the household's answers.
 */
export async function startBid(
  journeyId: string, homeId: string, terms: Terms, documentIds: string[], agentLabel: string, agentFirst: string, requestId: string,
): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const a = await agent();
  if (!a) return skipped("no agent row exists yet");
  const replay = await boundedRead(db.from("rift_bid_steps").select("bid_id").eq("request_id", requestId).eq("agent_id", a.id).maybeSingle(), "the offer");
  if (!replay.ok) return replay;
  const seen = ("data" in replay ? replay.data : null) as { bid_id: string } | null;
  if (seen) return done({ id: seen.bid_id });

  const all = await readBids(journeyId, a.id, agentFirst);
  if (!all.ok || !("data" in all)) return all as DbResult<never>;
  if (all.data.unavailable) return failed(all.data.unavailable);
  const h = await boundedRead(db.from("rift_shortlist_homes").select("withdrawn_at").eq("id", homeId).eq("journey_id", journeyId).eq("agent_id", a.id).maybeSingle(), "the home");
  if (!h.ok) return h;
  const homeRow = ("data" in h ? h.data : null) as { withdrawn_at: string | null } | null;
  if (!homeRow) return failed("Choose a home on the list");
  if (homeRow.withdrawn_at) return failed("That home is off the list");
  if (all.data.bids.some((b) => b.homeId === homeId && !b.view.final)) return failed("An offer on this home is already open. Give it new terms instead");
  if (!all.data.coverage.covered) return failed(`No offer can go ahead without a signed buyer agreement in force. ${all.data.coverage.note}`);
  const bad = termsError(terms);
  if (bad) return failed(bad);
  const docs = await ownDocuments(journeyId, a.id, documentIds);
  if (!docs.ok) return docs;

  const bid = await boundedWrite(
    db.from("rift_bids").insert({ agent_id: a.id, journey_id: journeyId, home_id: homeId, actor_label: agentLabel.slice(0, 120) }).select("id").single(),
    "the offer",
  );
  if (!bid.ok) return bid;
  const id = (("data" in bid ? bid.data : null) as { id: string }).id;
  const first = await boundedWrite(
    db.from("rift_bid_steps").insert({
      agent_id: a.id, journey_id: journeyId, bid_id: id, seq: 1, kind: "terms", version: 1, terms, origin: "ours",
      document_ids: documentIds, actor_label: agentLabel.slice(0, 120), request_id: requestId,
    }),
    "the offer",
  );
  if (!first.ok) {
    await boundedWrite(db.from("rift_bids").delete().eq("id", id).eq("agent_id", a.id), "the offer");
    return first;
  }
  return done({ id });
}

/** The next step of an offer, as it happened. `expectedSeq` is what the page showed. */
export async function recordBidStep(
  journeyId: string, bidId: string, input: StepInput, expectedSeq: number, agentLabel: string, agentFirst: string, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const a = await agent();
  if (!a) return skipped("no agent row exists yet");
  const replay = await boundedRead(db.from("rift_bid_steps").select("seq").eq("request_id", requestId).eq("agent_id", a.id).maybeSingle(), "the offer");
  if (!replay.ok) return replay;
  const seen = ("data" in replay ? replay.data : null) as { seq: number } | null;
  if (seen) return done({ seq: seen.seq });

  const all = await readBids(journeyId, a.id, agentFirst);
  if (!all.ok || !("data" in all)) return all as DbResult<never>;
  if (all.data.unavailable) return failed(all.data.unavailable);
  const bid = all.data.bids.find((b) => b.id === bidId);
  if (!bid) return failed("That offer is not on this journey");
  const latestSeq = bid.steps.length ? bid.steps[bid.steps.length - 1]!.seq : 0;
  if (latestSeq !== expectedSeq) return failed(CHANGED);
  const ctx: BidContext = {
    covered: all.data.coverage.covered, coverageNote: all.data.coverage.note,
    homeWithdrawn: bid.homeWithdrawn, deciders: all.data.deciders.length,
  };
  const bad = bidStepError(bid.view, input, ctx);
  if (bad) return failed(bad);
  const docs = await ownDocuments(journeyId, a.id, input.documentIds ?? []);
  if (!docs.ok) return docs;

  const isTerms = input.kind === "terms";
  const w = await boundedWrite(
    db.from("rift_bid_steps").insert({
      agent_id: a.id, journey_id: journeyId, bid_id: bidId, seq: latestSeq + 1, kind: input.kind,
      version: isTerms ? bid.view.version + 1 : bid.view.version,
      terms: isTerms ? input.terms : null, origin: isTerms ? (input.origin ?? "ours") : null,
      required: input.kind === "ask" ? all.data.deciders : [],
      document_ids: input.documentIds ?? [], note: input.note?.trim() || null,
      actor_label: agentLabel.slice(0, 120), request_id: requestId,
    }),
    "the offer",
  );
  if (!w.ok) return /rift_bid_steps_seq|duplicate key/.test(w.error) ? failed(CHANGED) : w;
  return done({ seq: latestSeq + 1 });
}

/**
 * A household member's instruction on the version being asked about. From
 * the member's own page, or recorded by the agent from a call, with how.
 */
export async function recordResponse(
  journeyId: string, agentId: string, bidId: string, member: { memberId: string; label: string }, version: number,
  instruction: Instruction, note: string | null, toldAgent: string | null, agentFirst: string, requestId: string,
): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const replay = await boundedRead(db.from("rift_bid_responses").select("id").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(), "your answer");
  if (!replay.ok) return replay;
  if ("data" in replay && replay.data) return done({ recorded: true as const });

  const all = await readBids(journeyId, agentId, agentFirst);
  if (!all.ok || !("data" in all)) return all as DbResult<never>;
  if (all.data.unavailable) return failed(all.data.unavailable);
  const bid = all.data.bids.find((b) => b.id === bidId);
  if (!bid) return failed("That offer is not on this journey");
  const bad = responseError(bid.view, member.memberId, version, instruction, note);
  if (bad) return failed(bad);
  if (toldAgent !== null && toldAgent.trim().length < 3) return failed("Say how they told you, like \"On the phone, 2:15 PM\"");

  const w = await boundedWrite(
    db.from("rift_bid_responses").insert({
      agent_id: agentId, journey_id: journeyId, bid_id: bidId, version, member_id: member.memberId, instruction,
      note: note?.trim() || null, told_agent: toldAgent?.trim() || null, actor_label: member.label.slice(0, 120), request_id: requestId,
    }),
    "your answer",
  );
  if (!w.ok) return w;
  return done({ recorded: true as const });
}

export async function responseAsAgent(
  journeyId: string, bidId: string, memberId: string, version: number, instruction: Instruction, note: string | null,
  how: string, agentLabel: string, agentFirst: string, requestId: string,
) {
  const a = await agent();
  if (!a) return skipped("no agent row exists yet");
  return recordResponse(journeyId, a.id, bidId, { memberId, label: `${agentLabel} (recorded for them)` }, version, instruction, note, how, agentFirst, requestId);
}
