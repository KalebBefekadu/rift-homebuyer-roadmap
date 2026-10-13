import "server-only";
import { serviceClient } from "./service";
import { boundedReport } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { sellerRoomOf, type SellerRoom } from "./plan";
import { releasedFor } from "./decisions";
import { canRespond } from "@/lib/core/journey";
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
