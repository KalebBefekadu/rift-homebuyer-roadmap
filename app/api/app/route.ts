import { NextResponse } from "next/server";
import { respondToPricing } from "@/lib/db/seller";
import { limited, readJson } from "@/lib/db/guard";
import { createPasswordAccount, passwordSignIn, sendSignInLink, setOwnPassword } from "@/lib/db/signin";
import { passwordError } from "@/lib/core/password";
import { buyerSearchOn } from "@/lib/core/journey";
import { captureOpError } from "@/lib/monitoring/capture";
import {
  acceptInvitation, addHomeAsMember, clientSession, invitationByToken, mayReceiveSignIn, memberOf,
  clientUploadFinish, clientUploadSlot, proposeRevision, reactAsMember, setMyNotices, reportWorkAsMember, respondToBid, requestTourAsMember, respondToBrief, tourFeedbackAsMember,
} from "@/lib/db/portal";
import { EMPTY_FACTS, type SearchBrief } from "@/lib/core/search";
import type { NewHome } from "@/lib/db/shortlist";
import { WORKSTREAMS, type Workstream } from "@/lib/core/progress";
import { isUuid } from "@/lib/core/ids";

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
 *   SIGNING IN. `signin`, `reset` and `invite-link` email a one-time link
 *   (Brevo, or Supabase without it: lib/db/signin.ts). `password` signs in
 *   with a password, and `invite-password` creates a password account from an
 *   open invitation and joins in the same step. Links go only to an address
 *   that holds an invitation or a membership, and accounts are only created
 *   from an invitation, so this is never an open sign-up. `signin`, `reset`
 *   and `password` answer the same whether or not the address is known, so
 *   they do not reveal who is a client.
 *
 *   EVERYTHING ELSE requires a session and resolves the membership from
 *   scratch for the journey named in the request (lib/db/portal.ts). The
 *   browser supplies ids and words, never identity or permission.
 */

