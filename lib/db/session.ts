import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "./service";

/**
 * Who is asking, on the agent surface.
 *
 * Studio is the only part of Rift behind a login, and it is the agent's own
 * book of business. The check happens on the SERVER for every page — a client
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

export async function currentAgent(): Promise<AgentSession | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  const db = serviceClient();
  if (!db) return null;

  const { data: agent } = await db
    .from("rift_agents")
    .select("id,name,email")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  /* A signed-in user who is not an agent row is not an agent. There is no
     implicit provisioning here: creating an agent record because somebody
     managed to sign up would hand a stranger the book of business. */
  if (!agent) return null;

  return {
    userId: data.user.id,
    email: (agent.email as string) ?? data.user.email ?? "",
    agentId: agent.id as string,
    name: (agent.name as string) ?? "Agent",
  };
}
