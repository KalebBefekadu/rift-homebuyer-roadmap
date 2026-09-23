import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";
import { captureOpError } from "@/lib/monitoring/capture";

/**
 * The service-role client.
 *
 * Bypasses RLS entirely, so it never reaches the browser and is never imported
 * by a client component: `server-only` above turns that mistake into a build
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
 * integration must degrade visibly rather than take the process down:
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
   * bundle was compiled, and changing the runtime environment does nothing:
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
 * That is not hypothetical: it happened the first time this was run against a
 * real database, and the symptom was every write skipping while the row was
 * plainly there in the table.
 *
 * **It refuses to guess when there is more than one agent.** This used to be
 * `select id from rift_agents limit 1`, which is correct for exactly as long
 * as that table has one row and silently wrong the instant it has two: a
 * stranger's lead would be attached to whichever row Postgres happened to
 * return, and nothing anywhere would report it. Every RLS policy in the schema
 * is written `agent_id = rift_my_agent_id()`, so the database is built for
 * several agents even though the product is not, and the gap between those
 * two facts is the kind that gets discovered by an agent reading somebody
 * else's client list.
 *
 * Refusing means every public write reports `skipped` with its own honest
 * reason, which is the house rule: degrade visibly, never a silent success.
 * It is also loud enough that whoever adds the second agent finds out
 * immediately rather than a quarter later.
 */
let agentId: string | null = null;
let missingUntil = 0;

const MISSING_RETRY_MS = 10_000;

/** The second try's deadline. Long enough to absorb a cold connection, short
    enough to stay well inside the six-second write deadline behind it. */
const COLD_START_MS = 3_500;

export async function currentAgentId(): Promise<string | null> {
  if (agentId) return agentId;
  if (Date.now() < missingUntil) return null;

  const db = serviceClient();
  if (!db) { missingUntil = Date.now() + MISSING_RETRY_MS; return null; }

  /* On a deadline, because this read gates EVERY write.
     
     It is not the write itself: a deadline on a write that then reported
     success would be worse than waiting: it is the lookup in front of one. An
     unbounded lookup means a hung database holds every request open until the
     platform kills it, which on a serverless runtime exhausts concurrency and
     is billed the whole time.
     
     A timeout returns null, so the caller reports `skipped` with its own
     reason rather than pretending the write happened. */
  /* Two, not one. Asking for a single row cannot distinguish "the agent" from
     "the first of several", and that distinction is the whole point. */
  const ask = () => Promise.resolve(db.from("rift_agents").select("id").limit(2));

  /* A SLOW ANSWER IS NOT "NO AGENT".

     This used to treat a timeout exactly like an empty table: return null AND
     remember the absence for ten seconds. The first query on a freshly started
     serverless instance routinely takes longer than the two-second read
     deadline (it is paying for the connection) so every cold start began
     with ten seconds in which this function told every caller the agent did
     not exist. Every write in the product gates on it. A lead captured in that
     window reported `skipped`, which the readout renders as "email is not
     switched on yet", and the stranger's address was simply not stored. An
     offer submitted in it was refused with "no agent row exists yet". Found on
     production, by a health check that had just been taught to stop lying,
     returning 503 once and then 200 eight times in a row.

     So: one retry with a longer deadline to absorb the connection cost, and a
     timeout or a transport error is NEVER remembered. Only a definite answer:
     the table is genuinely empty: is cached, because only that is a fact. */
  let attempt = await withTimeout(ask(), READ_DEADLINE_MS, null);
  if (attempt.timedOut) attempt = await withTimeout(ask(), COLD_START_MS, null);

  const result = attempt.value;
  if (attempt.timedOut || !result) return null;

  const { data, error } = result;
  if (error) return null;
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) { missingUntil = Date.now() + MISSING_RETRY_MS; return null; }

  if (rows.length > 1) {
    /* Not cached, and not retried on a short timer either: this is a
       deployment that has outgrown an assumption baked into every module that
       calls this, and it needs a person, not a retry. */
    captureOpError(
      new Error("more than one agent row exists; the single-agent assumption in lib/db/service.ts no longer holds"),
      { op: "agent.resolve" },
    );
    return null;
  }

  agentId = rows[0]!.id;
  return agentId;
}

/**
 * The agent's own email address.
 *
 * Read through the service client rather than from a session, because the
 * caller is `/api/capture`: an anonymous stranger's request, with nobody
 * signed in. There is one agent (see `currentAgentId` above, which refuses
 * outright when that stops being true), so this is his address.
 *
 * Cached alongside the id and on the same terms: a success is kept, an
 * absence is not. Returns null rather than throwing, so a deployment with no
 * database sends no alert instead of failing a capture: the lead is worth
 * more than the notification about it.
 */
let agentEmail: string | null = null;

export async function currentAgentEmail(): Promise<string | null> {
  if (agentEmail) return agentEmail;

  const id = await currentAgentId();
  if (!id) return null;

  const db = serviceClient();
  if (!db) return null;

  const query = Promise.resolve(db.from("rift_agents").select("email").eq("id", id).maybeSingle());
  const { value: result, timedOut } = await withTimeout(query, READ_DEADLINE_MS, null);
  if (timedOut || !result || result.error) return null;

  const email = (result.data as { email?: string } | null)?.email;
  if (!email) return null;

  agentEmail = email;
  return agentEmail;
}

let agentPublic: { name: string } | null = null;

/**
 * The agent's name, for a page rendered to somebody who is not signed in.
 *
 * Deliberately separate from `currentAgent()` in lib/db/session.ts, which
 * resolves a SESSION. The client's plan at /plan/<token> has no session by
 * design, and reaching for the session-based one there would have returned
 * null and addressed the client's own agent as "your agent" on every line.
 *
 * Name only. It is the one field on the agent row that is already public:
 * it is on the landing page, in the structured data and on the readout, and
 * a helper that returned the row would put the email in front of the next
 * page that calls it.
 */
export async function currentAgentPublic(): Promise<{ name: string } | null> {
  if (agentPublic) return agentPublic;

  const id = await currentAgentId();
  if (!id) return null;

  const db = serviceClient();
  if (!db) return null;

  const query = Promise.resolve(db.from("rift_agents").select("name").eq("id", id).maybeSingle());
  const { value: result, timedOut } = await withTimeout(query, READ_DEADLINE_MS, null);
  if (timedOut || !result || result.error) return null;

  const name = (result.data as { name?: string } | null)?.name;
  if (!name) return null;

  agentPublic = { name };
  return agentPublic;
}
