import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "./service";
import { withTimeout, AUTH_DEADLINE_MS } from "@/lib/core/timeout";

/**
 * Who is asking, on the agent surface.
 *
 * Studio is the only part of Rift behind a login, and it is the agent's own
 * book of business. The check happens on the SERVER for every page: a client
 * route guard is an experience, not authorization, and the difference matters
 * on a surface that lists strangers' finances.
 *
 * Returns null rather than throwing when Supabase is unconfigured, so a
 * developer without credentials sees an honest "not signed in" rather than a
 * crash they have to read a stack trace to understand.
 */
export interface AgentSession {
  userId: string;
  email: string;
  agentId: string;
  name: string;
}

/**
 * Three answers, not two.
 *
 * `currentAgent()` returned `AgentSession | null`, and null meant four
 * different things: nobody is signed in, Supabase is not configured, the auth
 * call did not answer within two seconds, and the agent row could not be read.
 * Every caller turned all four into `redirect("/operations/sign-in")`.
 *
 * So a two-second blip signed the agent out. Not really: the cookie was still
 * there and the next request worked, but he was looking at a sign-in page,
 * which says his session expired. It is reproducible on the first request
 * after a cold start, and Vercel gives you a cold start plus a round trip to
 * Supabase's auth service on exactly the requests most likely to be slow.
 *
 * This is the same discipline as DbResult in lib/db/result.ts, in the one
 * place it was missing: "it did not work" and "there is nobody here" are
 * different facts, and collapsing them produces a product that lies about
 * which one happened.
 */
export type SessionState =
  | { state: "signed-in"; agent: AgentSession }
  /** There is genuinely no session, or the user is not an agent. */
  | { state: "signed-out"; reason: string }
  /** We could not find out. Never a reason to show a sign-in page. */
  | { state: "unknown"; reason: string };

export async function agentSession(): Promise<SessionState> {
  const supabase = await createClient();
  if (!supabase) return { state: "unknown", reason: "sign-in is not configured on this deployment" };

  /* Still on a deadline. Studio is behind a login and a hang leaves the agent
     looking at a blank tab, but a miss now reports itself as a miss instead
     of as an absence. */
  const { value: auth, timedOut } = await withTimeout(
    supabase.auth.getUser().then((r) => r).catch(() => null),
    AUTH_DEADLINE_MS,
    null,
  );
  if (timedOut) return { state: "unknown", reason: "the sign-in check did not answer in time" };
  if (!auth) return { state: "unknown", reason: "the sign-in check failed" };

  /* An auth error is genuinely signed-out: a missing, malformed or expired
     token is what that error IS. Only the absence of an answer is unknown. */
  if (auth.error || !auth.data?.user) return { state: "signed-out", reason: "no session" };
  const data = auth.data;

  const db = serviceClient();
  if (!db) return { state: "unknown", reason: "the database is not configured" };

  const { value: agentRead, timedOut: agentTimedOut } = await withTimeout(
    Promise.resolve(
      db.from("rift_agents").select("id,name,email").eq("auth_user_id", data.user.id).maybeSingle(),
    ),
    AUTH_DEADLINE_MS,
    null,
  );
  if (agentTimedOut) return { state: "unknown", reason: "the agent record did not load in time" };
  if (!agentRead || agentRead.error) return { state: "unknown", reason: "the agent record could not be read" };

  const agent = agentRead.data ?? null;

  /* A signed-in user who is not an agent row is not an agent. There is no
     implicit provisioning here: creating an agent record because somebody
     managed to sign up would hand a stranger the book of business.

     This one IS signed-out rather than unknown: the question was asked and
     answered, and the answer was no. */
  if (!agent) return { state: "signed-out", reason: "signed in, but not an agent on this account" };

  return {
    state: "signed-in",
    agent: {
      userId: data.user.id,
      email: (agent.email as string) ?? data.user.email ?? "",
      agentId: agent.id as string,
      name: (agent.name as string) ?? "Agent",
    },
  };
}

/**
 * The narrow question: who is asking, or nobody.
 *
 * Kept for the write actions, where the distinction does not help: an action
 * that cannot confirm the session must refuse either way, and refusing is what
 * this returns. Every PAGE should use `agentSession()` instead, because a page
 * has somewhere better to send a person than a sign-in form they do not need.
 */
export async function currentAgent(): Promise<AgentSession | null> {
  const s = await agentSession();
  return s.state === "signed-in" ? s.agent : null;
}
