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
 * The link carries a token hash to /auth/callback, which asks the person to
 * press Continue and only then verifies it (app/auth/confirm/route.ts), so an
 * email scanner that opens every link does not spend it first. Not Supabase's own `action_link`: that one returns the session in a
 * URL fragment, which a server route never sees, and it has to be on the
 * project's redirect allow-list besides.
 */
export async function sendSignInLink(email: string, next: string, purpose: "signin" | "reset" = "signin"): Promise<boolean> {
  const origin = siteUrl();
  if (!origin) return false;

  if (process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL) {
    const tokenHash = await mintToken(email);
    if (tokenHash) {
      const link = `${origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash.hash)}&type=${tokenHash.type}&next=${encodeURIComponent(next)}`;
      const sent = await sendSignIn({ to: email, link, purpose });
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

export type PasswordAccount =
  | { state: "created"; userId: string }
  | { state: "exists" }
  | { state: "failed" };

/**
 * A password account for the address an invitation was sent to, created from
 * that invitation (app/api/app/route.ts, `invite-password`).
 *
 * ONLY A NEW ACCOUNT. If a login already exists for the address, this refuses
 * rather than setting its password: an invitation link can be forwarded, and
 * a link that could overwrite an existing password would let whoever holds it
 * take over everything that login already has. That person signs in the way
 * they already do (password or email link) and then joins.
 *
 * Confirmed on creation because the link that reached this point was sent to
 * that address by the agent. The same trust the email link has always relied
 * on, minus the second email.
 */
export async function createPasswordAccount(email: string, password: string): Promise<PasswordAccount> {
  const db = serviceClient();
  if (!db) return { state: "failed" };
  const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (made.error) {
    if (/already|registered|exists/i.test(made.error.message)) return { state: "exists" };
    captureOpError(made.error, { op: "app.password.create" });
    return { state: "failed" };
  }
  return made.data.user ? { state: "created", userId: made.data.user.id } : { state: "failed" };
}

/**
 * Signs in with a password, setting the session cookie on this response.
 * "wrong" covers an unknown address too, so the answer does not reveal who
 * has an account.
 */
export async function passwordSignIn(email: string, password: string): Promise<
  { state: "ok"; userId: string; email: string | null } | { state: "wrong" } | { state: "failed" }
> {
  const supabase = await createClient();
  if (!supabase) return { state: "failed" };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid|credentials|not confirmed/i.test(error.message) || error.status === 400) return { state: "wrong" };
    captureOpError(error, { op: "app.password.signin" });
    return { state: "failed" };
  }
  return data.user ? { state: "ok", userId: data.user.id, email: data.user.email ?? null } : { state: "failed" };
}

/** Sets or changes the signed-in person's own password. */
export async function setOwnPassword(password: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) captureOpError(error, { op: "app.password.set" });
  return !error;
}
