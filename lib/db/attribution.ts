import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedWrite, boundedRead } from "./bounded";
import { type Touch, refFrom } from "@/lib/core/attribution";
import { captureOpError } from "@/lib/monitoring/capture";

export { stripToHost, touchFromRequest, describeTouch, type Touch } from "@/lib/core/attribution";
export { refFrom };

/**
 * Whether the referral columns exist yet.
 *
 * Schema and code ship separately here: the migration is applied by hand:
 * and a deploy landing first would otherwise insert a column PostgREST does
 * not know about and fail EVERY attribution write. That is not a degraded
 * report; it is the first touch of every visitor lost for as long as the two
 * are out of step, and first touch is the one thing that cannot be
 * reconstructed later. Same pattern as `hasFollowUp` in ./clients.ts.
 *
 * null means not yet determined.
 */
let hasRef: boolean | null = null;

const isMissingColumn = (e: unknown) =>
  typeof e === "string" && /column .* does not exist|42703|first_ref|last_ref/i.test(e);

/**
 * First-touch attribution.
 *
 * First touch never moves. That is the whole point of first touch: an agent
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
  if (!db) return skipped("no database configured; attribution is not being recorded");

  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    /* Bounded. A read in front of a write is still a read, and an unbounded
       one means a hung database holds the request open just as surely as the
       write would. */
    const read = await boundedRead(
      db.from("rift_attributions").select("session_id,visits").eq("session_id", sessionId).maybeSingle(),
      "the attribution lookup",
    );
    if (!read.ok) return read;
    const existing = "data" in read ? read.data : null;

    if (!existing) {
      const base: Record<string, unknown> = {
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
      };
      const withRef = hasRef === false
        ? base
        : { ...base, first_ref: touch.ref ?? null, last_ref: touch.ref ?? null };

      let inserted = await boundedWrite(db.from("rift_attributions").insert(withRef), "attribution");
      if (!inserted.ok && hasRef !== false && isMissingColumn(inserted.error)) {
        /* Reported, not swallowed. Losing referral attribution is exactly the
           silent failure this whole feature exists to end, and a deploy that
           has been sitting in front of its migration for a week should not
           look identical to one that is fully applied. */
        hasRef = false;
        captureOpError(new Error(String(inserted.error)), {
          op: "attribution.noRefColumn",
          extra: { migration: "20260921030000_rift_referral_attribution" },
        });
        inserted = await boundedWrite(db.from("rift_attributions").insert(base), "attribution");
      } else if (inserted.ok && hasRef === null) {
        hasRef = true;
      }
      if (!inserted.ok) return inserted;
      return done({ first: true, visits: 1 });
    }

    /* Only last_* and the visit count. Sending first_* here would be rejected
       by the trigger, which is the intended safety net rather than the plan. */
    const visits = (existing.visits as number) + 1;
    const patch: Record<string, unknown> = {
      last_source: touch.source ?? null,
      last_medium: touch.medium ?? null,
      last_campaign: touch.campaign ?? null,
      last_referrer: touch.referrer ?? null,
      last_landing: touch.landing ?? null,
      last_at: new Date().toISOString(),
      visits,
    };
    /* `last_ref` only when there is one. A second visit arriving directly must
       not blank the referral off the last touch: "they came back on their own"
       is a fact about this visit, not a correction to the previous one. */
    if (hasRef !== false && touch.ref) patch.last_ref = touch.ref;

    const updated = await boundedWrite(db
      .from("rift_attributions")
      .update(patch)
      .eq("session_id", sessionId), "attribution");
    if (!updated.ok) return updated;
    return done({ first: false, visits });
  } catch (e) {
    return failed(e);
  }
}

/* ------------------------------------------------------------------ *
 * Who sent them
 * ------------------------------------------------------------------ */

