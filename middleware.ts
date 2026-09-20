import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Refreshes the Supabase auth cookie so a server component never reads an
 * expired session.
 *
 * Scoped to the surfaces that HAVE sessions, which is Studio and the auth
 * callback. It used to run on everything except the prototype and the home
 * page — so every stranger loading /buy, /sell, /abroad, /book or a readout
 * paid a round trip to the auth server to refresh a session they could not
 * possibly have. The previous note said "when the real authenticated surfaces
 * land in phase 3, add their prefixes here rather than widening this back to
 * everything"; they landed, and the matcher was never narrowed.
 *
 * The public funnel has no accounts by design. That is the product's central
 * promise, and it should cost nothing to keep.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /* Studio and the auth callback. Nothing else in this product reads a
     session, and a page that ever does must be added here deliberately. */
  matcher: ["/studio/:path*", "/auth/:path*"],
};
