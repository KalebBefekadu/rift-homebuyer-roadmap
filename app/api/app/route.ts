import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/core/site";
import { buyerSearchOn } from "@/lib/core/journey";
import { captureOpError } from "@/lib/monitoring/capture";
import {
  acceptInvitation, addHomeAsMember, clientSession, invitationByToken, mayReceiveSignIn, memberOf,
  proposeRevision, reactAsMember, requestTourAsMember, respondToBrief, tourFeedbackAsMember,
} from "@/lib/db/client";
import { EMPTY_FACTS, type SearchBrief } from "@/lib/core/search";
import type { NewHome } from "@/lib/db/shortlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every write the buyer makes on their signed-in pages.
 *
 * A route rather than server actions, for the reason recorded on
 * app/api/plan/choose/route.ts: on the public layouts a server action's
 * refreshed tree has failed to commit, and a buyer staring at "Saving…" taps
 * again. The page shows its own confirmation from this answer.
 *
 * Two kinds of action:
 *
 *   SIGNING IN. `signin` and `invite-link` ask Supabase to email a one-time
 *   link. Only to an address that holds an invitation or a membership, so
 *   this is never an open sign-up; and `signin` answers the same whether or
 *   not the address is known, so it does not reveal who is a client.
 *
 *   EVERYTHING ELSE requires a session and resolves the membership from
 *   scratch for the journey named in the request (lib/db/client.ts). The
 *   browser supplies ids and words, never identity or permission.
 */

type Body = Record<string, unknown>;
const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function sendLink(email: string, next: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const origin = siteUrl();
  if (!origin) return false;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      /* Allowed only because the caller has already established that this
         address holds an invitation or a membership. */
      shouldCreateUser: true,
    },
  });
  if (error) captureOpError(error, { op: "app.signin" });
  return !error;
}

