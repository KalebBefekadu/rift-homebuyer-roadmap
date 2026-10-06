import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedReport } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { shapeSteps } from "./bids";
import { inboundOffers, type InboundOffer } from "./offer-intake";
import type { BidResponse, Instruction } from "@/lib/core/bid";
import { pendingUploads, type PendingUpload } from "./offer-upload";
import { bidItem, inboundItem, orderItems, sellerItem, streetOf, uploadItem, type OfferItem } from "@/lib/core/offer-board";

/**
 * Every live offer, both sides, in a bounded number of reads (the Offers page).
 * The rules are lib/core/offer-board.ts; this only reads and joins.
 *
 * Three sources, each allowed to fail on its own. A seller's offers that read
 * and a buyer's that did not must not render as "no buyer offers": the page
 * names the part that did not load, because a counter nobody saw is the whole
 * cost of this page being wrong.
 */

export interface Board {
  items: OfferItem[];
  /** The offers that came in through the form, in full, for the detail view. */
  inbound: InboundOffer[];
  /** PDFs uploaded without the form being sent (WS8.2). */
  uploads: PendingUpload[];
  /** Parts that could not be read, said by name. */
  problems: { part: string; error: string }[];
}

const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);
const first = (...rs: DbResult<unknown>[]) => rs.find((r) => !r.ok) as { ok: false; error: string } | undefined;
const nameOf = (l: Record<string, unknown> | undefined) => ((l?.name as string | null) ?? "").trim() || (l?.email as string | null) || "A client";

