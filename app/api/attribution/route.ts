import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { captureTouch, touchFromRequest } from "@/lib/db/attribution";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records where a visit came from.
 *
 * This docblock used to say the touch was derived "on the SERVER, not sent by
 * the client", and the code below read the landing URL out of the request
 * body. Both halves were wrong, and they were wrong in opposite directions.
 *
 *   The landing URL and its utm tags WERE client-supplied, so anything could
 *   post any campaign against any session.
 *
 *   The referrer was NOT client-supplied, and that was the worse bug. This
 *   endpoint is called by a fetch from the landing page, so the Referer header
 *   on it is the landing page: our own host. Every row written since the
 *   deployment therefore recorded rift as the channel that sent the visitor to
 *   rift, and "direct", which the code calls "a real answer", could not occur.
 *
 * The split now follows what each side can actually know. The landing page and
 * its tags come from the Referer header of this call, which page script cannot
 * forge. The external referrer can only come from `document.referrer`, so it
 * is read from the body, clamped, and discarded when it names our own host.
 */
export async function POST(req: Request) {
  const refused = limited(req, "attribution");
  if (refused) return refused;

  let sessionId = "";
  let cameFrom: string | null = null;
  try {
    const read = await readJson(req);
    if (!read.ok) return read.res;
    const body = read.body as { sessionId?: unknown; referrer?: unknown };
    sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : "";
    /* `document.referrer`. Long enough for a real URL, short enough that the
       body cannot be used as storage; only the host survives parsing anyway. */
    cameFrom = typeof body.referrer === "string" ? body.referrer.slice(0, 2_048) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!sessionId) return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });

  /* The page that made this call, as the platform saw it. A script on that
     page can change what it posts; it cannot change this. */
  const self = new URL(req.url);
  let url: URL;
  try {
    url = new URL(req.headers.get("referer") ?? "");
    /* A Referer pointing somewhere else is not a landing page of ours. */
    if (url.host !== self.host) url = self;
  } catch {
    /* No Referer: the private pages send `no-referrer` by design, and some
       privacy tooling strips it everywhere. The session is still counted; the
       landing page for it is simply not known. */
    url = self;
  }

  const touch = touchFromRequest(url, cameFrom, self.host);
  const result = await captureTouch(sessionId, touch);

  if (!result.ok) {
    captureOpError(new Error(result.error), { op: "attribution.capture", extra: { hasSource: Boolean(touch.source) } });
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  if ("skipped" in result) return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
  return NextResponse.json({ ok: true, ...result.data });
}