export async function POST(req: Request) {
  if (!buyerSearchOn(process.env)) return json({ ok: false, error: "This is switched off at the moment." }, 503);

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Body;
  const action = str(b.action, 40);

  if (action === "signin" || action === "invite-link") {
    const refused = limited(req, "signin");
    if (refused) return refused;

    if (action === "signin") {
      const email = str(b.email, 254).trim().toLowerCase();
      if (!email) return json({ ok: false, error: "Enter your email address." }, 400);
      if (await mayReceiveSignIn(email)) await sendLink(email, "/app");
      /* The same answer either way. */
      return json({ ok: true });
    }

    const token = str(b.token, 80);
    const inv = await invitationByToken(token);
    if (!inv.ok || "skipped" in inv) return json({ ok: false, error: "We could not check the invitation just now. Try again in a minute." }, 503);
    if (!inv.data || inv.data.state !== "invited") {
      return json({ ok: false, error: "This invitation is no longer open. Ask your agent for a new one." }, 404);
    }
    const sent = await sendLink(inv.data.email, `/app/invite/${token}`);
    return sent
      ? json({ ok: true, to: inv.data.maskedEmail })
      : json({ ok: false, error: "The sign-in email could not be sent just now. Try again in a few minutes." }, 502);
  }

  const refused = limited(req, "app");
  if (refused) return refused;

  const session = await clientSession();
  if (session.state === "unknown") return json({ ok: false, error: "We could not check your sign-in just now. Try again." }, 503);
  if (session.state === "signed-out") return json({ ok: false, error: "Sign in again to do that.", signedOut: true }, 401);

  if (action === "accept") {
    const r = await acceptInvitation(str(b.token, 80), session.userId, session.email);
    if (!r.ok) return json({ ok: false, error: r.error }, 409);
    if ("skipped" in r) return json({ ok: false, error: r.reason }, 503);
    return json({ ok: true, journeyId: r.data.journeyId });
  }

  const journeyId = str(b.journeyId, 40);
  if (!isUuid(journeyId)) return json({ ok: false, error: "That page is out of date. Reload it." }, 400);
  const m = await memberOf(session.userId, journeyId);
  if (!m.ok) return json({ ok: false, error: "We could not check your access just now. Try again." }, 503);
  if ("skipped" in m) return json({ ok: false, error: m.reason }, 503);
  if (!m.data) return json({ ok: false, error: "You do not have access to this any more. Ask your agent." }, 403);
  const member = m.data;

  let r: { ok: boolean; error?: string; reason?: string } & Record<string, unknown>;
  switch (action) {
    case "respond": {
      const revisionId = str(b.revisionId, 40);
      if (!isUuid(revisionId)) return json({ ok: false, error: "That page is out of date. Reload it." }, 400);
      r = await respondToBrief(member, revisionId, str(b.response, 20) as never, str(b.note, 1000) || null);
      break;
    }
    case "propose": {
      const brief = b.brief as SearchBrief | undefined;
      if (!brief || !Array.isArray(brief.criteria) || !Array.isArray(brief.questions)) {
        return json({ ok: false, error: "That change could not be read. Reload and try again." }, 400);
      }
      r = await proposeRevision(member, brief, Number(b.expectedLatest), str(b.note, 2000) || null);
      break;
    }
    case "react": {
      const homeId = str(b.homeId, 40);
      if (!isUuid(homeId)) return json({ ok: false, error: "That home could not be found. Reload." }, 400);
      r = await reactAsMember(member, homeId, str(b.reaction, 20), str(b.reason, 500) || null);
      break;
    }
    case "request-tour": {
      const homeId = str(b.homeId, 40);
      const requestId = str(b.requestId, 40);
      if (!isUuid(homeId) || !isUuid(requestId)) return json({ ok: false, error: "That home could not be found. Reload." }, 400);
      r = await requestTourAsMember(member, homeId, str(b.availability, 300) || null, requestId);
      break;
    }
    case "tour-feedback": {
      const stopId = str(b.stopId, 40);
      if (!isUuid(stopId)) return json({ ok: false, error: "That showing could not be found. Reload." }, 400);
      const offer = str(b.offer, 10);
      if (!["yes", "maybe", "no"].includes(offer)) return json({ ok: false, error: "Choose an answer." }, 400);
      r = await tourFeedbackAsMember(member, stopId, {
        offer: offer as "yes" | "maybe" | "no", reason: str(b.reason, 500) || null, searchChange: str(b.searchChange, 500) || null,
      });
      break;
    }
    case "add-home": {
      const h = (b.home ?? {}) as Partial<NewHome>;
      /* Only the known facts, whatever else was posted: this becomes jsonb. */
      const given = (h.facts ?? {}) as Record<string, unknown>;
      const facts = Object.fromEntries(
        (Object.keys(EMPTY_FACTS) as (keyof NewHome["facts"])[]).map((k) => [k, given[k] ?? null]),
      ) as unknown as NewHome["facts"];
      r = await addHomeAsMember(member, {
        address: str(h.address, 200), url: str(h.url, 500) || null, facts,
        factsSource: str(h.factsSource, 200), factsAsOf: str(h.factsAsOf, 10),
      });
      break;
    }
    default:
      return json({ ok: false, error: "Unknown action." }, 400);
  }

  if (!r.ok) {
    /* Refusals written for the buyer (out of date, not allowed, invalid
       input) are shown as written. Anything that looks like a database
       message is ours, and is reported instead. */
    const raw = String(r.error ?? "");
    const ours = /violates|duplicate key|syntax|relation|column|timeout|did not complete/i.test(raw);
    if (ours) captureOpError(new Error(raw), { op: `app.${action}` });
    return json({ ok: false, error: ours ? "That did not save. Nothing was changed. Try again in a minute." : raw }, ours ? 502 : 409);
  }
  if ("skipped" in r) return json({ ok: false, error: String(r.reason) }, 503);
  return json({ ok: true });
}
