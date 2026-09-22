import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { readPlanByToken } from "@/lib/db/plan";
import { chooseOffer } from "@/lib/db/offer-room";
import { currentAgentEmail } from "@/lib/db/service";
import { sendOfferChosen } from "@/lib/db/email";
import { siteUrl } from "@/lib/core/site";
import { CLIENT_NOTE_MAX } from "@/lib/core/offer-room";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_NOW = "We could not record that just now. Nothing was sent — please try again in a minute.";

/**
 * The seller says which offer they want.
 *
 * A route, like every other write a person without an account makes here
 * (capture, forget, offer), rather than a server action. It was a server
 * action first: the choice saved and the response came back `{ ok: true }`
 * in half a second, and the page sat on "Recording…" forever because the
 * action's refreshed tree never committed on the public layout. A seller who
 * sees no confirmation taps again or phones in a panic, so the confirmation
 * is now shown by the page the moment this answers.
 *
 * No session — the plan token IS the authorisation, exactly as for reading the
 * page. It is resolved here from scratch, and the lead it yields is the only
 * one this can write to. Nothing from the browser is trusted beyond "this
 * token, this offer id, these words": the snapshot of what they were shown is
 * computed from the database in lib/db/offer-room.ts.
 */
export async function POST(req: Request) {
  const refused = limited(req, "choose");
  if (refused) return refused;

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Record<string, unknown>;

  const token = typeof b.token === "string" ? b.token : "";
  const offerId = typeof b.offerId === "string" ? b.offerId : "";
  const note = typeof b.note === "string" ? b.note.slice(0, CLIENT_NOTE_MAX) : null;
  if (!token || !/^[0-9a-f-]{36}$/i.test(offerId)) {
    return NextResponse.json({ ok: false, error: "That did not look like a choice." }, { status: 400 });
  }

  const plan = await readPlanByToken(token);
  if (!plan.ok || "skipped" in plan) return NextResponse.json({ ok: false, error: NOT_NOW }, { status: 503 });
  if (!plan.data) {
    return NextResponse.json({ ok: false, error: "This link is no longer open. Ask your agent for a new one." }, { status: 404 });
  }

  const r = await chooseOffer(plan.data.leadId, offerId, note);
  if (!r.ok) {
    /* A refusal the seller can act on ("already told", "no longer in front
       of you") is said as it is. Anything else is ours, and is reported. */
    const theirs = /already told|no longer in front|no offers here/.test(r.error);
    if (!theirs) captureOpError(new Error(r.error), { op: "offer.choose" });
    return NextResponse.json({ ok: false, error: theirs ? r.error : NOT_NOW }, { status: theirs ? 409 : 502 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: false, error: NOT_NOW }, { status: 503 });

  /* After the choice is stored, never before, and never able to undo it.
     Awaited: on a serverless runtime an unawaited send is dropped when the
     response ends. Today in Studio lists the choice whether or not it lands. */
  const to = await currentAgentEmail();
  if (to) {
    const sent = await sendOfferChosen({
      to,
      seller: r.data.seller,
      from: r.data.snapshot.from,
      price: r.data.snapshot.price,
      net: r.data.snapshot.net,
      bestNet: r.data.snapshot.bestNet,
      of: r.data.snapshot.of,
      note: note?.trim() || null,
      studioUrl: `${siteUrl() ?? ""}/studio/lead/${r.data.leadId}`,
    });
    if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.offerChosen" });
  }

  return NextResponse.json({ ok: true, stored: true });
}
