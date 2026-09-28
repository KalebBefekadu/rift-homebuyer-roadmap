import { NextResponse } from "next/server";
import { currentAgent } from "@/lib/db/session";
import { documentLinkForAgent } from "@/lib/db/documents";
import { buyerSearchOn } from "@/lib/core/journey";
import { isUuid } from "@/lib/core/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * Open a document, for the agent. Checks the session, then sends the browser
 * to a Storage link that works for one minute (lib/db/documents.ts). There is
 * no permanent address for any document.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const journeyId = u.searchParams.get("journeyId") ?? "";
  const id = u.searchParams.get("id") ?? "";
  if (!buyerSearchOn(process.env)) return new NextResponse("Switched off", { status: 503 });
  if (!isUuid(journeyId) || !isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const agent = await currentAgent();
  if (!agent) return new NextResponse("Sign in again", { status: 401 });
  const r = await documentLinkForAgent(journeyId, id);
  if (!r.ok || !("data" in r) || !r.data.url) return new NextResponse("That document could not be opened. Reload and try again.", { status: 404 });
  return NextResponse.redirect(r.data.url, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
