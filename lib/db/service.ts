import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client.
 *
 * Bypasses RLS entirely, so it never reaches the browser and is never imported
 * by a client component — `server-only` above turns that mistake into a build
 * error rather than a breach.
 *
 * It exists because three things must be written by paths a visitor does not
 * control: telemetry, attribution, and answers. If the browser could insert
 * into `rift_events`, the funnel numbers the agent makes decisions from could
 * be poisoned from a console, and the first sign of it would be a strategy
 * built on invented data.
 *
 * Returns null when unconfigured rather than throwing. The specification at
 * /prototype runs with an empty environment on purpose, and a missing
 * integration must degrade visibly rather than take the process down —
 * see docs/integrations.md.
 */
let cached: SupabaseClient | null | undefined;

export function serviceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.includes("your-project")) {
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-rift-source": "server" } },
  });
  return cached;
}

/** Whether the database is reachable at all. Callers report this, never hide it. */
export const dbConfigured = () => serviceClient() !== null;

/**
 * The single-agent id.
 *
 * Rift serves one agent today. Every table already carries `agent_id` so that
 * multi-tenancy is a query change rather than a migration, but resolving it
 * per request would be four round trips to learn something that cannot vary.
 * When a second agent exists, this becomes a lookup and nothing else moves.
 */
let agentId: string | null | undefined;

export async function currentAgentId(): Promise<string | null> {
  if (agentId !== undefined) return agentId;
  const db = serviceClient();
  if (!db) { agentId = null; return null; }

  const { data, error } = await db.from("rift_agents").select("id").limit(1).maybeSingle();
  if (error || !data) { agentId = null; return null; }
  agentId = data.id as string;
  return agentId;
}
