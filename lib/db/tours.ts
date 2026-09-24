import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { STATUSES, standingOf, type Status as RepStatus } from "@/lib/core/representation";
import {
  AVAILABILITY_MAX, feedbackError, stepError, viewOf,
  type FeedbackInput, type OfferInterest, type StepInput, type TourContext, type TourStatus, type TourStep, type TourView,
} from "@/lib/core/tour";

/**
 * Tours (journey contract B06). The only writer of rift_tour_*; the rules
 * are lib/core/tour.ts.
 *
 * Every read and write here names the agent it is for, and every row it
 * touches is matched on that agent and on the journey, so a stop id posted
 * from a page is never authority on its own. The agent's pages reach it
 * through `toursOf` and the step functions below; a buyer's through
 * lib/db/client.ts, which has already checked the membership.
 */

export interface TourFeedback {
  memberId: string | null;
  who: string;
  offer: OfferInterest;
  reason: string | null;
  searchChange: string | null;
  at: string;
}

export interface TourStop {
  id: string;
  homeId: string;
  address: string;
  homeWithdrawn: boolean;
  requestedBy: string;
  requestedByMember: string | null;
  availability: string | null;
  createdAt: string;
  steps: TourStep[];
  feedback: TourFeedback[];
  view: TourView;
}

export interface Tours {
  stops: TourStop[];
  /** The agreement as it reads today, for the screen to say once rather than per stop. */
  coverage: { covered: boolean; note: string };
  /** Set when the tables are not there yet. The page says so rather than
   *  showing an empty list, which would read as "no showings". */
  unavailable?: string;
}

const NOT_YET = "Showings need a database update that has not been applied yet (migration 20260924000000).";

/** Whether the journey's buyer has a signed agreement in force today. */
export async function coverageFor(journeyId: string, agentId: string): Promise<DbResult<{ covered: boolean; note: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const j = await boundedRead(
    db.from("rift_journeys").select("origin_lead_id").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(),
    "the journey",
  );
  if (!j.ok) return j;
  const leadId = (("data" in j ? j.data : null) as { origin_lead_id: string } | null)?.origin_lead_id;
  if (!leadId) return failed("that journey could not be found");
  const r = await boundedRead(
    db.from("rift_leads").select("representation,representation_signed_on,representation_expires_on")
      .eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "the buyer agreement",
  );
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as Record<string, unknown> | null;
  /* Unknown or missing reads as "none", which refuses (same rule as representationOf). */
  const raw = (row?.representation as string | null) ?? "none";
  const status = ((STATUSES as readonly string[]).includes(raw) ? raw : "none") as RepStatus;
  const standing = standingOf({
    status,
    signedOn: (row?.representation_signed_on as string | null) ?? null,
    expiresOn: (row?.representation_expires_on as string | null) ?? null,
  });
  return done({ covered: standing.covered, note: standing.note });
}

export function shapeTours(
  stops: Record<string, unknown>[], steps: Record<string, unknown>[], feedback: Record<string, unknown>[],
  homes: Map<string, { address: string; withdrawn: boolean }>,
  coverage: { covered: boolean; note: string }, now = new Date(),
): TourStop[] {
  const stepsOf = new Map<string, TourStep[]>();
  for (const s of steps) {
    const list = stepsOf.get(s.stop_id as string) ?? [];
    list.push({
      seq: s.seq as number, status: s.status as TourStatus,
      startsAt: (s.starts_at as string | null) ?? null, endsAt: (s.ends_at as string | null) ?? null,
      ref: (s.ref as string | null) ?? null, note: (s.note as string | null) ?? null,
      by: s.actor_label as string, at: s.created_at as string,
    });
    stepsOf.set(s.stop_id as string, list);
  }
  const feedbackOf = new Map<string, TourFeedback[]>();
  for (const f of feedback) {
    const list = feedbackOf.get(f.stop_id as string) ?? [];
    list.push({
      memberId: (f.member_id as string | null) ?? null, who: f.actor_label as string, offer: f.offer as OfferInterest,
      reason: (f.reason as string | null) ?? null, searchChange: (f.search_change as string | null) ?? null, at: f.created_at as string,
    });
    feedbackOf.set(f.stop_id as string, list);
  }
  return stops.map((s) => {
    const home = homes.get(s.home_id as string);
    const stepList = (stepsOf.get(s.id as string) ?? []).sort((a, b) => a.seq - b.seq);
    const ctx: TourContext = { covered: coverage.covered, coverageNote: coverage.note, homeWithdrawn: home?.withdrawn ?? true };
    return {
      id: s.id as string,
      homeId: s.home_id as string,
      address: home?.address ?? "A home no longer on the list",
      homeWithdrawn: ctx.homeWithdrawn,
      requestedBy: s.requested_by_label as string,
      requestedByMember: (s.requested_by_member as string | null) ?? null,
      availability: (s.availability as string | null) ?? null,
      createdAt: s.created_at as string,
      steps: stepList,
      feedback: (feedbackOf.get(s.id as string) ?? []).sort((a, b) => a.at.localeCompare(b.at)),
      view: viewOf(stepList, ctx, now),
    };
  });
}

