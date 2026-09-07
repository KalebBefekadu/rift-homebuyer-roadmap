import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Refreshes the Supabase auth cookie so a server component never reads an
 * expired session.
 *
 * The matcher deliberately EXCLUDES `/prototype` and `/`. The prototype has no
 * accounts by design, and running a session refresh on every one of its routes
 * costs a middleware invocation per request to answer a question nobody asked.
 * When the real authenticated surfaces land in phase 3, add their prefixes here
 * rather than widening this back to everything.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /* Everything except: the prototype, the dev index, Next internals,
       the Sentry tunnel, and static assets. */
    "/((?!prototype|monitoring|_next/static|_next/image|favicon.ico|$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
