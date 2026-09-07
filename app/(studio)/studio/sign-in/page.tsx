import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAgent } from "@/lib/db/session";
import { SignIn } from "./SignIn";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The agent's way in.
 *
 * A magic link, not a password. There is exactly one person who signs into
 * this product, and a password is a thing that person has to store, rotate and
 * eventually reuse — for a single-user surface it is more attack surface than
 * it removes. A link to an inbox the broker already controls is stronger and
 * has nothing to leak.
 *
 * Deliberately no sign-UP. Anybody who could create an account here would be
 * an agent, and creating an agent record because somebody managed to register
 * hands over the book of business. The row is created by the bootstrap, on
 * purpose, by somebody with the service key.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const agent = await currentAgent();
  if (agent) redirect("/studio");

  const sp = await searchParams;
  const reason = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  return <SignIn reason={reason} />;
}