/** Every stop on a journey with its steps and answers. For the agent, or for a member via lib/db/client.ts. */
export async function readTours(journeyId: string, agentId: string): Promise<DbResult<Tours>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [stops, steps, feedback, homes, coverage] = await Promise.all([
    boundedRead(
      db.from("rift_tour_stops").select("id,home_id,requested_by_label,requested_by_member,availability,created_at")
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(100),
      "the showings",
    ),
    boundedRead(
      db.from("rift_tour_steps").select("stop_id,seq,status,starts_at,ends_at,ref,note,actor_label,created_at")
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("seq").limit(2000),
      "the showing steps",
    ),
    boundedRead(
      db.from("rift_tour_feedback").select("stop_id,member_id,actor_label,offer,reason,search_change,created_at")
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(1000),
      "the answers after showings",
    ),
    boundedRead(
      db.from("rift_shortlist_homes").select("id,address,withdrawn_at")
        .eq("journey_id", journeyId).eq("agent_id", agentId).limit(200),
      "the homes",
    ),
    coverageFor(journeyId, agentId),
  ]);
  for (const r of [stops, steps, feedback, homes]) {
    if (!r.ok) return journeyTablesMissing(r.error) ? done({ stops: [], coverage: { covered: false, note: "" }, unavailable: NOT_YET }) : r;
  }
  if (!coverage.ok) return coverage;
  const cov = ("data" in coverage ? coverage.data : { covered: false, note: "" });
  const homeMap = new Map<string, { address: string; withdrawn: boolean }>();
  for (const h of (("data" in homes ? homes.data : []) as Record<string, unknown>[])) {
    homeMap.set(h.id as string, { address: h.address as string, withdrawn: h.withdrawn_at !== null });
  }
  return done({
    stops: shapeTours(
      ("data" in stops ? stops.data : []) as Record<string, unknown>[],
      ("data" in steps ? steps.data : []) as Record<string, unknown>[],
      ("data" in feedback ? feedback.data : []) as Record<string, unknown>[],
      homeMap, cov,
    ),
    coverage: cov,
  });
}

export async function toursOf(journeyId: string): Promise<DbResult<Tours>> {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return readTours(journeyId, agentId);
}

type Actor = { kind: "agent"; label: string } | { kind: "client"; memberId: string; label: string };

/**
 * Ask to see a home. Creates the stop and its first step ("requested"). Also
 * written by lib/db/client.ts for a member, which passes its own actor.
 *
 * One open request per home: a second click, or the co-buyer asking too,
 * finds the one already there rather than making a second showing to arrange.
 */
export async function requestTour(
  journeyId: string, agentId: string, homeId: string, availability: string | null, actor: Actor, requestId: string,
): Promise<DbResult<{ id: string; existing: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const when = availability?.trim() || null;
  if (when && when.length > AVAILABILITY_MAX) return failed(`Keep it under ${AVAILABILITY_MAX} characters`);

  const home = await boundedRead(
    db.from("rift_shortlist_homes").select("id,withdrawn_at").eq("id", homeId).eq("journey_id", journeyId).eq("agent_id", agentId).maybeSingle(),
    "the home",
  );
  if (!home.ok) return home;
  const h = ("data" in home ? home.data : null) as { withdrawn_at: string | null } | null;
  if (!h) return failed("That home is not on this list");
  if (h.withdrawn_at) return failed("That home is off the list now");

  const open = await readTours(journeyId, agentId);
  if (!open.ok) return open;
  if ("data" in open && open.data.unavailable) return failed(open.data.unavailable);
  const already = ("data" in open ? open.data.stops : []).find((s) => s.homeId === homeId && s.view.status !== "cancelled" && s.view.status !== "completed");
  if (already) return done({ id: already.id, existing: true });

  const stop = await boundedWrite(
    db.from("rift_tour_stops").insert({
      agent_id: agentId, journey_id: journeyId, home_id: homeId,
      requested_by_kind: actor.kind, requested_by_member: actor.kind === "client" ? actor.memberId : null,
      requested_by_label: actor.label.slice(0, 120), availability: when,
    }).select("id").single(),
    "the showing request",
  );
  if (!stop.ok) return stop;
  const id = (("data" in stop ? stop.data : null) as { id: string }).id;
  const first = await boundedWrite(
    db.from("rift_tour_steps").insert({
      agent_id: agentId, journey_id: journeyId, stop_id: id, seq: 1, status: "requested",
      actor_label: actor.label.slice(0, 120), request_id: requestId,
    }),
    "the showing request",
  );
  if (!first.ok) {
    /* A stop without its first step could never advance (step 1 must be the
       request), so take it back out rather than leave it stuck. */
    await boundedWrite(db.from("rift_tour_stops").delete().eq("id", id).eq("agent_id", agentId), "the showing request");
    return first;
  }
  return done({ id, existing: false });
}

