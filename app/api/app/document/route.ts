import { NextResponse } from "next/server";
import { clientDocumentLink, clientSession, memberOf } from "@/lib/db/client";
import { buyerSearchOn } from "@/lib/core/journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Open a document, for a household member: only one attached to a version of
 * an offer they were asked about, and only with the money scope
 * (lib/db/client.ts `clientDocumentLink`). The link it sends them to works
 * for one minute.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const journeyId = u.searchParams.get("journeyId") ?? "";
  const id = u.searchParams.get("id") ?? "";
  if (!buyerSearchOn(process.env)) return new NextResponse("Switched off", { status: 503 });
  if (!UUID.test(journeyId) || !UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const session = await clientSession();
  if (session.state !== "signed-in") return new NextResponse("Sign in again", { status: 401 });
  const m = await memberOf(session.userId, journeyId);
  if (!m.ok || !("data" in m) || !m.data) return new NextResponse("Not found", { status: 404 });
  const r = await clientDocumentLink(m.data, id);
  if (!r.ok || !("data" in r) || !r.data.url) return new NextResponse("That document is not shared with you.", { status: 404 });
  return NextResponse.redirect(r.data.url, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
