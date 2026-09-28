import "server-only";
import { randomUUID } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { marketDay } from "@/lib/core/progress";
import {
  listingError, reviewError, showingError, showingsFrom,
  type Interest, type ListingEvent, type ListingKind, type Review, type Showing, type ShowingRow, type ShowingState,
} from "@/lib/core/listing";
import type { SaleCadence } from "@/lib/core/seller-cadence";
import type { Stage } from "@/lib/core/progress";

/**
 * The only reader and writer of a sale's listing events, showings and weekly
 * reviews (S06 to S09). Rules: lib/core/listing.ts. Null means the tables
 * are not there yet (migration 20260928050000).
 */

const MISSING = /rift_listing|rift_pricing|does not exist|schema cache/;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

const shapeEvent = (e: Record<string, unknown>): ListingEvent => ({
  kind: e.kind as ListingKind, detail: e.detail as string, url: (e.url as string | null) ?? null,
  price: e.price_cents === null ? null : Number(e.price_cents) / 100, by: e.actor_label as string, at: e.created_at as string,
});

export interface Listing { events: ListingEvent[]; showings: Showing[]; reviews: Review[] }

export async function listingOf(journeyId: string, agentId: string): Promise<DbResult<Listing | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [ev, sh, rv] = await Promise.all([
    boundedRead(db.from("rift_listing_events").select("kind,detail,url,price_cents,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(500), "the listing"),
    boundedRead(db.from("rift_listing_showings").select("showing_key,starts_at,state,showing_agent,feedback,interest,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(2000), "the showings"),
    boundedRead(db.from("rift_listing_reviews").select("week_of,metrics,summary,decision,decision_note,actor_label,created_at").eq("journey_id", journeyId).eq("agent_id", agentId).order("week_of").limit(200), "the reviews"),
  ]);
  for (const r of [ev, sh, rv]) if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  return done({
    events: rows(ev).map(shapeEvent),
    showings: showingsFrom(rows(sh).map((s): ShowingRow => ({
      key: s.showing_key as string, startsAt: s.starts_at as string, state: s.state as ShowingState,
      showingAgent: (s.showing_agent as string | null) ?? null, feedback: (s.feedback as string | null) ?? null,
      interest: (s.interest as Interest | null) ?? null, by: s.actor_label as string, at: s.created_at as string,
    }))),
    reviews: rows(rv).map((r) => ({
      weekOf: r.week_of as string, metrics: (r.metrics as string | null) ?? null, summary: r.summary as string,
      decision: r.decision as Review["decision"], decisionNote: (r.decision_note as string | null) ?? null, by: r.actor_label as string, at: r.created_at as string,
    })),
  });
}

/**
 * Every sale being marketed, with what its schedule needs: the listing's
 * events, when it was last reviewed, and the latest pricing opinion's review
 * day. For Today (lib/core/seller-cadence.ts). Null when the seller tables
 * are not there yet.
 */
export async function saleCadences(agentId: string): Promise<DbResult<SaleCadence[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const j = await boundedRead(db.from("rift_journeys").select("id,label,origin_lead_id").eq("agent_id", agentId).eq("side", "sell").limit(300), "the sales");
  if (!j.ok) return MISSING.test(j.error) ? done(null) : j;
  const sales = rows(j);
  if (!sales.length) return done([]);
  const ids = sales.map((x) => x.id as string);
  const leadIds = [...new Set(sales.map((x) => x.origin_lead_id as string))];
  const [ev, rv, op, st, ld] = await Promise.all([
    boundedRead(db.from("rift_listing_events").select("journey_id,kind,detail,url,price_cents,actor_label,created_at").eq("agent_id", agentId).in("journey_id", ids).order("created_at").limit(5000), "the listings"),
    boundedRead(db.from("rift_listing_reviews").select("journey_id,created_at").eq("agent_id", agentId).in("journey_id", ids).order("created_at").limit(5000), "the weekly reviews"),
    boundedRead(db.from("rift_pricing_opinions").select("id,journey_id,version,review_on").eq("agent_id", agentId).in("journey_id", ids).order("version").limit(3000), "the pricing"),
    boundedRead(db.from("rift_journey_events").select("journey_id,seq,to_value").eq("agent_id", agentId).eq("kind", "stage").in("journey_id", ids).order("seq").limit(8000), "the sales' stages"),
    boundedRead(db.from("rift_leads").select("id,name,email").eq("agent_id", agentId).in("id", leadIds), "the sellers"),
  ]);
  for (const r of [ev, rv, op, st, ld]) if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  const group = <T,>(list: Record<string, unknown>[], f: (x: Record<string, unknown>) => T) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.journey_id as string, [...(m.get(x.journey_id as string) ?? []), f(x)]);
    return m;
  };
  const events = group(rows(ev), shapeEvent);
  const reviews = group(rows(rv), (x) => x.created_at as string);
  const opinions = group(rows(op), (x) => ({ id: x.id as string, version: x.version as number, reviewOn: x.review_on as string }));
  /* The seller's answers to each sale's current version only: an answer to a superseded one has been answered. */
  const latestIds = [...opinions.values()].flatMap((l) => (l.length ? [l.at(-1)!.id] : []));
  const ans = latestIds.length
    ? await boundedRead(db.from("rift_pricing_responses").select("opinion_id,member_id,response,note,created_at").eq("agent_id", agentId).in("opinion_id", latestIds).order("created_at").limit(1000), "the sellers' answers")
    : null;
  if (ans && !ans.ok) return MISSING.test(ans.error) ? done(null) : ans;
  const answerRows = ans ? rows(ans) : [];
  const memberIds = [...new Set(answerRows.map((a) => a.member_id as string))];
  const mem = memberIds.length ? await boundedRead(db.from("rift_journey_members").select("id,display_name,email").in("id", memberIds), "who answered") : null;
  if (mem && !mem.ok) return mem;
  const memberName = new Map((mem ? rows(mem) : []).map((m) => [m.id as string, ((m.display_name as string | null) ?? "").trim() || (m.email as string | null) || "The seller"]));
  const answerOf = new Map<string, SaleCadence["answer"]>();
  for (const a of answerRows) {
    answerOf.set(a.opinion_id as string, {
      response: a.response as "agree" | "discuss", note: (a.note as string | null) ?? null,
      by: memberName.get(a.member_id as string) ?? "The seller", at: a.created_at as string,
    });
  }
  const stages = group(rows(st), (x) => x.to_value as Stage);
  const nameOf = new Map(rows(ld).map((l) => [l.id as string, ((l.name as string | null) ?? "").trim() || (l.email as string | null) || "A seller"]));
  return done(sales.map((x) => {
    const id = x.id as string;
    const latest = opinions.get(id)?.at(-1) ?? null;
    return {
      journeyId: id, label: x.label as string, person: nameOf.get(x.origin_lead_id as string) ?? "A seller",
      /* No stage event yet is the first stage; a sale is never hidden for lack of one. */
      stage: stages.get(id)?.at(-1) ?? "prepare",
      listing: events.get(id) ?? [], lastReviewAt: reviews.get(id)?.at(-1) ?? null,
      latestOpinion: latest ? { version: latest.version, reviewOn: latest.reviewOn } : null,
      answer: latest ? answerOf.get(latest.id) ?? null : null,
    };
  }));
}

async function scope() {
  const db = serviceClient();
  if (!db) return { db: null, agentId: null, why: "no database configured" } as const;
  const agentId = await currentAgentId();
  if (!agentId) return { db: null, agentId: null, why: "not signed in" } as const;
  return { db, agentId, why: null } as const;
}

const writeFailed = (error: string, what: string): DbResult<never> => {
  if (/selling journeys/.test(error)) return failed(`${what} belongs to a selling journey`);
  return MISSING.test(error) ? failed(`${what} needs migration 20260928050000`) : failed(error);
};

export async function recordListingEvent(journeyId: string, input: { kind: string; detail: string; url: string | null; price: number | null }, by: string, requestId: string): Promise<DbResult<{ recorded: true }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const cur = await listingOf(journeyId, s.agentId);
  if (!cur.ok || !("data" in cur)) return cur as DbResult<never>;
  const bad = listingError(input, cur.data?.events ?? []);
  if (bad) return failed(bad);
  const w = await boundedWrite(s.db.from("rift_listing_events").insert({
    agent_id: s.agentId, journey_id: journeyId, kind: input.kind, detail: input.detail.trim(), url: input.url?.trim() || null,
    price_cents: input.price === null ? null : Math.round(input.price * 100), actor_label: by.slice(0, 120), request_id: requestId,
  }), "the listing");
  if (!w.ok) return /duplicate key/.test(w.error) ? done({ recorded: true as const }) : writeFailed(w.error, "The listing");
  return done({ recorded: true as const });
}

