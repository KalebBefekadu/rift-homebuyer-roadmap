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

  /**
   * `SUPABASE_URL` first, `NEXT_PUBLIC_SUPABASE_URL` only as a fallback.
   *
   * NEXT_PUBLIC_ variables are inlined into the bundle at BUILD time. Server
   * code that reads one is therefore pinned to whatever value was set when the
   * bundle was compiled, and changing the runtime environment does nothing —
   * the process keeps talking to the old project while every environment
   * variable on the machine says otherwise.
   *
   * That is not a hypothetical: it is exactly what happened the first time this
   * was pointed at a local database, and the symptom was a server that
   * reported "no agent row exists yet" while never opening a connection.
   */
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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

/**
 * The single-agent id.
 *
 * Rift serves one agent today. Every table already carries `agent_id` so that
 * multi-tenancy is a query change rather than a migration, but resolving it on
 * every request would be a round trip to learn something that cannot vary.
 *
 * Only a SUCCESSFUL lookup is cached forever. An absent agent is cached for a
 * few seconds and then retried, because "there is no agent row" is a temporary
 * truth: the bootstrap is a manual step that runs after the first deploy, and
 * caching its absence permanently meant a long-lived instance answered "no
 * agent row exists yet" to every request until somebody restarted it.
 *
 * That is not hypothetical — it happened the first time this was run against a
 * real database, and the symptom was every write skipping while the row was
 * plainly there in the table.
 */
let agentId: string | null = null;
let missingUntil = 0;

const MISSING_RETRY_MS = 10_000;

export async function currentAgentId(): Promise<string | null> {
  if (agentId) return agentId;
  if (Date.now() < missingUntil) return null;

  const db = serviceClient();
  if (!db) { missingUntil = Date.now() + MISSING_RETRY_MS; return null; }

  const { data, error } = await db.from("rift_agents").select("id").limit(1).maybeSingle();
  if (error || !data) { missingUntil = Date.now() + MISSING_RETRY_MS; return null; }

  agentId = data.id as string;
  return agentId;
}