/**
 * The `?r=` recorded on a session's FIRST touch.
 *
 * Read at capture rather than carried through the browser, for the same reason
 * the consent wording is the server's copy: a value the page can post is a
 * value anybody can post, and this one decides who gets credit for a
 * relationship. The session id is the handle; the database holds the claim.
 */
export async function firstRefFor(sessionId: string): Promise<string | null> {
  if (!sessionId || hasRef === false) return null;
  const db = serviceClient();
  if (!db) return null;

  const read = await boundedRead(
    db.from("rift_attributions").select("first_ref").eq("session_id", sessionId).maybeSingle(),
    "the referral on this session",
  );
  if (!read.ok) {
    /* The early return above already established hasRef is not false. */
    if (isMissingColumn(read.error)) hasRef = false;
    return null;
  }
  if (hasRef === null) hasRef = true;
  const row = "data" in read ? (read.data as { first_ref: string | null } | null) : null;
  return row?.first_ref ?? null;
}

/**
 * A handle, resolved to the lead who handed it out.
 *
 * Two kinds of handle reach here and both are legitimate referrals:
 *
 *   A REFERRAL TOKEN on rift_leads: a past or current client passing the
 *   product to somebody, which is the advocacy loop docs/vision.md is built
 *   around.
 *
 *   A SHARE TOKEN on rift_readouts: somebody forwarding their own readout to
 *   a friend, who then runs their own. product.md calls this "the most natural
 *   referral there is" and says the recipient is credited to the sharer
 *   exactly like a referral. It had no implementation: /r/<token> sent every
 *   recipient to a bare /buy/start.
 *
 * Returns null for anything unrecognised. A handle that does not resolve is
 * not an error: links get truncated, retyped and passed through trackers that
 * mangle query strings, and the capture must go ahead regardless. Losing the
 * credit is bad; losing the lead over it would be absurd.
 */
export async function resolveReferrer(
  ref: string | null | undefined,
  opts: { excludeSessionId?: string } = {},
): Promise<string | null> {
  const clean = refFrom(ref);
  if (!clean) return null;

  const db = serviceClient();
  if (!db) return null;
  const agent_id = await currentAgentId();
  if (!agent_id) return null;

  const direct = await boundedRead(
    db.from("rift_leads").select("id,session_id")
      .eq("referral_token", clean).eq("agent_id", agent_id).maybeSingle(),
    "the referrer",
  );
  const hit = direct.ok && "data" in direct
    ? (direct.data as { id: string; session_id: string | null } | null)
    : null;
  if (hit) return sameSession(hit, opts.excludeSessionId) ? null : hit.id;

  /* Not a client handle. Try a shared readout: share_token -> assessment ->
     the lead that assessment produced. */
  const readout = await boundedRead(
    db.from("rift_readouts").select("assessment_id").eq("share_token", clean).maybeSingle(),
    "the shared readout",
  );
  const assessmentId = readout.ok && "data" in readout
    ? (readout.data as { assessment_id: string | null } | null)?.assessment_id ?? null
    : null;
  if (!assessmentId) return null;

  const sharer = await boundedRead(
    db.from("rift_leads").select("id,session_id")
      .eq("assessment_id", assessmentId).eq("agent_id", agent_id).maybeSingle(),
    "the sharer",
  );
  const who = sharer.ok && "data" in sharer
    ? (sharer.data as { id: string; session_id: string | null } | null)
    : null;
  if (!who) return null;
  return sameSession(who, opts.excludeSessionId) ? null : who.id;
}

/**
 * Somebody re-running the assessment from their own link is not a referral.
 *
 * It happens constantly and innocently: a buyer opens the readout they were
 * sent, changes a number and fills the form again, and without this the
 * advocacy figure quietly fills up with people who referred themselves. The
 * database check only catches the exact-same-row case; this catches the one
 * that actually occurs, which is a second lead row from the same browser.
 */
function sameSession(
  who: { session_id: string | null },
  sessionId: string | undefined,
): boolean {
  return Boolean(sessionId && who.session_id && who.session_id === sessionId);
}