/** A new showing (no key) or the next step of one (its key). */
export async function recordShowing(journeyId: string, input: {
  key: string | null; startsAt: string; state: string; showingAgent: string | null; feedback: string | null; interest: string | null;
}, by: string, requestId: string, now = new Date()): Promise<DbResult<{ key: string }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const cur = await listingOf(journeyId, s.agentId);
  if (!cur.ok || !("data" in cur)) return cur as DbResult<never>;
  const previous = input.key ? (cur.data?.showings ?? []).find((x) => x.key === input.key) ?? null : null;
  if (input.key && !previous) return failed("That showing is not on this listing. Reload");
  const bad = showingError(input, previous, now);
  if (bad) return failed(bad);
  const key = input.key ?? randomUUID();
  const w = await boundedWrite(s.db.from("rift_listing_showings").insert({
    agent_id: s.agentId, journey_id: journeyId, showing_key: key, starts_at: new Date(input.startsAt).toISOString(), state: input.state,
    showing_agent: input.showingAgent?.trim() || previous?.showingAgent || null, feedback: input.feedback?.trim() || null,
    interest: input.interest || null, actor_label: by.slice(0, 120), request_id: requestId,
  }), "the showing");
  if (!w.ok) return /duplicate key/.test(w.error) ? done({ key }) : writeFailed(w.error, "A showing");
  return done({ key });
}

export async function recordReview(journeyId: string, input: { weekOf: string; metrics: string | null; summary: string; decision: string; decisionNote: string | null }, by: string, requestId: string, now = new Date()): Promise<DbResult<{ recorded: true }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const bad = reviewError(input, marketDay(now));
  if (bad) return failed(bad);
  const w = await boundedWrite(s.db.from("rift_listing_reviews").insert({
    agent_id: s.agentId, journey_id: journeyId, week_of: input.weekOf, metrics: input.metrics?.trim() || null, summary: input.summary.trim(),
    decision: input.decision, decision_note: input.decisionNote?.trim() || null, actor_label: by.slice(0, 120), request_id: requestId,
  }), "the review");
  if (!w.ok) return /duplicate key/.test(w.error) ? done({ recorded: true as const }) : writeFailed(w.error, "A review");
  return done({ recorded: true as const });
}
