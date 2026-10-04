import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureOpError } from "@/lib/monitoring/capture";

export const dynamic = "force-dynamic";

/**
 * Turns a sign-in link into a session.
 *
 * Two shapes of link arrive here. `code` comes from Supabase's own mailer (the
 * agent's sign-in, and a buyer's when Brevo is not configured) and is
 * exchanged against the PKCE verifier in this browser's cookie. `token_hash`
 * comes from a link Brevo delivered (lib/db/signin.ts) and is verified
 * directly, so it works on whichever device the buyer opens their email.
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
  return "/operations";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));
  /* A buyer's link fails back to the buyer's sign-in page, never to the
     agent's: "Operations: sign in" is not something a client should see. */
  const signIn = next.startsWith("/app") ? "/app/sign-in" : "/operations/sign-in";

  /* Only the types lib/db/signin.ts mints. A recovery or email-change token
     arriving here is not something this product sends. */
  const hashed = tokenHash && (type === "magiclink" || type === "signup") ? { token_hash: tokenHash, type } : null;
  if (!code && !hashed) return NextResponse.redirect(`${origin}${signIn}?error=missing_code`);

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${origin}${signIn}?error=unconfigured`);

  const { error } = hashed
    ? await supabase.auth.verifyOtp(hashed)
    : await supabase.auth.exchangeCodeForSession(code as string);
  if (error) {
    captureOpError(error, { op: "auth.callback" });
    return NextResponse.redirect(`${origin}${signIn}?error=expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
