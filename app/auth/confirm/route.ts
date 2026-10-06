import { NextResponse } from "next/server";
import { originOf } from "@/lib/core/origin";
import { createClient } from "@/lib/supabase/server";
import { captureOpError } from "@/lib/monitoring/capture";

export const dynamic = "force-dynamic";

/**
 * Turns a sign-in link into a session, on the POST from the Continue button
 * on /auth/callback. Never on a GET: see that page for why.
 *
 * Two shapes of link arrive. `code` comes from Supabase's own mailer (the
 * agent's sign-in, and a buyer's when Brevo is not configured) and is
 * exchanged against the PKCE verifier in this browser's cookie, which a
 * same-origin form post carries. `token_hash` comes from a link Brevo
 * delivered (lib/db/signin.ts) and is verified directly, so it works on
 * whichever device the buyer opens their email.
 *
 * Failures go to the right sign-in page: a buyer's to /app/sign-in, never to
 * the agent's, and never to /login, which the retired portal MVP left here as
 * a 404.
 */
function safeNext(path: string | null): string {
  /* Only same-origin paths. An open redirect on an auth callback is how a
     sign-in link becomes a phishing link. */
  if (path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\")) return path;
  return "/operations";
}

const field = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.length <= 2_000 ? v : null;
};

export async function POST(request: Request) {
  const origin = originOf(request);
  const form = await request.formData().catch(() => null);
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`, { status: 303 });
  if (!form) return go("/operations/sign-in?error=missing_code");

  const code = field(form, "code");
  const tokenHash = field(form, "token_hash");
  const type = field(form, "type");
  const next = safeNext(field(form, "next"));
  const signIn = next.startsWith("/app") ? "/app/sign-in" : "/operations/sign-in";

  /* Only the types lib/db/signin.ts mints. A recovery or email-change token
     arriving here is not something this product sends. */
  const hashed = tokenHash && (type === "magiclink" || type === "signup") ? { token_hash: tokenHash, type } : null;
  if (!code && !hashed) return go(`${signIn}?error=missing_code`);

  const supabase = await createClient();
  if (!supabase) return go(`${signIn}?error=unconfigured`);

  const { error } = hashed
    ? await supabase.auth.verifyOtp(hashed)
    : await supabase.auth.exchangeCodeForSession(code as string);
  if (error) {
    captureOpError(error, { op: "auth.callback" });
    /* A Supabase-mailer link opened in another browser has no PKCE verifier
       here. Saying so beats "expired", which sends people to ask again and
       open the new one on the same wrong device. */
    const why = !hashed && /verifier|code challenge/i.test(error.message) ? "other_device" : "expired";
    return go(`${signIn}?error=${why}`);
  }

  return go(next);
}
