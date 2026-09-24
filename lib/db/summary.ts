import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { datesNeedingAttention } from "./deadlines";
import { jobsHealth } from "./jobs";
import type { Activity, SummaryDate, SummaryLead } from "@/lib/core/summary";
import type { Band } from "@/lib/core/lead";

/**
 * What the daily summary says (W12, D07): everything a household member did
 * since `since`, plus the dates, jobs and new people Studio Today would show.
 * Reads only, scoped to the agent. The words are lib/core/summary.ts.
 *
 * Only what a MEMBER did is activity. Something the agent recorded on their
 * behalf (an answer he was told on the phone) is his own work, not news.
 */

export interface SummaryParts {
  activity: Activity[];
  dates: SummaryDate[];
  jobs: string[];
  leads: SummaryLead[];
}

type Row = Record<string, unknown>;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? ((r.data as Row[] | null) ?? []) : []);

export async function summaryParts(since: Date, now = new Date()): Promise<DbResult<SummaryParts>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const from = since.toISOString();
  const mine = (table: string, cols: string) =>
    boundedRead(db.from(table).select(cols).eq("agent_id", agentId).gte("created_at", from).limit(500), "the summary");

  const [leads, journeys, members, reactions, homesAdded, tours, feedback, answers, briefAnswers, proposals, work] = await Promise.all([
    mine("rift_leads", "name,side,band"),
    boundedRead(db.from("rift_journeys").select("id,label,origin_lead_id").eq("agent_id", agentId).limit(1000), "the summary"),
    boundedRead(db.from("rift_journey_members").select("id,journey_id,display_name,email,accepted_at").eq("agent_id", agentId).limit(2000), "the summary"),
    mine("rift_home_reactions", "journey_id,home_id,member_id,reaction,reason,created_at"),
    mine("rift_shortlist_homes", "journey_id,address,added_by_member,created_at"),
    mine("rift_tour_stops", "journey_id,home_id,requested_by_member,created_at"),
    mine("rift_tour_feedback", "journey_id,stop_id,member_id,offer,created_at"),
    mine("rift_bid_responses", "journey_id,bid_id,member_id,version,instruction,told_agent,created_at"),
    mine("rift_search_responses", "journey_id,member_id,response,created_at"),
    mine("rift_search_revisions", "journey_id,author_member_id,created_at"),
    mine("rift_workstream_updates", "journey_id,member_id,workstream,created_at"),
  ]);
  if (!leads.ok) return leads;
  /* Before a journey migration the tables are simply not there: that is no
     activity, not a failure. Anything else fails the run, so a summary that
     could not be read shows on the job's health rather than going out empty. */
  for (const r of [journeys, members, reactions, homesAdded, tours, feedback, answers, briefAnswers, proposals, work]) {
    if (!r.ok && !journeyTablesMissing(r.error)) return r;
  }

  const journeyRows = rows(journeys);
  const journeyIds = journeyRows.map((j) => j.id as string);
  const leadIds = [...new Set(journeyRows.map((j) => j.origin_lead_id as string))];
  const [people, homes, bids, stops] = journeyIds.length ? await Promise.all([
    boundedRead(db.from("rift_leads").select("id,name").eq("agent_id", agentId).in("id", leadIds), "the summary"),
    boundedRead(db.from("rift_shortlist_homes").select("id,address").eq("agent_id", agentId).in("journey_id", journeyIds).limit(2000), "the summary"),
    boundedRead(db.from("rift_bids").select("id,home_id").eq("agent_id", agentId).in("journey_id", journeyIds).limit(1000), "the summary"),
    boundedRead(db.from("rift_tour_stops").select("id,home_id").eq("agent_id", agentId).in("journey_id", journeyIds).limit(2000), "the summary"),
  ]) : [done([]), done([]), done([]), done([])];
  for (const r of [people, homes, bids, stops]) if (!r.ok && !journeyTablesMissing(r.error)) return r;

  const nameOfLead = new Map(rows(people).map((x) => [x.id as string, (x.name as string | null) ?? "Someone"]));
  const journeyOf = new Map(journeyRows.map((j) => [j.id as string, { label: j.label as string, person: nameOfLead.get(j.origin_lead_id as string) ?? "Someone" }]));
  const memberName = new Map(rows(members).map((m) => [m.id as string, (m.display_name as string | null) ?? (m.email as string)]));
  const address = new Map(rows(homes).map((h) => [h.id as string, h.address as string]));
  const homeOfBid = new Map(rows(bids).map((b) => [b.id as string, b.home_id as string]));
  const homeOfStop = new Map(rows(stops).map((s) => [s.id as string, s.home_id as string]));
  const home = (id: unknown) => address.get(id as string) ?? "a home";

  const activity: Activity[] = [];
  const push = (r: Row, member: unknown, rest: Record<string, unknown>) => {
    const j = journeyOf.get(r.journey_id as string);
    if (!j || !member) return;
    activity.push({ journeyId: r.journey_id as string, journey: j.label, person: j.person, who: memberName.get(member as string) ?? "A household member", at: (r.created_at ?? r.accepted_at) as string, ...rest } as Activity);
  };

  for (const m of rows(members)) if (m.accepted_at && (m.accepted_at as string) >= from) push({ ...m, created_at: m.accepted_at }, m.id, { kind: "joined" });
  /* A showing request writes a reaction too; it is reported once, as the request. */
  for (const r of rows(reactions)) if (r.reaction !== "tour-requested") push(r, r.member_id, { kind: "reaction", home: home(r.home_id), reaction: r.reaction, reason: (r.reason as string | null) ?? null });
  for (const r of rows(homesAdded)) push(r, r.added_by_member, { kind: "home-added", home: r.address });
  for (const r of rows(tours)) push(r, r.requested_by_member, { kind: "tour-request", home: home(r.home_id) });
  for (const r of rows(feedback)) push(r, r.member_id, { kind: "tour-answer", home: home(homeOfStop.get(r.stop_id as string)), offer: r.offer });
  for (const r of rows(answers)) if (!r.told_agent) push(r, r.member_id, { kind: "offer-answer", home: home(homeOfBid.get(r.bid_id as string)), version: r.version, instruction: r.instruction });
  for (const r of rows(briefAnswers)) push(r, r.member_id, { kind: "brief-answer", response: r.response });
  for (const r of rows(proposals)) push(r, r.author_member_id, { kind: "brief-proposal" });
  for (const r of rows(work)) push(r, r.member_id, { kind: "work", workstream: r.workstream });

  const [dates, jobs] = await Promise.all([datesNeedingAttention(now), jobsHealth(now)]);
  if (!dates.ok) return dates;
  if (!jobs.ok) return jobs;

  return done({
    activity,
    dates: ("data" in dates && dates.data ? dates.data : []).map((d) => ({ person: d.person, label: d.label, when: d.when, why: d.why })),
    jobs: ("data" in jobs && jobs.data ? jobs.data : []).flatMap((j) => (j.problem ? [j.problem] : [])),
    leads: rows(leads).map((l) => ({ name: (l.name as string | null) ?? null, side: l.side as "buy" | "sell", band: (l.band as Band | null) ?? "nurture" })),
  });
}
