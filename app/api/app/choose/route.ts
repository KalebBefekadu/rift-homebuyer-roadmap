import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { clientSession, memberOf } from "@/lib/db/portal";
import { clientRoom } from "@/lib/db/portal-room";
import { chooseOffer } from "@/lib/db/offer-room";
import { currentAgentEmail } from "@/lib/db/service";
import { sendOfferChosen } from "@/lib/db/email";
import { siteUrl } from "@/lib/core/site";
import { CLIENT_NOTE_MAX } from "@/lib/core/offer-room";
import { captureOpError } from "@/lib/monitoring/capture";
import { isUuid } from "@/lib/core/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_NOW = "We could not record that just now. Nothing was sent. Please try again in a minute.";

/**
 * The seller says which offer they want, from the portal (audit
 * portals-2026-10, item 4).
 *
 * The plan link's route (app/api/plan/choose) takes the token as authority.
 * This one takes the signed-in member: a live membership on this journey,
 * a seller or co-seller, with "Price and fees", and only an offer that is in
 * front of them now (clientRoom). The write and the email after it are the
 * same ones the plan link uses, so Today shows Kaleb one kind of choice
 * whichever page it came from.
 */
export async function POST(req: Request) {
  const refused = limited(req, "choose");
  if (refused) return refused;

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Record<string, unknown>;
  const journeyId = typeof b.journeyId === "string" ? b.journeyId : "";
  const offerId = typeof b.offerId === "string" ? b.offerId : "";
  const note = typeof b.note === "string" ? b.note.slice(0, CLIENT_NOTE_MAX) : null;
  if (!isUuid(journeyId) || !isUuid(offerId)) {
    return NextResponse.json({ ok: false, error: "That did not look like a choice." }, { status: 400 });
  }

  const session = await clientSession();
  if (session.state === "unknown") return NextResponse.json({ ok: false, error: NOT_NOW }, { status: 503 });
  if (session.state !== "signed-in") return NextResponse.json({ ok: false, error: "Sign in again, then choose." }, { status: 401 });
  const m = await memberOf(session.userId, journeyId);
  if (!m.ok || "skipped" in m) return NextResponse.json({ ok: false, error: NOT_NOW }, { status: 503 });
  if (!m.data || m.data.side !== "sell") return NextResponse.json({ ok: false, error: "This is not yours to choose." }, { status: 403 });

  const room = await clientRoom(m.data);
  if (!room.ok || "skipped" in room) return NextResponse.json({ ok: false, error: NOT_NOW }, { status: 503 });
  if (!room.data?.room) return NextResponse.json({ ok: false, error: "This is not yours to choose." }, { status: 403 });
  if (!room.data.room.offers.some((o) => o.id === offerId)) {
    return NextResponse.json({ ok: false, error: "That offer is no longer in front of you. Reload the page." }, { status: 409 });
  }

  const r = await chooseOffer(room.data.leadId, offerId, note);
  if (!r.ok) {
    const theirs = /already told|no longer in front|no offers here/.test(r.error);
    if (!theirs) captureOpError(new Error(r.error), { op: "offer.choose.portal" });
    return NextResponse.json({ ok: false, error: theirs ? r.error : NOT_NOW }, { status: theirs ? 409 : 502 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: false, error: NOT_NOW }, { status: 503 });

  /* After the choice is stored, never before; Today lists it either way. */
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
      studioUrl: `${siteUrl() ?? ""}/operations/lead/${r.data.leadId}`,
    });
    if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.offerChosen" });
  }
  return NextResponse.json({ ok: true, stored: true });
}
