import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";

/**
 * Whether an offer that came in through the form has been answered, and the
 * day the sender needs an answer by (migration 20261004100000).
 *
 * The newest row for an offer is its state. Before any row exists the board
 * falls back to the old signal: a human reply to the lead behind the offer
 * since it arrived. A recorded answer wins over that signal either way, so
 * "not answered yet" can be said of an offer whose sender happened to get an
 * unrelated reply.
 */
export interface OfferAnswer {
  answered: boolean;
  /** YYYY-MM-DD, Georgia's day. */
  respondBy: string | null;
  by: string;
  at: string;
}

const MISSING = /rift_offer_answers|does not exist|schema cache/;

/** The newest answer for each offer. `null` when the table is not migrated yet. */
export async function offerAnswers(offerIds: string[]): Promise<DbResult<Map<string, OfferAnswer> | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!offerIds.length) return done(new Map());
  const r = await boundedReport(
    db.from("rift_offer_answers").select("offer_id,answered,respond_by,actor_label,created_at")
      .in("offer_id", offerIds).order("created_at", { ascending: false }).limit(2000),
    "whether the offers were answered",
  );
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  const out = new Map<string, OfferAnswer>();
  for (const row of ("data" in r ? r.data : []) as Record<string, unknown>[]) {
    const id = row.offer_id as string;
    if (out.has(id)) continue;
    out.set(id, {
      answered: row.answered === true,
      respondBy: (row.respond_by as string | null) ?? null,
      by: row.actor_label as string,
      at: row.created_at as string,
    });
  }
  return done(out);
}

/** Records the offer's state as the agent set it: a new row, never an edit. */
export async function recordOfferAnswer(input: {
  offerId: string;
  answered: boolean;
  respondBy: string | null;
  actor: string;
}): Promise<DbResult<null>> {
  if (input.respondBy !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.respondBy)) return failed("The respond-by date is not a date");
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  /* Only an inbound offer of this agent's. The id arrives from a page, and a
     server action is a public endpoint. */
  const owns = await boundedReport(
    db.from("rift_offers").select("id").eq("id", input.offerId).eq("agent_id", agentId).eq("source", "inbound").maybeSingle(),
    "the offer",
  );
  if (!owns.ok) return owns;
  if (!("data" in owns) || !owns.data) return failed("That offer is not one that came in through the form");

  const w = await boundedWrite(
    db.from("rift_offer_answers").insert({
      agent_id: agentId, offer_id: input.offerId, answered: input.answered,
      respond_by: input.respondBy, actor_label: input.actor.slice(0, 200) || "the agent",
    }),
    "the answer",
  );
  if (!w.ok) {
    return MISSING.test(w.error) ? failed("The database update that records this (20261004100000) has not been applied yet") : w;
  }
  return done(null);
}
