import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "./service";
import { sendSignIn } from "./email";
import { siteUrl } from "@/lib/core/site";
import { captureOpError } from "@/lib/monitoring/capture";

/**
 * Emails a buyer a one-time sign-in link.
 *
 * Only for an address the caller has already established holds an invitation
 * or a membership (app/api/app/route.ts): this creates the auth user if there
 * is none, so calling it for anybody else would be an open sign-up.
 *
 * Brevo first, Supabase's own mailer second. The built-in mailer was the only
 * path, and on a project without custom SMTP it sends a few messages an hour
 * and may deliver only to the project team: a buyer was told "check your
 * email" and nothing came (docs/audit/platform-2026-10.md, item 5). So when
 * Brevo is configured, Supabase only mints the token and Brevo delivers it.
 *
 * The link carries a token hash to /auth/callback, which verifies it on the
 * server. Not Supabase's own `action_link`: that one returns the session in a
 * URL fragment, which a server route never sees, and it has to be on the
 * project's redirect allow-list besides.
 */
export async function sendSignInLink(email: string, next: string): Promise<boolean> {
  const origin = siteUrl();
  if (!origin) return false;

  if (process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL) {
    const tokenHash = await mintToken(email);
    if (tokenHash) {
      const link = `${origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash.hash)}&type=${tokenHash.type}&next=${encodeURIComponent(next)}`;
      const sent = await sendSignIn({ to: email, link });
      if (sent.ok && !("skipped" in sent)) return true;
    }
    /* Not silent: mintToken and send both report to monitoring. Falling
       through gives the buyer a second chance at a link rather than an error. */
  }
  return supabaseMailer(email, origin, next);
}

/** The token Supabase would have emailed, without Supabase emailing it. */
async function mintToken(email: string): Promise<{ hash: string; type: string } | null> {
  const db = serviceClient();
  if (!db) return null;
  const generate = () => db.auth.admin.generateLink({ type: "magiclink", email });

  let r = await generate();
  if (r.error) {
    /* A magic link needs a user to sign in as, and somebody opening their
       first invitation has none yet. Confirmed now because opening the link
       is the confirmation: it only works from their inbox. */
    const made = await db.auth.admin.createUser({ email, email_confirm: true });
    if (made.error) captureOpError(made.error, { op: "app.signin.create" });
    r = await generate();
  }
  if (r.error || !r.data.properties?.hashed_token) {
    captureOpError(r.error ?? new Error("generateLink returned no token"), { op: "app.signin.mint" });
    return null;
  }
  return { hash: r.data.properties.hashed_token, type: r.data.properties.verification_type };
}

async function supabaseMailer(email: string, origin: string, next: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });
  if (error) captureOpError(error, { op: "app.signin" });
  return !error;
}
