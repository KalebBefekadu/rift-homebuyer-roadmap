import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { type Touch } from "@/lib/core/attribution";

export { stripToHost, touchFromRequest, describeTouch, type Touch } from "@/lib/core/attribution";

/**
 * First-touch attribution.
 *
 * First touch never moves. That is the whole point of first touch — an agent
 * who re-attributes a referral to the retargeting ad that caught it on the way
 * back will keep buying retargeting and stop asking for referrals, which is
 * exactly backwards for a business whose best channel is people.
 *
 * The immutability is enforced by a database trigger, not here. This function
 * simply never sends first_* on an update; if a future caller does, the write
 * fails loudly instead of quietly rewriting where a client came from.
 *
 * What is deliberately NOT collected: IP address, any device fingerprint, and
 * the referring URL's path or query. The referring HOST is enough to learn
 * which channel works, and everything beyond it is somebody's browsing history.
 */

export async function captureTouch(sessionId: string, touch: Touch): Promise<DbResult<{ first: boolean; visits: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured — attribution is not being recorded");

  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data: existing, error: readErr } = await db
      .from("rift_attributions")
      .select("session_id,visits")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (readErr) return failed(readErr.message);

    if (!existing) {
      const { error } = await db.from("rift_attributions").insert({
        session_id: sessionId,
        agent_id,
        first_source: touch.source ?? null,
        first_medium: touch.medium ?? null,
        first_campaign: touch.campaign ?? null,
        first_referrer: touch.referrer ?? null,
        first_landing: touch.landing ?? null,
        last_source: touch.source ?? null,
        last_medium: touch.medium ?? null,
        last_campaign: touch.campaign ?? null,
        last_referrer: touch.referrer ?? null,
        last_landing: touch.landing ?? null,
        visits: 1,
      });
      if (error) return failed(error.message);
      return done({ first: true, visits: 1 });
    }

    /* Only last_* and the visit count. Sending first_* here would be rejected
       by the trigger, which is the intended safety net rather than the plan. */
    const visits = (existing.visits as number) + 1;
    const { error } = await db
      .from("rift_attributions")
      .update({
        last_source: touch.source ?? null,
        last_medium: touch.medium ?? null,
        last_campaign: touch.campaign ?? null,
        last_referrer: touch.referrer ?? null,
        last_landing: touch.landing ?? null,
        last_at: new Date().toISOString(),
        visits,
      })
      .eq("session_id", sessionId);
    if (error) return failed(error.message);
    return done({ first: false, visits });
  } catch (e) {
    return failed(e);
  }
}

