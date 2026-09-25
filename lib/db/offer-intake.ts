import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { captureLead } from "./leads";
import type { Submission } from "@/lib/core/offer-intake";

/**
 * Storing an offer that arrived from outside.
 *
 * Two writes, in an order that matters. The OFFER is written first and the
 * lead second, because the offer is the thing the submitter actually came to
 * deliver and the lead is what the business gets out of it. If the second
 * write fails, somebody's offer is still on file and Kaleb can still act on
 * it; the reverse would mean a relationship in the pipeline with no offer
 * attached and nothing to talk about.
 *
 * Neither failure is allowed to reach the submitter as an error. They have
 * already been given the reading of their own offer: that happened in the
 * browser, from pure arithmetic, before any of this, so the worst honest
 * outcome here is "we could not pass this on", which is what they are told.
 */

export interface StoredOffer {
  offerId: string | null;
  leadId: string | null;
  /** True when the offer itself was written, whatever happened to the lead. */
  delivered: boolean;
}

export async function submitOffer(s: Submission, meta: { sessionId?: string; ip?: string; userAgent?: string } = {}): Promise<DbResult<StoredOffer>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured, so nothing was passed on");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet, so nothing was passed on");

  try {
    const offer = await boundedWrite(
      db.from("rift_offers").insert({
        agent_id,
        /* No seller lead. The form takes any Georgia address on purpose: an
           offer on a listing Kaleb does not hold is still somebody worth
           meeting, and refusing it would turn away the relationship this
           whole feature exists to produce. */
        lead_id: null,
        source: "inbound",
        property_address: s.address,
        offered_by: s.from,
        price_cents: Math.round(s.price * 100),
        concessions_cents: Math.round(s.concessions * 100),
        repair_credit_cents: Math.round(s.repairCredit * 100),
        earnest_cents: Math.round(s.earnest * 100),
        financing: s.financing,
        financing_detail: s.financingDetail,
        due_diligence_days: s.dueDiligenceDays,
        close_on: s.closeOn,
        contingencies: s.contingencies,
        preapproval: s.preapproval,
        proof_of_funds: s.proofOfFunds,
        note: s.note,
        submitted_email: s.email,
        submitted_phone: s.phone,
        submitted_firm: s.firm,
        representing: s.representing,
      }).select("id").maybeSingle(),
      "the offer",
    );

    if (!offer.ok) return offer;
    const offerId = ("data" in offer ? (offer.data as { id: string } | null)?.id : null) ?? null;

    /**
     * The relationship.
     *
     * Side is "buy" whichever box they ticked. A buyer's agent submitting on
     * behalf of a client is not themselves buying, but what Kaleb needs from
     * this row is a person on the buying side of a transaction he is involved
     * in, and the alternative, a third side the pipeline does not have, would
     * put them in a stage list that has no stages for them.
     */
    const lead = await captureLead({
      assessmentId: null,
      sessionId: meta.sessionId,
      side: "buy",
      name: s.from,
      email: s.email,
      /* The phone is deliberately dropped. A number given to deliver an offer
         is not written consent to be called about anything else, and
         captureLead stores no number without one: holding a number you may
         not lawfully ring is pure liability. */
      lead: {
        side: "buy",
        timing: "Submitted an offer",
        /* They gave a full set of terms on a specific address. There is no
           more complete signal of intent in this product. */
        completion: 1,
        hoursSince: 0,
        value: s.price,
        monthsToReady: 0,
        coBuyer: s.representing === "buyer",
        contactable: true,
        source: "offer",
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const leadId = lead.ok && "data" in lead ? lead.data.id : null;

    /* Best effort, and it says so by returning null rather than failing. The
       offer is on file either way. */
    if (offerId && leadId) {
      await boundedWrite(
        db.from("rift_offers").update({ submitter_lead_id: leadId }).eq("id", offerId),
        "the link between the offer and its sender",
      );
    }

    return done({ offerId, leadId, delivered: offerId !== null });
  } catch (e) {
    return failed(e);
  }
}

/**
 * Offers that arrived through the form, newest first.
 *
 * Read separately from `offersFor(leadId)` because these have no seller lead
 * to hang off: that is what makes them inbound. The Studio queue shows them
 * so a submission cannot sit in a table nobody reads, which is the only
 * failure mode that would make the whole feature worse than not having it:
 * an offer somebody believes was delivered, on a document with a deadline.
 */
export interface InboundOffer {
  id: string;
  address: string | null;
  from: string;
  email: string | null;
  phone: string | null;
  firm: string | null;
  representing: string | null;
  price: number;
  concessions: number;
  repairCredit: number;
  earnest: number;
  financing: string;
  financingDetail: string | null;
  dueDiligenceDays: number | null;
  closeOn: string | null;
  contingencies: string[];
  preapproval: boolean;
  proofOfFunds: boolean;
  note: string | null;
  submitterLeadId: string | null;
  at: string;
}

export async function inboundOffers(limit = 50): Promise<DbResult<InboundOffer[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("not signed in");

  const r = await boundedRead(
    db.from("rift_offers")
      .select("id,property_address,offered_by,submitted_email,submitted_phone,submitted_firm,representing,price_cents,concessions_cents,repair_credit_cents,earnest_cents,financing,financing_detail,due_diligence_days,close_on,contingencies,preapproval,proof_of_funds,note,submitter_lead_id,created_at")
      .eq("agent_id", agent_id).eq("source", "inbound")
      .order("created_at", { ascending: false }).limit(limit),
    "the offers that came in",
  );
  if (!r.ok) return r;

  const rows = ("data" in r ? r.data : []) as Record<string, unknown>[];
  return done(rows.map((o) => ({
    id: o.id as string,
    address: (o.property_address as string | null) ?? null,
    from: o.offered_by as string,
    email: (o.submitted_email as string | null) ?? null,
    phone: (o.submitted_phone as string | null) ?? null,
    firm: (o.submitted_firm as string | null) ?? null,
    representing: (o.representing as string | null) ?? null,
    price: Number(o.price_cents ?? 0) / 100,
    concessions: Number(o.concessions_cents ?? 0) / 100,
    repairCredit: Number(o.repair_credit_cents ?? 0) / 100,
    earnest: Number(o.earnest_cents ?? 0) / 100,
    financing: o.financing as string,
    financingDetail: (o.financing_detail as string | null) ?? null,
    dueDiligenceDays: o.due_diligence_days === null || o.due_diligence_days === undefined ? null : Number(o.due_diligence_days),
    closeOn: (o.close_on as string | null) ?? null,
    contingencies: (o.contingencies as string[] | null) ?? [],
    preapproval: o.preapproval === true,
    proofOfFunds: o.proof_of_funds === true,
    note: (o.note as string | null) ?? null,
    submitterLeadId: (o.submitter_lead_id as string | null) ?? null,
    at: o.created_at as string,
  })));
}
