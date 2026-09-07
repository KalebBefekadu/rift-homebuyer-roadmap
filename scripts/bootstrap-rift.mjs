#!/usr/bin/env node
/**
 * Creates the agent row Rift needs before anything can be recorded.
 *
 * Until this runs, every write reports "no agent row exists yet" and skips —
 * honestly, but completely. This is the one manual step between a fresh
 * database and a working product.
 *
 * Deliberately NOT automatic. Provisioning an agent because somebody signed up
 * would hand the book of business to whoever registered first, and this is a
 * single-agent product where that mistake has no recovery.
 *
 * Usage:
 *   node --env-file=.env.local scripts/bootstrap-rift.mjs
 *   node --env-file=.env.local scripts/bootstrap-rift.mjs --email you@example.com --name "Your Name"
 *
 * Idempotent: running it twice reports the existing agent rather than creating
 * a second one.
 */
import { createClient } from "@supabase/supabase-js";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "The service-role key is in Supabase → Settings → API. It bypasses RLS, so keep it\n" +
    "in .env.local and never in anything the browser can read.",
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const email = arg("--email", "kaleb@example.com");
const name = arg("--name", "Kaleb Befekadu");
const brokerage = arg("--brokerage", "Peachtree Cardinal");
const authUserId = arg("--auth-user-id", null);

const { data: existing, error: readErr } = await db
  .from("rift_agents").select("id,name,email,auth_user_id").limit(1).maybeSingle();

if (readErr) {
  console.error("Could not read rift_agents. Has the migration been applied?\n", readErr.message);
  process.exit(1);
}

let agentId;
if (existing) {
  agentId = existing.id;
  console.log(`Agent already exists: ${existing.name} <${existing.email}>`);
  if (!existing.auth_user_id && authUserId) {
    const { error } = await db.from("rift_agents").update({ auth_user_id: authUserId }).eq("id", agentId);
    if (error) { console.error("Could not link auth user:", error.message); process.exit(1); }
    console.log(`Linked to auth user ${authUserId}. Studio will now sign in.`);
  } else if (!existing.auth_user_id) {
    console.log(
      "\nNot linked to an auth user yet, so Studio will refuse to sign in.\n" +
      "Create the login in Supabase → Authentication → Users, then re-run with:\n" +
      "  --auth-user-id <that user's uuid>",
    );
  }
} else {
  const { data, error } = await db
    .from("rift_agents")
    .insert({ name, email, brokerage, auth_user_id: authUserId, service_area: ["DeKalb", "Fulton", "Cobb", "Gwinnett"] })
    .select("id").single();
  if (error) { console.error("Could not create the agent:", error.message); process.exit(1); }
  agentId = data.id;
  console.log(`Created agent ${name} <${email}>`);
}

/* Business rules are seeded WITHOUT decided_at. A rule nobody has looked at
   must stay distinguishable from one the owner chose — two of these are the
   broker's call and one has a legal floor. */
const DEFAULTS = {
  commissionPct: 2.5,
  autoEmailReadout: false,
  registryOwner: name,
  registryDays: 90,
  clientRetentionYears: 5,
  marketUnrepresented: false,
};

const rows = Object.entries(DEFAULTS).map(([key, value]) => ({
  agent_id: agentId, key, value, decided_at: null,
}));

const { error: ruleErr } = await db
  .from("rift_business_rules")
  .upsert(rows, { onConflict: "agent_id,key", ignoreDuplicates: true });
if (ruleErr) { console.error("Could not seed business rules:", ruleErr.message); process.exit(1); }

const { count } = await db.from("rift_programs").select("*", { count: "exact", head: true });

console.log(`
Ready.
  agent_id     ${agentId}
  programmes   ${count ?? 0} in the registry
  rules        ${rows.length} seeded, all still on their defaults

Next:
  1. Seed the registry if the count above is 0:
       psql "$DATABASE_URL" -f supabase/seed/rift_programs.sql
  2. Decide the six business rules. Two are the broker's call and one has a
     legal floor — see docs/handoff.md section 8.
  3. Open /studio.
`);
