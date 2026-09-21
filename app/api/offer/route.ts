import { NextResponse } from "next/server";
import { limited, readJson, ipOf } from "@/lib/db/guard";
import { readSubmission } from "@/lib/core/offer-intake";
import { submitOffer } from "@/lib/db/offer-intake";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * An offer, from somebody with no account.
 *
 * The reading the submitter came for is computed in the browser from pure
 * arithmetic and is theirs before this endpoint is called — so this route is
 * only ever the delivery, never the value. That ordering is deliberate: if
 * this fails, they still have what they came for, and the page says plainly
 * that the offer did not get through rather than implying it did.
 *
 * Which is the whole reason it does not return 200 on a skipped write. An
 * endpoint that answered "ok" when no database was configured would tell
 * somebody their offer had been delivered to an agent who will never see it,
 * on a document with a deadline attached to it.
 */
export async function POST(req: Request) {
  const refused = limited(req, "offer");
  if (refused) return refused;

  const body = await readJson(req);
  if (!body.ok) return body.res;

  const parsed = readSubmission((body.body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const raw = body.body as Record<string, unknown>;
  const r = await submitOffer(parsed.value, {
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : undefined,
    ip: ipOf(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "offer.submit" });
    return NextResponse.json(
      { ok: false, error: "We could not pass this on. Nothing was lost on your side — please send it to Kaleb directly." },
      { status: 502 },
    );
  }

  if ("skipped" in r) {
    /* 503, not 200. "We are not set up to receive this" is a true and useful
       thing to say; "delivered" would not be. */
    return NextResponse.json({ ok: false, error: r.reason }, { status: 503 });
  }

  return NextResponse.json({ ok: true, delivered: r.data.delivered });
}
