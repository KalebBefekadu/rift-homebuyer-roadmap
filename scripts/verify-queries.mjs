#!/usr/bin/env node
/**
 * Runs every PostgREST query the data layer uses, against a real PostgREST.
 *
 * This exists because embedded selects — `rift_leads(name,email)`,
 * `rift_touches(step_id)` — are STRINGS. TypeScript cannot check them, the
 * build cannot check them, and they fail at runtime with a message about a
 * schema cache. They are the least-verified and most brittle code in the
 * project, and a broken one takes down a page rather than a query.
 *
 * Setup (one time):
 *   docker run -d --name rift-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16-alpine
 *   npm test                       # applies the migrations and the seed
 *   psql ... -f supabase/test/postgrest-grants.sql
 *   docker run -d --name rift-postgrest --network host \
 *     -e PGRST_DB_URI="postgres://authenticator:pw@localhost:55432/postgres" \
 *     -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
 *     -e PGRST_JWT_SECRET="rift-local-test-secret-at-least-32-chars-long" \
 *     -e PGRST_SERVER_PORT=3001 postgrest/postgrest
 *
 *   node scripts/verify-queries.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const SECRET = process.env.PGRST_JWT_SECRET ?? "rift-local-test-secret-at-least-32-chars-long";
const BASE = process.env.PGRST_URL ?? "http://localhost:3001";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({ role: "anon", iat: now, exp: now + 3600 });
const token = `${head}.${payload}.${createHmac("sha256", SECRET).update(`${head}.${payload}`).digest("base64url")}`;

/* supabase-js prefixes /rest/v1; PostgREST serves at the root. Rewriting the
   path here keeps the real supabase-js query builder in the loop, which is the
   entire point — testing hand-written URLs would verify nothing. */
const db = createClient(BASE, token, {
  auth: { persistSession: false },
  global: { fetch: (input, init) => fetch(String(input).replace("/rest/v1/", "/"), init) },
});

const results = [];
const check = async (name, fn) => {
  try {
    const r = await fn();
    results.push([r?.error ? "FAIL" : "ok", name, r?.error?.message ?? ""]);
  } catch (e) {
    results.push(["THROW", name, e.message]);
  }
};

await check("readRegistry", () => db.from("rift_programs")
  .select("slug,name,administrator,type,funding_state,amount_min,amount_max,county,first_time_only,reopens,source_note,income_limit_note,price_cap_note,conditions,verified_on,verified_by")
  .eq("active", true).order("verified_on", { ascending: false }));

await check("rankedLeads (embedded enrolment)", () => db.from("rift_leads")
  .select("id,name,email,side,score,band,signals,created_at,human_replied_at,assessment_id,rift_enrolments(stop_reason)")
  .order("score", { ascending: false }).limit(5));

await check("rankedLeads snapshot join", () => db.from("rift_readouts")
  .select("assessment_id,figures,share_token,created_at")
  .in("assessment_id", ["00000000-0000-4000-8000-000000000000"])
  .order("created_at", { ascending: false }));

await check("nurture due (embedded lead + touches)", () => db.from("rift_enrolments")
  .select("id,lead_id,band,entered_at,phone_consent,rift_leads(name,email),rift_touches(step_id)")
  .is("stopped_at", null));

await check("abandoned (embedded answers + leads)", () => db.from("rift_assessments")
  .select("id,session_id,side,county,started_at,rift_answers(question_key),rift_leads(email)")
  .is("completed_at", null).order("started_at", { ascending: false }));

await check("funnelReport", () => db.from("rift_events")
  .select("session_id,name,question_key,dwell_ms").eq("side", "buy")
  .in("name", ["assessment_start", "question_view", "question_answer"]));

await check("openItems", () => db.from("rift_review_items")
  .select("id,who,kind,what,claim,state,ceiling,raised_by,to_advance,confirmed_by,raised_at")
  .is("resolved_at", null).order("raised_at", { ascending: true }));

await check("currentRate", () => db.from("rift_rate_snapshots")
  .select("rate_pct,source,as_of").eq("product", "conventional-30-fixed")
  .order("as_of", { ascending: false }).limit(1).maybeSingle());

await check("readByToken", () => db.from("rift_readouts")
  .select("assessment_id,side,inputs,figures,matched,created_at").eq("share_token", "none").maybeSingle());

await check("currentAgent", () => db.from("rift_agents")
  .select("id,name,email").eq("auth_user_id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("startAssessment lookup", () => db.from("rift_assessments")
  .select("id").eq("session_id", "none").eq("side", "buy").is("completed_at", null).maybeSingle());

await check("attribution lookup", () => db.from("rift_attributions")
  .select("session_id,visits").eq("session_id", "none").maybeSingle());

for (const [status, name, err] of results) {
  console.log(`${status.padEnd(6)} ${name}${err ? "  → " + err.slice(0, 140) : ""}`);
}

const bad = results.filter((r) => r[0] !== "ok").length;
console.log(bad ? `\n${bad} query path(s) broken` : `\nAll ${results.length} query paths OK`);
process.exit(bad ? 1 : 0);
