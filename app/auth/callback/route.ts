import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureOpError } from "@/lib/monitoring/capture";

export const dynamic = "force-dynamic";

/**
 * Exchanges a magic-link code for a session.
 *
 * Two things here were left behind by the retired portal MVP and are fixed:
 * it called `claim_my_client_records`, an RPC that belonged to that product's
 * schema and no longer exists, and it redirected failures to `/login`, which
 * has been a 404 since the portal was removed, so a failed sign-in sent the
 * one person who uses Studio to a dead page.
 */
function safeNext(path: string | null): string {
  /* Only same-origin paths. An open redirect on an auth callback is how a
     sign-in link becomes a phishing link. */
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return "/studio";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  /* A buyer's link fails back to the buyer's sign-in page, never to the
     agent's: "Operations: sign in" is not something a client should see. */
  const signIn = next.startsWith("/app") ? "/app/sign-in" : "/studio/sign-in";

  if (!code) return NextResponse.redirect(`${origin}${signIn}?error=missing_code`);

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${origin}${signIn}?error=unconfigured`);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    captureOpError(error, { op: "auth.callback" });
    return NextResponse.redirect(`${origin}${signIn}?error=expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