/**
 * Record the next step of a showing, as it happened in ShowingTime.
 *
 * `expectedSeq` is the step the page was showing. If somebody recorded a step
 * since, this refuses rather than applying a step meant for a different
 * state. The same `requestId` twice is one step.
 */
export async function recordTourStep(
  journeyId: string, stopId: string, input: StepInput, expectedSeq: number, agentLabel: string, requestId: string,
): Promise<DbResult<{ seq: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const tours = await readTours(journeyId, agentId);
  if (!tours.ok) return tours;
  const all = "data" in tours ? tours.data : null;
  if (all?.unavailable) return failed(all.unavailable);
  const stop = all?.stops.find((s) => s.id === stopId);
  if (!stop || !all) return failed("That showing is not on this journey");

  const replay = await boundedRead(
    db.from("rift_tour_steps").select("seq").eq("request_id", requestId).eq("agent_id", agentId).maybeSingle(),
    "the showing",
  );
  if (!replay.ok) return replay;
  const seen = ("data" in replay ? replay.data : null) as { seq: number } | null;
  if (seen) return done({ seq: seen.seq });

  const latestSeq = stop.steps.length ? stop.steps[stop.steps.length - 1]!.seq : 0;
  if (latestSeq !== expectedSeq) return failed("This showing changed since the page loaded. Reload and try again");

  const bad = stepError(stop.view.status, input, {
    covered: all.coverage.covered, coverageNote: all.coverage.note, homeWithdrawn: stop.homeWithdrawn,
  });
  if (bad) return failed(bad);

  const timed = input.to === "confirmed" || input.to === "changed";
  const wrote = await boundedWrite(
    db.from("rift_tour_steps").insert({
      agent_id: agentId, journey_id: journeyId, stop_id: stopId, seq: latestSeq + 1, status: input.to,
      starts_at: timed ? input.startsAt : null, ends_at: timed ? input.endsAt : null,
      ref: input.ref?.trim() || null, note: input.note?.trim() || null,
      actor_label: agentLabel.slice(0, 120), request_id: requestId,
    }),
    "the showing",
  );
  if (!wrote.ok) {
    return /rift_tour_steps_seq|duplicate key/.test(wrote.error)
      ? failed("This showing changed since the page loaded. Reload and try again")
      : wrote;
  }
  return done({ seq: latestSeq + 1 });
}

/** The answer after a showing. Only once it happened. */
export async function insertFeedback(
  journeyId: string, agentId: string, stopId: string, f: FeedbackInput,
  actor: { memberId: string | null; label: string },
): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const bad = feedbackError(f);
  if (bad) return failed(bad);
  const tours = await readTours(journeyId, agentId);
  if (!tours.ok) return tours;
  const stop = ("data" in tours ? tours.data.stops : []).find((s) => s.id === stopId);
  if (!stop) return failed("That showing is not on this journey");
  if (stop.view.status !== "completed") return failed("Answer once the showing has happened");
  const wrote = await boundedWrite(
    db.from("rift_tour_feedback").insert({
      agent_id: agentId, journey_id: journeyId, stop_id: stopId, member_id: actor.memberId,
      actor_label: actor.label.slice(0, 120), offer: f.offer,
      reason: f.reason?.trim() || null, search_change: f.searchChange?.trim() || null,
    }),
    "your answer",
  );
  if (!wrote.ok) return wrote;
  return done({ recorded: true as const });
}

/** The agent asking on the buyer's behalf, or recording what they said. */
export async function requestTourAsAgent(journeyId: string, homeId: string, availability: string | null, agentLabel: string, requestId: string) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return requestTour(journeyId, agentId, homeId, availability, { kind: "agent", label: agentLabel }, requestId);
}

export async function feedbackAsAgent(journeyId: string, stopId: string, f: FeedbackInput, onBehalfOf: string) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const who = onBehalfOf.trim();
  if (!who) return failed("Say whose answer this is");
  return insertFeedback(journeyId, agentId, stopId, f, { memberId: null, label: `${who} (told the agent)` });
}
