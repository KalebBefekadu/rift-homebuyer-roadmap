import { NextResponse } from "next/server";
import { issuePass } from "@/lib/core/offer-pass";
import { signingSecret } from "@/lib/db/offer-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A pass for the offer upload (lib/core/offer-pass.ts), asked for when the
 * offer page opens. Null where nothing can sign one (no secret configured),
 * and the upload then does not ask for it: the same rule both ends.
 */
export function GET() {
  const secret = signingSecret();
  return NextResponse.json({ pass: secret ? issuePass(secret) : null }, { headers: { "cache-control": "no-store" } });
}
