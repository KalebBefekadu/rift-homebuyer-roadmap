import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { marketDay } from "@/lib/core/progress";
import { pricingError, type Comp, type Opinion, type PricingInput } from "@/lib/core/pricing";
import { figureError, type Figure, type FigureInput, type FigureKind, type OwedSource } from "@/lib/core/proceeds";
import type { Membership } from "./portal";
import { canRespond } from "@/lib/core/journey";

/**
 * The only reader and writer of a sale's pricing and proceeds (S04, S16).
 * Rules: lib/core/pricing.ts and lib/core/proceeds.ts. Null means the tables
 * are not there yet (migration 20260928040000).
 */

const MISSING = /rift_pricing|rift_seller_figures|does not exist|schema cache/;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);
const cents = (d: number) => Math.round(d * 100);
const dollars = (c: unknown) => Number(c) / 100;

export interface SellerMoney { opinions: Opinion[]; figures: Figure[] }

export async function sellerMoney(journeyId: string, agentId: string): Promise<DbResult<SellerMoney | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const [ops, figs] = await Promise.all([
    boundedRead(db.from("rift_pricing_opinions").select("id,version,list_price_cents,low_cents,high_cents,comps,rationale,review_on,actor_label,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("version").limit(50), "the pricing"),
    boundedRead(db.from("rift_seller_figures").select("kind,price_cents,owed_cents,owed_source,commission_pct,credits_cents,official_net_cents,source,as_of,note,actor_label,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at").limit(100), "the proceeds"),
  ]);
  for (const r of [ops, figs]) if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  const opinionIds = rows(ops).map((o) => o.id as string);
  const resp = opinionIds.length
    ? await boundedRead(db.from("rift_pricing_responses").select("opinion_id,member_id,response,note,created_at").eq("agent_id", agentId).in("opinion_id", opinionIds).order("created_at").limit(200), "their answers")
    : done([]);
  if (!resp.ok) return resp;
  const memberIds = [...new Set(rows(resp).map((r) => r.member_id as string))];
  const members = memberIds.length
    ? await boundedRead(db.from("rift_journey_members").select("id,display_name,email").in("id", memberIds), "who answered")
    : done([]);
  const nameOf = new Map(rows(members).map((m) => [m.id as string, ((m.display_name as string | null) ?? "").trim() || (m.email as string)]));
  return done({
    opinions: rows(ops).map((o) => ({
      id: o.id as string, version: o.version as number, listPrice: dollars(o.list_price_cents), low: dollars(o.low_cents), high: dollars(o.high_cents),
      comps: o.comps as Comp[], rationale: o.rationale as string, reviewOn: o.review_on as string, by: o.actor_label as string, at: o.created_at as string,
      /* The latest answer from each person to this version. */
      responses: [...new Map(rows(resp).filter((r) => r.opinion_id === o.id).map((r) => [r.member_id as string, {
        memberId: r.member_id as string, name: nameOf.get(r.member_id as string) ?? "Someone", response: r.response as "agree" | "discuss",
        note: (r.note as string | null) ?? null, at: r.created_at as string,
      }])).values()],
    })),
    figures: rows(figs).map((f) => ({
      kind: f.kind as FigureKind, price: dollars(f.price_cents), owed: dollars(f.owed_cents), owedSource: f.owed_source as OwedSource,
      commissionPct: f.commission_pct === null ? null : Number(f.commission_pct), credits: dollars(f.credits_cents),
      officialNet: f.official_net_cents === null ? null : dollars(f.official_net_cents), source: f.source as string, asOf: f.as_of as string,
      note: (f.note as string | null) ?? null, by: f.actor_label as string, at: f.created_at as string,
    })),
  });
}

export async function sellerMoneyFor(journeyId: string) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  return sellerMoney(journeyId, agentId);
}

export async function recordOpinion(journeyId: string, input: PricingInput, expectedVersion: number, by: string, requestId: string, now = new Date()): Promise<DbResult<{ version: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const bad = pricingError(input, marketDay(now));
  if (bad) return failed(bad);
  const w = await boundedWrite(db.from("rift_pricing_opinions").insert({
    agent_id: agentId, journey_id: journeyId, version: expectedVersion + 1,
    list_price_cents: cents(input.listPrice), low_cents: cents(input.low), high_cents: cents(input.high),
    comps: input.comps.map((c) => ({ address: c.address.trim(), price: c.price, status: c.status, on: c.on, note: c.note.trim() })),
    rationale: input.rationale.trim(), review_on: input.reviewOn, actor_label: by.slice(0, 120), request_id: requestId,
  }), "the pricing");
  if (!w.ok) {
    if (/rift_pricing_opinions_request/.test(w.error)) return done({ version: expectedVersion + 1 });
    if (/rift_pricing_opinions_version|duplicate key/.test(w.error)) return failed("The pricing changed since the page loaded. Reload and try again");
    if (/selling journeys/.test(w.error)) return failed("Pricing belongs to a selling journey");
    return MISSING.test(w.error) ? failed("Pricing needs migration 20260928040000") : w;
  }
  return done({ version: expectedVersion + 1 });
}

export async function recordFigure(journeyId: string, input: FigureInput, by: string, requestId: string, now = new Date()): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const bad = figureError(input, marketDay(now));
  if (bad) return failed(bad);
  const w = await boundedWrite(db.from("rift_seller_figures").insert({
    agent_id: agentId, journey_id: journeyId, kind: input.kind, price_cents: cents(input.price), owed_cents: cents(input.owed),
    owed_source: input.owedSource, commission_pct: input.commissionPct, credits_cents: cents(input.credits),
    official_net_cents: input.officialNet === null ? null : cents(input.officialNet), source: input.source.trim(), as_of: input.asOf,
    note: input.note?.trim() || null, actor_label: by.slice(0, 120), request_id: requestId,
  }), "the figures");
  if (!w.ok) {
    if (/rift_seller_figures_request|duplicate key/.test(w.error)) return done({ recorded: true as const });
    if (/selling journeys/.test(w.error)) return failed("Proceeds belong to a selling journey");
    return MISSING.test(w.error) ? failed("Proceeds need migration 20260928040000") : w;
  }
  return done({ recorded: true as const });
}

/** A seller's answer to the latest pricing version. Only someone who can answer, on this journey. */
export async function respondToPricing(m: Membership, opinionId: string, response: "agree" | "discuss", note: string | null): Promise<DbResult<{ response: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (m.side !== "sell") return failed("Pricing belongs to a sale");
  if (!canRespond(m.role)) return failed("Your access lets you see this, not answer it");
  const o = await boundedRead(db.from("rift_pricing_opinions").select("id,version,journey_id").eq("journey_id", m.journeyId).eq("agent_id", m.agentId).order("version", { ascending: false }).limit(1), "the pricing");
  if (!o.ok) return o;
  const latest = rows(o)[0];
  if (!latest || latest.id !== opinionId) return failed("This pricing has been revised. Reload to see the latest");
  if (!["agree", "discuss"].includes(response)) return failed("Choose an answer");
  const w = await boundedWrite(db.from("rift_pricing_responses").insert({
    agent_id: m.agentId, opinion_id: opinionId, member_id: m.memberId, response, note: note?.trim().slice(0, 500) || null,
  }), "your answer");
  return w.ok ? done({ response }) : w;
}
