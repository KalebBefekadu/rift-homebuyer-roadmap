import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";

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

export interface Touch {
  source?: string;
  medium?: string;
  campaign?: string;
  /** Host only — never the full URL. `stripToHost` enforces it. */
  referrer?: string;
  landing?: string;
}

export function stripToHost(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).host || undefined;
  } catch {
    /* Not a URL. Return nothing rather than store an arbitrary string that
       might be a path with a query in it. */
    return undefined;
  }
}

export function touchFromRequest(url: URL, referrer: string | null): Touch {
  const p = url.searchParams;
  return {
    source: p.get("utm_source") ?? undefined,
    medium: p.get("utm_medium") ?? undefined,
    campaign: p.get("utm_campaign") ?? undefined,
    referrer: stripToHost(referrer),
    /* The path they landed on, without the query — the query is where the
       personal data would be, and it is already parsed above. */
    landing: url.pathname,
  };
}

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

/** How a touch reads in Studio. Never "direct / unknown" twice over. */
export function describeTouch(t: Touch): string {
  if (t.source) return t.campaign ? `${t.source} · ${t.campaign}` : t.source;
  if (t.referrer) return t.referrer;
  return "direct";
}
