import "server-only";
import { serviceClient } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { sellerRoomOf, type SellerRoom } from "./plan";
import { releasedFor } from "./decisions";
import { canRespond } from "@/lib/core/journey";
import { nextSeen } from "@/lib/core/since";
import type { Decision } from "@/lib/core/decision";
import type { Membership } from "./portal";

/**
 * What used to live only on the old plan link, for a member signed in to the
 * portal: the offers on their home and their choice, and the decisions the
 * agent released (audit portals-2026-10, items 4 and 8).
 *
 * Before this the client had two homes. A seller at Review offers was told
 * "Nothing is waiting on you" in the portal while choosing an offer on the
 * plan link, and AT04 already says authenticated decisions belong behind a
 * sign-in rather than behind a link anybody it was forwarded to can open.
 *
 * Who sees what, decided here and nowhere else:
 *   - only a buyer or co-buyer (a seller or co-seller on a sale); a viewer
 *     sees neither, as with the contract's work (clientProgress);
 *   - only with "Price and fees": every offer and most decisions are prices;
 *   - offers only on a sale.
 * The lead is found from the member's journey, scoped to its agent, so the
 * membership is the only authority, as everywhere in lib/db/portal.ts.
 */
export interface ClientRoom {
  leadId: string;
  /** Null on a purchase, or without the access to see it. */
  room: SellerRoom | null;
  decisions: Decision[];
}

export async function clientRoom(m: Membership): Promise<DbResult<ClientRoom | null>> {
  if (!canRespond(m.role) || !m.scopes.includes("money")) return done(null);
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const j = await boundedReport(
    db.from("rift_journeys").select("origin_lead_id").eq("id", m.journeyId).eq("agent_id", m.agentId).maybeSingle(),
    "your offers and decisions",
  );
  if (!j.ok) return j as DbResult<never>;
  const leadId = (("data" in j ? j.data : null) as { origin_lead_id: string } | null)?.origin_lead_id;
  if (!leadId) return done(null);

  const [room, decisions] = await Promise.all([
    m.side === "sell" ? sellerRoomOf(leadId) : Promise.resolve(null),
    releasedFor(leadId, m.agentId),
  ]);
  /* A failed decisions read costs the decisions, never the offers. */
  return done({ leadId, room, decisions: decisions.ok && "data" in decisions ? decisions.data : [] });
}

/**
 * The household's own referral link, for after the closing (audit
 * portals-2026-10, item 6). The same card for everybody whose move closed,
 * whatever their mood or the advocacy queue says (contract 4.9): this is a
 * link they can pass on, not an ask.
 *
 * Read, never minted: the column has a default, and a page a client opens
 * does not write to the agent's records. A lead without one shows no card.
 */
export async function clientReferralLink(m: Membership, origin: string | null): Promise<string | null> {
  if (!canRespond(m.role) || !origin) return null;
  const db = serviceClient();
  if (!db) return null;
  const j = await boundedReport(
    db.from("rift_journeys").select("origin_lead_id").eq("id", m.journeyId).eq("agent_id", m.agentId).maybeSingle(),
    "your journey",
  );
  const leadId = j.ok && "data" in j ? (j.data as { origin_lead_id: string } | null)?.origin_lead_id : null;
  if (!leadId) return null;
  const r = await boundedReport(
    db.from("rift_leads").select("referral_token").eq("id", leadId).eq("agent_id", m.agentId).maybeSingle(),
    "your link to pass on",
  );
  const token = r.ok && "data" in r ? (r.data as { referral_token: string | null } | null)?.referral_token : null;
  return token ? `${origin}/buy?r=${encodeURIComponent(token)}` : null;
}

/**
 * When this member last looked, for "Since you last looked" (audit
 * portals-2026-10, item 10). The member's own page moves the visit on; the
 * agent's preview only reads, so previewing never changes what the client is
 * shown. A failed read or write shows nothing rather than a wrong list.
 */
export async function lastLook(m: Membership, opts: { record: boolean }): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  const r = await boundedReport(
    db.from("rift_journey_members").select("seen_at,seen_before").eq("id", m.memberId).eq("journey_id", m.journeyId).maybeSingle(),
    "your last visit",
  );
  if (!r.ok || !("data" in r) || !r.data) return null;
  const cur = r.data as { seen_at: string | null; seen_before: string | null };
  const next = nextSeen({ seenAt: cur.seen_at, seenBefore: cur.seen_before });
  if (opts.record && next.write) {
    const w = await boundedWrite(
      db.from("rift_journey_members").update({ seen_at: next.write.seenAt, seen_before: next.write.seenBefore })
        .eq("id", m.memberId).eq("journey_id", m.journeyId),
      "your visit",
    );
    if (!w.ok) return null;
  }
  return opts.record ? next.since : cur.seen_at;
}
