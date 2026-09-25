import { NextResponse } from "next/server";
import { legacySellerTarget } from "@/lib/core/legacy";

/**
 * The retired seller addresses, /sell/start and /sell/results, as route
 * handlers rather than pages: a page under (rift) streams behind its loading
 * screen, so `redirect()` there answered 200 and moved the browser in
 * script. A handler answers a real 307 that crawlers and link checkers see.
 *
 * 307, not 308: campaign links point here, and a cached permanent redirect
 * would outlive any later use of these addresses.
 */
export function legacySellerRedirect(req: Request) {
  const url = new URL(req.url);
  const target = legacySellerTarget((k) => url.searchParams.get(k) ?? undefined);
  return NextResponse.redirect(new URL(target, url.origin), 307);
}
