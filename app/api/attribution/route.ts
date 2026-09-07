import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { captureTouch, touchFromRequest } from "@/lib/db/attribution";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records where a visit came from.
 *
 * The touch is derived from the URL and the Referer header on the SERVER, not
 * sent by the client. A client that can post its own attribution is a client
 * that can rewrite where a client came from — accidentally through a caching
 * bug, or deliberately — and attribution is the only evidence the agent has
 * about which channel is worth money.
 */
export async function POST(req: Request) {
  const refused = limited(req, "attribution");
  if (refused) return refused;

  let sessionId = "";
  let landingUrl = "";
  try {
    const body = (await req.json()) as { sessionId?: unknown; url?: unknown };
    sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : "";
    landingUrl = typeof body.url === "string" ? body.url : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!sessionId) return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(landingUrl || req.url);
  } catch {
    url = new URL(req.url);
  }

  const touch = touchFromRequest(url, req.headers.get("referer"));
  const result = await captureTouch(sessionId, touch);

  if (!result.ok) {
    captureOpError(new Error(result.error), { op: "attribution.capture", extra: { hasSource: Boolean(touch.source) } });
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  if ("skipped" in result) return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
  return NextResponse.json({ ok: true, ...result.data });
}
