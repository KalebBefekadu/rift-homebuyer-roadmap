import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import type { Financing, Offer, SellerCosts } from "@/lib/core/offers";

/**
 * Offers, and the one control that matters: release.
 *
 * Money crosses this boundary in CENTS and becomes dollars exactly once, here.
 * The comparison subtracts six figures from six figures and then ranks the
 * differences, which is precisely where a binary float puts a dollar in the
 * wrong place and changes which offer wins.
 *
 * Nothing the seller can read is returned by anything except
 * `releasedOffersFor`, which filters on `released_at` in the query rather than
 * after it — a filter applied in JavaScript is one refactor away from being
 * dropped, and what it is protecting is an unreviewed offer landing in front
 * of somebody while the agent is driving.
 */

const CENTS = 100;
const toMoney = (cents: unknown) => Number(cents ?? 0) / CENTS;
const toCents = (money: number) => Math.round(money * CENTS);

const COLUMNS =
  "id,offered_by,price_cents,concessions_cents,repair_credit_cents,earnest_cents," +
  "financing,close_on,contingencies,preapproval,proof_of_funds,note,released_at,created_at";

function shape(r: Record<string, unknown>): Offer {
  return {
    id: r.id as string,
    from: r.offered_by as string,
    price: toMoney(r.price_cents),
    concessions: toMoney(r.concessions_cents),
    repairCredit: toMoney(r.repair_credit_cents),
    earnest: toMoney(r.earnest_cents),
    financing: r.financing as Financing,
    closeOn: (r.close_on as string | null) ?? null,
    contingencies: (r.contingencies as string[] | null) ?? [],
    preapproval: Boolean(r.preapproval),
    proofOfFunds: Boolean(r.proof_of_funds),
    note: (r.note as string | null) ?? null,
    releasedAt: (r.released_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export interface NewOffer {
  leadId: string;
  from: string;
  price: number;
  concessions?: number;
  repairCredit?: number;
  earnest?: number;
  financing: Financing;
  closeOn?: string | null;
  contingencies?: string[];
  preapproval?: boolean;
  proofOfFunds?: boolean;
  note?: string | null;
}

export async function addOffer(input: NewOffer): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const from = input.from.trim();
  if (from.length < 2) return failed("say who the offer is from");
  if (!(input.price > 0)) return failed("an offer needs a price");

  const created = await boundedWrite(
    db.from("rift_offers").insert({
      agent_id,
      lead_id: input.leadId,
      offered_by: from.slice(0, 120),
      price_cents: toCents(input.price),
      concessions_cents: toCents(Math.max(0, input.concessions ?? 0)),
      repair_credit_cents: toCents(Math.max(0, input.repairCredit ?? 0)),
      earnest_cents: toCents(Math.max(0, input.earnest ?? 0)),
      financing: input.financing,
      close_on: input.closeOn || null,
      contingencies: (input.contingencies ?? []).map((c) => c.trim().slice(0, 80)).filter(Boolean).slice(0, 12),
      preapproval: Boolean(input.preapproval),
      proof_of_funds: Boolean(input.proofOfFunds),
      note: input.note?.trim().slice(0, 2000) || null,
      /* Never released on arrival. The default is the control. */
    }).select("id").single(),
    "the offer",
  );
  if (!created.ok) return created;
  const row = ("data" in created ? created.data : null) as { id: string } | null;
  if (!row) return failed("the offer was not returned after insert");
  return done({ id: row.id });
}

/** Everything on this seller, released or not. The agent's view. */
export async function offersFor(leadId: string): Promise<DbResult<{ offers: Offer[]; costs: SellerCosts | null }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const [rows, lead] = await Promise.all([
    boundedRead(
      db.from("rift_offers").select(COLUMNS)
        .eq("lead_id", leadId).eq("agent_id", agent_id)
        .order("created_at", { ascending: false }).limit(50),
      "the offers",
    ),
    boundedRead(
      db.from("rift_leads").select("payoff_cents,commission_pct")
        .eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
      "the seller's costs",
    ),
  ]);

  if (!rows.ok) return rows;

  /* Null rather than a default. A comparison run against an assumed payoff of
     zero would rank offers correctly and report a net that is out by the size
     of somebody's mortgage — and it would look entirely reasonable. */
  const l = lead.ok && "data" in lead ? (lead.data as { payoff_cents: number | null; commission_pct: number | null } | null) : null;
  const costs: SellerCosts | null =
    l && l.payoff_cents !== null && l.commission_pct !== null
      ? { payoff: toMoney(l.payoff_cents), commissionPct: Number(l.commission_pct) }
      : null;

  return done({
    offers: ("data" in rows ? (rows.data as unknown as Record<string, unknown>[]) : []).map(shape),
    costs,
  });
}

/**
 * What the seller is allowed to see.
 *
 * Filtered in the QUERY. A filter applied after the read is one refactor away
 * from being dropped, and what it protects is an unreviewed offer appearing in
 * front of somebody before anybody has read the terms under it.
 */
export async function releasedOffersFor(leadId: string): Promise<DbResult<Offer[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  const rows = await boundedRead(
    db.from("rift_offers").select(COLUMNS)
      .eq("lead_id", leadId)
      .not("released_at", "is", null)
      .order("created_at", { ascending: false }).limit(50),
    "the offers",
  );
  if (!rows.ok) return rows;
  return done(("data" in rows ? (rows.data as unknown as Record<string, unknown>[]) : []).map(shape));
}

/** Release it, or take it back. */
export async function setOfferReleased(offerId: string, released: boolean): Promise<DbResult<{ released: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const wrote = await boundedWrite(
    db.from("rift_offers")
      .update({ released_at: released ? new Date().toISOString() : null })
      .eq("id", offerId).eq("agent_id", agent_id),
    "the offer",
  );
  if (!wrote.ok) return wrote;
  return done({ released });
}

export async function removeOffer(offerId: string): Promise<DbResult<{ removed: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const gone = await boundedWrite(
    db.from("rift_offers").delete().eq("id", offerId).eq("agent_id", agent_id),
    "the offer",
  );
  if (!gone.ok) return gone;
  return done({ removed: true as const });
}

/** The two figures every offer's net depends on. */
export async function setSellerCosts(leadId: string, payoff: number, commissionPct: number): Promise<DbResult<SellerCosts>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  if (!(payoff >= 0)) return failed("a payoff cannot be negative");
  if (!(commissionPct >= 0 && commissionPct <= 20)) return failed("that commission is not a percentage");

  const wrote = await boundedWrite(
    db.from("rift_leads")
      .update({ payoff_cents: toCents(payoff), commission_pct: commissionPct })
      .eq("id", leadId).eq("agent_id", agent_id),
    "the seller's costs",
  );
  if (!wrote.ok) return wrote;
  return done({ payoff, commissionPct });
}