export async function offerBoard(agentFirst: string): Promise<DbResult<Board>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const [journeys, homes, bids, steps, responses, transactions, offers, rooms, inbound] = await Promise.all([
    boundedReport(db.from("rift_journeys").select("id,origin_lead_id,side,created_at").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(500), "the journeys"),
    boundedReport(db.from("rift_shortlist_homes").select("id,journey_id,address,withdrawn_at").eq("agent_id", agentId).limit(2000), "the homes"),
    boundedReport(db.from("rift_bids").select("id,journey_id,home_id,created_at").eq("agent_id", agentId).limit(500), "the buyers' offers"),
    boundedReport(db.from("rift_bid_steps").select("bid_id,seq,kind,version,terms,origin,required,document_ids,note,actor_label,created_at").eq("agent_id", agentId).order("seq").limit(5000), "the offer steps"),
    boundedReport(db.from("rift_bid_responses").select("bid_id,member_id,version,instruction,note,told_agent,created_at").eq("agent_id", agentId).limit(5000), "the households' answers"),
    boundedReport(db.from("rift_transactions").select("home_id").eq("agent_id", agentId).limit(500), "the contracts"),
    boundedReport(db.from("rift_offers").select("id,lead_id,offered_by,price_cents,released_at,created_at").eq("agent_id", agentId).not("lead_id", "is", null).limit(1000), "the sellers' offers"),
    boundedReport(db.from("rift_offer_rooms").select("lead_id,approved_at,approved_for,chosen_offer_id,chosen_at").eq("agent_id", agentId).limit(500), "the offer rooms"),
    inboundOffers(100),
  ]);
  const uploadsRead = await pendingUploads(100);

  /* People: whoever a journey or a seller's offer belongs to, and whoever sent
     an inbound offer (for whether they have been answered). One read. */
  const inboundList = inbound.ok && "data" in inbound ? inbound.data : [];
  const leadIds = [...new Set([
    ...rows(journeys).map((j) => j.origin_lead_id as string),
    ...rows(offers).map((o) => o.lead_id as string),
    ...inboundList.map((o) => o.submitterLeadId).filter((x): x is string => Boolean(x)),
  ])];
  const leads = leadIds.length
    ? await boundedReport(db.from("rift_leads").select("id,name,email,human_replied_at").eq("agent_id", agentId).in("id", leadIds), "the people")
    : done([] as Record<string, unknown>[]);
  const leadOf = new Map(rows(leads).map((l) => [l.id as string, l]));

  const problems: Board["problems"] = [];
  const items: OfferItem[] = [];

  /* A seller's property is the home on their journey; a listing an inbound
     offer is addressed to is found by its street. */
  const homeOfJourney = new Map<string, string>();
  for (const h of rows(homes)) if (!h.withdrawn_at && !homeOfJourney.has(h.journey_id as string)) homeOfJourney.set(h.journey_id as string, h.address as string);
  const sellJourneyOf = new Map<string, string>();
  for (const j of rows(journeys)) if (j.side === "sell" && !sellJourneyOf.has(j.origin_lead_id as string)) sellJourneyOf.set(j.origin_lead_id as string, j.id as string);

  /* Buyers' offers. */
  const buyerFail = first(journeys, homes, bids, steps, responses, transactions, leads);
  if (buyerFail) {
    if (!journeyTablesMissing(buyerFail.error)) problems.push({ part: "Buyers' offers", error: buyerFail.error });
  } else {
    const journeyOf = new Map(rows(journeys).map((j) => [j.id as string, j]));
    const homeOf = new Map(rows(homes).map((h) => [h.id as string, h]));
    const contracted = new Set(rows(transactions).map((t) => t.home_id as string));
    const stepsOf = shapeSteps(rows(steps));
    const responsesOf = new Map<string, BidResponse[]>();
    for (const r of rows(responses)) {
      const l = responsesOf.get(r.bid_id as string) ?? [];
      /* The name is not needed to work out whose answer counts. */
      l.push({
        memberId: r.member_id as string, name: "", version: r.version as number, instruction: r.instruction as Instruction,
        note: (r.note as string | null) ?? null, toldAgent: (r.told_agent as string | null) ?? null, at: r.created_at as string,
      });
      responsesOf.set(r.bid_id as string, l);
    }
    for (const b of rows(bids)) {
      const j = journeyOf.get(b.journey_id as string);
      const h = homeOf.get(b.home_id as string);
      if (!j || !h || h.withdrawn_at) continue;
      const leadId = j.origin_lead_id as string;
      const item = bidItem({
        journeyId: j.id as string, leadId, person: nameOf(leadOf.get(leadId)), address: h.address as string,
        steps: stepsOf.get(b.id as string) ?? [], responses: responsesOf.get(b.id as string) ?? [], agentFirst,
        hasContract: contracted.has(b.home_id as string), createdAt: b.created_at as string,
      });
      if (item) items.push({ ...item, key: `bid:${b.id}` });
    }
  }

  /* Sellers' offers. A room that cannot be read is "no take yet", which asks
     the agent for more rather than less, and is said as a problem too. */
  const sellerFail = first(journeys, homes, offers, leads);
  if (sellerFail) problems.push({ part: "Sellers' offers", error: sellerFail.error });
  else {
    if (!rooms.ok && !/rift_offer_rooms/.test(rooms.error)) problems.push({ part: "Sellers' choices and takes", error: rooms.error });
    const roomOf = new Map(rows(rooms).map((r) => [r.lead_id as string, r]));
    const byLead = new Map<string, Record<string, unknown>[]>();
    for (const o of rows(offers)) byLead.set(o.lead_id as string, [...(byLead.get(o.lead_id as string) ?? []), o]);
    for (const [leadId, list] of byLead) {
      const journeyId = sellJourneyOf.get(leadId) ?? null;
      const room = roomOf.get(leadId);
      const item = sellerItem({
        leadId, journeyId, person: nameOf(leadOf.get(leadId)), address: (journeyId && homeOfJourney.get(journeyId)) || "Their home",
        offers: list.map((o) => ({
          id: o.id as string, from: o.offered_by as string, price: Number(o.price_cents ?? 0) / 100,
          releasedAt: (o.released_at as string | null) ?? null, createdAt: o.created_at as string,
        })),
        room: room ? {
          approvedAt: (room.approved_at as string | null) ?? null, approvedFor: (room.approved_for as string[] | null) ?? [],
          chosenOfferId: (room.chosen_offer_id as string | null) ?? null, chosenAt: (room.chosen_at as string | null) ?? null,
        } : null,
      });
      if (item) items.push(item);
    }
  }

  /* Offers that came in through the form. */
  if (!inbound.ok) problems.push({ part: "Offers that came in through the form", error: inbound.error });
  else {
    const listings = new Map<string, { person: string; href: string }>();
    for (const [leadId, journeyId] of sellJourneyOf) {
      const address = homeOfJourney.get(journeyId);
      if (address) listings.set(streetOf(address), { person: nameOf(leadOf.get(leadId)), href: `/operations/journey/${journeyId}?tab=seller-offers` });
    }
    for (const o of inboundList) {
      items.push(inboundItem({
        id: o.id, address: o.address, from: o.from, firm: o.firm, price: o.price, financing: o.financing, financingOther: o.financingOther,
        at: o.at, submitterLeadId: o.submitterLeadId,
        repliedAt: o.submitterLeadId ? ((leadOf.get(o.submitterLeadId)?.human_replied_at as string | null) ?? null) : null,
        answer: o.answer,
        listing: o.address ? listings.get(streetOf(o.address)) ?? null : null,
      }));
    }
  }

  /* PDFs that arrived without the form. Missing tables (not migrated yet) read as none. */
  let uploads: PendingUpload[] = [];
  if (!uploadsRead.ok) problems.push({ part: "Offer PDFs sent without the form", error: uploadsRead.error });
  else if ("data" in uploadsRead && uploadsRead.data) {
    uploads = uploadsRead.data;
    for (const u of uploads) items.push(uploadItem({ id: u.id, name: u.name, phone: u.phone, at: u.at, read: u.read, files: u.files.length }));
  }

  return done({ items: orderItems(items), inbound: inboundList, uploads, problems });
}