type Body = Record<string, unknown>;
const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!buyerSearchOn(process.env)) return json({ ok: false, error: "This is switched off at the moment." }, 503);

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Body;
  const action = str(b.action, 40);

  if (action === "signin" || action === "reset" || action === "invite-link" || action === "password" || action === "invite-password") {
    const refused = limited(req, "signin");
    if (refused) return refused;

    if (action === "signin" || action === "reset") {
      const email = str(b.email, 254).trim().toLowerCase();
      if (!email) return json({ ok: false, error: "Enter your email address." }, 400);
      /* Forgot password is a sign-in link that lands on the account page, where
         a signed-in person sets a new password. One kind of link to keep
         working, rather than a second (recovery) token type to verify. */
      if (await mayReceiveSignIn(email)) {
        await sendSignInLink(email, action === "reset" ? "/app/account?reset=1" : "/app", action === "reset" ? "reset" : "signin");
      }
      /* The same answer either way. */
      return json({ ok: true });
    }

    if (action === "password") {
      const email = str(b.email, 254).trim().toLowerCase();
      const password = str(b.password, 200);
      if (!email || !password) return json({ ok: false, error: "Enter your email and password." }, 400);
      const r = await passwordSignIn(email, password);
      if (r.state === "wrong") return json({ ok: false, error: "That email and password do not match. Try again, or use Forgot password." }, 401);
      if (r.state === "failed") return json({ ok: false, error: "We could not sign you in just now. Try again in a minute." }, 503);
      return json({ ok: true });
    }

    if (action === "invite-password") {
      const token = str(b.token, 80);
      const password = str(b.password, 200);
      const inv = await invitationByToken(token);
      if (!inv.ok || "skipped" in inv) return json({ ok: false, error: "We could not check the invitation just now. Try again in a minute." }, 503);
      if (!inv.data || inv.data.state !== "invited") {
        return json({ ok: false, error: "This invitation is no longer open. Ask your agent for a new one." }, 404);
      }
      const bad = passwordError(password, inv.data.email);
      if (bad) return json({ ok: false, error: bad }, 400);
      const made = await createPasswordAccount(inv.data.email, password);
      if (made.state === "exists") {
        return json({ ok: false, exists: true, error: "You already have a login for this address. Sign in with it below, then join." }, 409);
      }
      if (made.state === "failed") return json({ ok: false, error: "We could not create your login just now. Try again, or use the email link instead." }, 502);
      const signedIn = await passwordSignIn(inv.data.email, password);
      if (signedIn.state !== "ok") return json({ ok: false, error: "Your login was created, but signing in did not finish. Sign in with your new password below." }, 502);
      const joined = await acceptInvitation(token, signedIn.userId, signedIn.email);
      if (!joined.ok) return refusal("accept", joined.error);
      if ("skipped" in joined) return json({ ok: false, error: joined.reason }, 503);
      return json({ ok: true, journeyId: joined.data.journeyId });
    }

    const token = str(b.token, 80);
    const inv = await invitationByToken(token);
    if (!inv.ok || "skipped" in inv) return json({ ok: false, error: "We could not check the invitation just now. Try again in a minute." }, 503);
    if (!inv.data || inv.data.state !== "invited") {
      return json({ ok: false, error: "This invitation is no longer open. Ask your agent for a new one." }, 404);
    }
    const sent = await sendSignInLink(inv.data.email, `/app/invite/${token}`);
    return sent
      ? json({ ok: true, to: inv.data.maskedEmail })
      : json({ ok: false, error: "The sign-in email could not be sent just now. Try again in a few minutes." }, 502);
  }

  const refused = limited(req, "app");
  if (refused) return refused;

  const session = await clientSession();
  if (session.state === "unknown") return json({ ok: false, error: "We could not check your sign-in just now. Try again." }, 503);
  if (session.state === "signed-out") return json({ ok: false, error: "Sign in again to do that.", signedOut: true }, 401);

  if (action === "set-password") {
    const password = str(b.password, 200);
    const bad = passwordError(password, session.email);
    if (bad) return json({ ok: false, error: bad }, 400);
    return (await setOwnPassword(password))
      ? json({ ok: true })
      : json({ ok: false, error: "Your password did not save. Nothing was changed. Try again in a minute." }, 502);
  }

  if (action === "accept") {
    const r = await acceptInvitation(str(b.token, 80), session.userId, session.email);
    /* Through the same filter as every other write below: a failed read of
       the invitation arrives here as the database's own message. */
    if (!r.ok) return refusal(action, r.error);
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

  /* Sending a document (manual review WS11.3): the same two steps as the
     agent's upload. The slot answers with where to put the bytes, so it
     returns its data rather than a bare ok. */
  if (action === "doc-slot") {
    const slot = await clientUploadSlot(member);
    if (!slot.ok) return refusal(action, slot.error);
    if ("skipped" in slot) return json({ ok: false, error: slot.reason }, 503);
    return json({ ok: true, path: slot.data.path, url: slot.data.url });
  }
  if (action === "doc-finish") {
    const fin = await clientUploadFinish(member, {
      path: str(b.path, 200), filename: str(b.filename, 300), type: str(b.type, 100), kind: str(b.kind, 20), label: str(b.label, 160),
    });
    if (!fin.ok) return refusal(action, fin.error);
    if ("skipped" in fin) return json({ ok: false, error: fin.reason }, 503);
    if ("refused" in fin.data) return json({ ok: false, error: `That file could not be kept: ${fin.data.refused.join("; ")}.` }, 400);
    return json({ ok: true });
  }

  let r: { ok: boolean; error?: string; reason?: string } & Record<string, unknown>;
  switch (action) {
    case "respond": {
      const revisionId = str(b.revisionId, 40);
      if (!isUuid(revisionId)) return json({ ok: false, error: "That page is out of date. Reload it." }, 400);
      r = await respondToBrief(member, revisionId, str(b.response, 20) as never, str(b.note, 1000) || null);
      break;
    }
    case "pricing-answer": {
      const opinionId = str(b.opinionId, 40);
      const response = str(b.response, 10);
      if (!isUuid(opinionId) || (response !== "agree" && response !== "discuss")) return json({ ok: false, error: "That page is out of date. Reload it." }, 400);
      r = await respondToPricing(member, opinionId, response, str(b.note, 500) || null);
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
    case "report-work": {
      const contractId = str(b.contractId, 40);
      const requestId = str(b.requestId, 40);
      const workstream = str(b.workstream, 20) as Workstream;
      if (!isUuid(contractId) || !isUuid(requestId) || !WORKSTREAMS.includes(workstream)) {
        return json({ ok: false, error: "That page is out of date. Reload it." }, 400);
      }
      r = await reportWorkAsMember(member, contractId, workstream, str(b.note, 500) || null, Number(b.expectedSeq), requestId);
      break;
    }
    case "bid-answer": {
      const bidId = str(b.bidId, 40);
      const requestId = str(b.requestId, 40);
      const instruction = str(b.instruction, 10);
      if (!isUuid(bidId) || !isUuid(requestId)) return json({ ok: false, error: "That page is out of date. Reload it." }, 400);
      if (!["proceed", "change", "stop"].includes(instruction)) return json({ ok: false, error: "Choose an answer." }, 400);
      r = await respondToBid(member, bidId, Number(b.version), instruction as "proceed" | "change" | "stop", str(b.note, 500) || null, requestId);
      break;
    }
    case "notices":
      r = await setMyNotices(member, b.on === true);
      break;
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

  if (!r.ok) return refusal(action, r.error);
  if ("skipped" in r) return json({ ok: false, error: String(r.reason) }, 503);
  return json({ ok: true });
}

/**
 * Refusals written for the buyer (out of date, not allowed, invalid input)
 * are shown as written. Anything that looks like a database message is ours,
 * and is reported instead.
 */
function refusal(action: string, error: unknown) {
  const raw = String(error ?? "");
  const ours = /violates|duplicate key|syntax|relation|column|timeout|did not complete|fetch failed|permission denied/i.test(raw);
  if (ours) captureOpError(new Error(raw), { op: `app.${action}` });
  return json({ ok: false, error: ours ? "That did not save. Nothing was changed. Try again in a minute." : raw }, ours ? 502 : 409);
}
