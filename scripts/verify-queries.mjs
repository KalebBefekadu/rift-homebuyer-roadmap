#!/usr/bin/env node
/**
 * Runs every PostgREST query the data layer uses, against a real PostgREST.
 *
 * This exists because embedded selects: `rift_leads(name,email)`,
 * `rift_touches(step_id)`: are STRINGS. TypeScript cannot check them, the
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
   entire point: testing hand-written URLs would verify nothing. */
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
  .select("id,name,email,side,score,band,signals,lead_input,created_at,human_replied_at,assessment_id,rift_enrolments(stop_reason)")
  .order("score", { ascending: false }).limit(5));

await check("rankedLeads snapshot join", () => db.from("rift_readouts")
  .select("assessment_id,figures,share_token,created_at")
  .in("assessment_id", ["00000000-0000-4000-8000-000000000000"])
  .order("created_at", { ascending: false }));

await check("nurture due (embedded lead + touches)", () => db.from("rift_enrolments")
  .select("id,lead_id,band,entered_at,phone_consent,rift_leads(name,email,assessment_id,side),rift_touches(step_id)")
  .is("stopped_at", null));

await check("nurture progress count", () => db.from("rift_answers")
  .select("assessment_id")
  .in("assessment_id", ["00000000-0000-4000-8000-000000000000"]));

await check("nurture touch snapshot join", () => db.from("rift_readouts")
  .select("assessment_id,figures,share_token,created_at,rift_assessments(county)")
  .in("assessment_id", ["00000000-0000-4000-8000-000000000000"])
  .order("created_at", { ascending: false }));

await check("abandoned (embedded answers + leads)", () => db.from("rift_assessments")
  .select("id,session_id,side,county,started_at,rift_answers(question_key),rift_leads(email)")
  .is("completed_at", null).order("started_at", { ascending: false }));

await check("funnelReport (rpc)", () => db.rpc("rift_funnel_report", {
  p_agent: "00000000-0000-4000-8000-000000000000", p_side: "buy", p_days: 90,
}));

await check("funnelStarts (rpc)", () => db.rpc("rift_funnel_starts", {
  p_agent: "00000000-0000-4000-8000-000000000000", p_side: "buy", p_days: 90,
}));

await check("openItems", () => db.from("rift_review_items")
  .select("id,who,kind,what,claim,state,ceiling,raised_by,to_advance,confirmed_by,raised_at,figure_id,rift_figures(label,value_cents,trust_state,assumptions,could_be_wrong)")
  .is("resolved_at", null).order("raised_at", { ascending: true }));

await check("currentRate", () => db.from("rift_rate_snapshots")
  .select("rate_pct,source,as_of").eq("product", "conventional-30-fixed")
  .order("as_of", { ascending: false }).limit(1).maybeSingle());

await check("figures for a shared readout", () => db.from("rift_figures")
  .select("label,value_cents,trust_state,confirmed_by,assumptions,could_be_wrong")
  .eq("readout_id", "00000000-0000-4000-8000-000000000000")
  .order("created_at", { ascending: true }));

await check("readByToken", () => db.from("rift_readouts")
  .select("assessment_id,side,inputs,figures,matched,created_at").eq("share_token", "none").maybeSingle());

await check("published questions", () => db.from("rift_questions")
  .select("*", { count: "exact", head: true })
  .eq("funnel_version_id", "00000000-0000-4000-8000-000000000000"));

await check("currentAgent", () => db.from("rift_agents")
  .select("id,name,email").eq("auth_user_id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("startAssessment lookup", () => db.from("rift_assessments")
  .select("id").eq("session_id", "none").eq("side", "buy").is("completed_at", null).maybeSingle());

await check("attribution lookup", () => db.from("rift_attributions")
  .select("session_id,visits").eq("session_id", "none").maybeSingle());

/* ------------------------------------------------------------------ *
 * Added 21 September 2026, with the five features built that day.
 *
 * Every one of these is a hand-written column list against a table that did
 * not exist this morning. They are exactly the code this script exists for:
 * TypeScript cannot check a string, and a wrong column here fails at runtime
 * with a message about a schema cache, taking a page down rather than a query.
 * ------------------------------------------------------------------ */

await check("finishedRelationships (terminal stages)", () => db.from("rift_leads")
  .select("id,stage").in("stage", ["Closed", "Lost"]).limit(5));

await check("finishedRelationships stage history", () => db.from("rift_lead_notes")
  .select("lead_id,from_stage,to_stage").eq("kind", "stage")
  .in("lead_id", ["00000000-0000-4000-8000-000000000000"]).limit(5));

await check("liveRelationships (lead_input jsonb)", () => db.from("rift_leads")
  .select("name,stage,lead_input")
  .is("archived_at", null).not("stage", "is", null)
  .not("stage", "in", "(Closed,Lost)").limit(5));

await check("representationOf", () => db.from("rift_leads")
  .select("representation,representation_signed_on,representation_expires_on")
  .eq("id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("lapsingAgreements", () => db.from("rift_leads")
  .select("id,name,side,representation,representation_signed_on,representation_expires_on")
  .is("archived_at", null).eq("representation", "signed")
  .not("representation_expires_on", "is", null)
  .lte("representation_expires_on", "2026-12-31")
  .order("representation_expires_on", { ascending: true }).limit(5));

await check("referralTokenFor", () => db.from("rift_leads")
  .select("referral_token").eq("id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("referralLinks (who they sent)", () => db.from("rift_leads")
  .select("id,name,stage").eq("referred_by", "00000000-0000-4000-8000-000000000000").limit(5));

await check("firstRefFor", () => db.from("rift_attributions")
  .select("first_ref").eq("session_id", "none").maybeSingle());

await check("resolveReferrer by client token", () => db.from("rift_leads")
  .select("id,session_id").eq("referral_token", "none").maybeSingle());

await check("resolveReferrer by share token", () => db.from("rift_readouts")
  .select("assessment_id").eq("share_token", "none").maybeSingle());

await check("decisionsFor", () => db.from("rift_decisions")
  .select("id,kind,question,context,decide_by,released_at,decided_at,chosen_option_id,outcome_note")
  .eq("lead_id", "00000000-0000-4000-8000-000000000000")
  .order("created_at", { ascending: false }).limit(5));

await check("releasedFor (client read)", () => db.from("rift_decisions")
  .select("id,kind,question,context,decide_by,released_at,decided_at,chosen_option_id,outcome_note")
  .eq("lead_id", "00000000-0000-4000-8000-000000000000")
  .not("released_at", "is", null)
  .order("created_at", { ascending: false }).limit(5));

await check("decision options", () => db.from("rift_decision_options")
  .select("decision_id,id,label,detail,amount_cents,amount_label,upside,downside,sort")
  .in("decision_id", ["00000000-0000-4000-8000-000000000000"])
  .order("sort", { ascending: true }).limit(5));

await check("roomFor (agent)", () => db.from("rift_offer_rooms")
  .select("prepared,take,approved_at,approved_for,chosen_offer_id,chosen_at,chosen_seen,client_note")
  .eq("lead_id", "00000000-0000-4000-8000-000000000000").eq("agent_id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("clientRoomFor (seller)", () => db.from("rift_offer_rooms")
  .select("take,approved_at,approved_for,chosen_offer_id,chosen_at,chosen_seen")
  .eq("lead_id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("recentChoices", () => db.from("rift_offer_rooms")
  .select("lead_id,chosen_at,chosen_seen,client_note")
  .eq("agent_id", "00000000-0000-4000-8000-000000000000").not("chosen_offer_id", "is", null)
  .gte("chosen_at", new Date(0).toISOString()).order("chosen_at", { ascending: false }).limit(10));

await check("chooseOffer seller read", () => db.from("rift_leads")
  .select("agent_id,name,side,payoff_cents,commission_pct")
  .eq("id", "00000000-0000-4000-8000-000000000000").maybeSingle());

await check("referralQueue lifecycle columns", () => db.from("rift_leads")
  .select("id,name,email,side,stage,closed_on,mood,mood_at,client_token,assessment_id,referred_by")
  .is("archived_at", null).limit(5));

await check("readoutsFor (was rift_leads.figure_id, which does not exist)", () =>
  db.from("rift_readouts").select("assessment_id")
    .in("assessment_id", ["00000000-0000-4000-8000-000000000000"]).limit(5));

await check("referral moments", () => db.from("rift_referral_moments")
  .select("lead_id,moment_id,occurrence,state")
  .in("lead_id", ["00000000-0000-4000-8000-000000000000"]).limit(5));

/* The sweep. Every remaining distinct column list in lib/db, added after
   figure_id proved that an unverified one is an unexploded page. */

const NIL = "00000000-0000-4000-8000-000000000000";

await check("offersFor (inbound offer columns)", () => db.from("rift_offers")
  .select("id,property_address,offered_by,submitted_email,submitted_phone,submitted_firm,representing,price_cents,concessions_cents,repair_credit_cents,earnest_cents,financing,close_on,contingencies,preapproval,proof_of_funds,note,submitter_lead_id,created_at")
  .limit(5));

await check("dueActions follow-up columns", () => db.from("rift_leads")
  .select("id,name,side,next_action,next_due,client_token").limit(5));

await check("planItemsDue", () => db.from("rift_plan_items")
  .select("id,title,owner,owner_name,due_on,lead_id").is("done_at", null).limit(5));

await check("readPlanByToken items", () => db.from("rift_plan_items")
  .select("id,title,owner,owner_name,due_on,done_at,sort").eq("lead_id", NIL).limit(5));

await check("SAFE_LEAD_COLUMNS", () => db.from("rift_leads")
  .select("id,name,side,stage,stage_since,client_token").eq("client_token", "none").maybeSingle());

await check("seller costs", () => db.from("rift_leads")
  .select("payoff_cents,commission_pct").eq("id", NIL).maybeSingle());

await check("lead notes", () => db.from("rift_lead_notes")
  .select("id,kind,body,from_stage,to_stage,at").eq("lead_id", NIL).limit(5));

await check("board / roster base columns", () => db.from("rift_leads")
  .select("id,name,email,phone,side,stage,stage_since,source,contact_basis,score,band,created_at,archived_at,archived_reason,next_action,next_due")
  .limit(5));

await check("stored figures", () => db.from("rift_figures")
  .select("label,value_cents,trust_state,confirmed_by,assumptions,could_be_wrong").limit(5));

await check("business rules", () => db.from("rift_business_rules")
  .select("key,value,decided_at,decided_by").limit(5));

await check("funnel wording", () => db.from("rift_questions")
  .select("key,title,description,field_label,options").limit(5));

await check("review promote", () => db.from("rift_review_items")
  .select("id,state,ceiling,kind,figure_id").eq("id", NIL).maybeSingle());

await check("retention orphan sweep", () => db.from("rift_assessments")
  .select("id,rift_leads(id)").limit(5));

await check("nurture stop check", () => db.from("rift_leads")
  .select("id,rift_enrolments(stopped_at)").limit(5));

await check("markReplied", () => db.from("rift_leads")
  .select("human_replied_at").eq("id", NIL).maybeSingle());

/* Blueprint v4: journeys, members, the search brief, packages, shortlist. */

await check("journeysFor / buyingJourneys", () => db.from("rift_journeys")
  .select("id,origin_lead_id,side,label,created_at").eq("agent_id", NIL).eq("side", "buy")
  .order("created_at", { ascending: false }).limit(5));

await check("membersOf", () => db.from("rift_journey_members")
  .select("id,email,display_name,role,scopes,invited_at,accepted_at,revoked_at,invite_expires_at")
  .eq("journey_id", NIL).order("invited_at").limit(5));

await check("memberOf (client gate)", () => db.from("rift_journey_members")
  .select("id,journey_id,agent_id,role,scopes,display_name,email,accepted_at,revoked_at,invite_expires_at")
  .eq("auth_user_id", NIL).eq("journey_id", NIL).is("revoked_at", null).maybeSingle());

await check("invitationByToken", () => db.from("rift_journey_members")
  .select("id,email,journey_id,agent_id,accepted_at,revoked_at,invite_expires_at")
  .eq("invite_token_hash", "0".repeat(64)).maybeSingle());

await check("search revisions", () => db.from("rift_search_revisions")
  .select("id,revision,criteria,questions,note,author_kind,author_label,created_at")
  .eq("journey_id", NIL).order("revision", { ascending: false }).limit(5));

await check("search packages", () => db.from("rift_search_packages")
  .select("id,revision_id,cadence,package,status,approved_at,approved_by,external_ref,external_url,confirmed_at,confirm_note,ended_at")
  .eq("journey_id", NIL).order("approved_at", { ascending: false }).limit(5));

await check("searchStatuses packages", () => db.from("rift_search_packages")
  .select("journey_id,revision_id,status,package").in("journey_id", [NIL])
  .in("status", ["manual-action-needed", "active-confirmed", "paused"]));

await check("search responses", () => db.from("rift_search_responses")
  .select("id,revision_id,member_id,response,note,created_at").eq("revision_id", NIL).order("created_at").limit(5));

await check("shortlist homes", () => db.from("rift_shortlist_homes")
  .select("id,address,url,facts,facts_source,facts_as_of,added_by_label,created_at,withdrawn_at,withdrawn_reason")
  .eq("journey_id", NIL).order("created_at", { ascending: false }).limit(5));

await check("home reactions", () => db.from("rift_home_reactions")
  .select("home_id,member_id,actor_label,reaction,reason,created_at").eq("journey_id", NIL).order("created_at").limit(5));

await check("readoutStart", () => db.from("rift_readouts")
  .select("inputs,created_at,side").eq("assessment_id", NIL).eq("agent_id", NIL)
  .order("created_at", { ascending: false }).limit(1).maybeSingle());

await check("approve rpc exists (refuses a stranger)", async () => {
  const r = await db.rpc("rift_approve_search_package", {
    p_agent: NIL, p_journey: NIL, p_revision: NIL, p_cadence: "daily",
    p_package: {}, p_hash: "0".repeat(64), p_by: "x", p_request: NIL,
  });
  /* The function must be FOUND; "not in your book" is the right refusal. */
  return r.error && /not in your book/.test(r.error.message) ? { data: null, error: null } : r;
});

await check("confirm rpc exists (refuses a stranger)", async () => {
  const r = await db.rpc("rift_confirm_search_package", {
    p_agent: NIL, p_package: NIL, p_ref: "x", p_url: null, p_note: null, p_request: NIL,
  });
  return r.error && /not in your book/.test(r.error.message) ? { data: null, error: null } : r;
});

await check("tour stops (readTours)", () => db.from("rift_tour_stops")
  .select("id,home_id,requested_by_label,requested_by_member,availability,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at", { ascending: false }).limit(1));
await check("tour steps (readTours)", () => db.from("rift_tour_steps")
  .select("stop_id,seq,status,starts_at,ends_at,ref,note,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("seq").limit(1));
await check("tour feedback (readTours)", () => db.from("rift_tour_feedback")
  .select("stop_id,member_id,actor_label,offer,reason,search_change,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at").limit(1));
await check("tour homes (readTours)", () => db.from("rift_shortlist_homes")
  .select("id,address,withdrawn_at").eq("journey_id", NIL).eq("agent_id", NIL).limit(1));
await check("tour step replay (recordTourStep)", () => db.from("rift_tour_steps")
  .select("seq").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("buyer agreement (coverageFor)", () => db.from("rift_leads")
  .select("representation,representation_signed_on,representation_expires_on").eq("id", NIL).eq("agent_id", NIL).maybeSingle());
await check("journey events (readProgress)", () => db.from("rift_journey_events")
  .select("seq,kind,from_value,to_value,reason,evidence,transaction_id,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("seq").limit(1));
await check("contracts (readProgress)", () => db.from("rift_transactions")
  .select("id,home_id,financing,evidence,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at", { ascending: false }).limit(1));
await check("contract outcomes (readProgress)", () => db.from("rift_transaction_outcomes")
  .select("transaction_id,outcome,reason,actor_label,created_at").eq("journey_id", NIL).eq("agent_id", NIL).limit(1));
await check("workstream updates (readProgress)", () => db.from("rift_workstream_updates")
  .select("transaction_id,workstream,seq,state,owner,owner_name,source,confirmed_on,note,actor_kind,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("seq").limit(1));
await check("event replay (changeStage)", () => db.from("rift_journey_events")
  .select("id").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("contract replay (recordContract)", () => db.from("rift_transactions")
  .select("id").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("work replay (recordWork)", () => db.from("rift_workstream_updates")
  .select("id").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("journey plan (planItemsFor)", () => db.from("rift_plan_items")
  .select("id,title,owner,owner_name,due_on,done_at,sort").eq("lead_id", NIL).eq("agent_id", NIL).order("sort", { ascending: true }).limit(1));
await check("offers (readBids)", () => db.from("rift_bids").select("id,home_id,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at", { ascending: false }).limit(1));
await check("offer steps (readBids)", () => db.from("rift_bid_steps")
  .select("bid_id,seq,kind,version,terms,origin,required,document_ids,note,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("seq").limit(1));
await check("offer answers (readBids)", () => db.from("rift_bid_responses")
  .select("bid_id,member_id,version,instruction,note,told_agent,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at").limit(1));
await check("household (readBids)", () => db.from("rift_journey_members")
  .select("id,display_name,email,role,accepted_at,revoked_at,invite_expires_at").eq("journey_id", NIL).eq("agent_id", NIL).limit(1));
await check("offer step replay (recordBidStep)", () => db.from("rift_bid_steps")
  .select("seq").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("answer replay (recordResponse)", () => db.from("rift_bid_responses")
  .select("id").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("documents (readDocuments)", () => db.from("rift_documents")
  .select("id,family,label,filename,kind,bytes,sha256,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at", { ascending: false }).limit(1));
await check("document path (documentLink)", () => db.from("rift_documents")
  .select("storage_path,filename").eq("id", NIL).eq("journey_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("files to erase (removeJourneyFiles)", () => db.from("rift_documents")
  .select("storage_path").eq("agent_id", NIL).in("journey_id", [NIL]).limit(1));
await check("their journeys (forget)", () => db.from("rift_journeys")
  .select("id").eq("agent_id", NIL).in("origin_lead_id", [NIL]));
await check("contract dates (readDeadlines)", () => db.from("rift_deadlines").select("id,transaction_id,label,kind,workstream,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("created_at").limit(1));
await check("date revisions (readDeadlines)", () => db.from("rift_deadline_revisions")
  .select("deadline_id,seq,state,due_date,due_time,timezone,due_at,rule,trigger_label,trigger_date,days,source_term,source_page,source_document_id,amendment,verified,note,actor_label,created_at")
  .eq("journey_id", NIL).eq("agent_id", NIL).order("seq").limit(1));
await check("all dates (datesNeedingAttention)", () => db.from("rift_deadlines").select("id,journey_id,transaction_id,label,kind").eq("agent_id", NIL).limit(1));
await check("ended contracts (datesNeedingAttention)", () => db.from("rift_transaction_outcomes").select("transaction_id").eq("agent_id", NIL).limit(1));
await check("date replay (addDeadline)", () => db.from("rift_deadlines").select("id").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("job runs (jobsHealth)", () => db.from("rift_job_runs").select("job,ok,detail,started_at,finished_at").order("started_at", { ascending: false }).limit(1));
// The morning summary (lib/db/summary.ts, W12): what each member did since the last business morning.
const SINCE = new Date(Date.now() - 86_400_000).toISOString();
for (const [name, table, cols] of [
  ["summary: new people", "rift_leads", "name,side,band"],
  ["summary: reactions", "rift_home_reactions", "journey_id,home_id,member_id,reaction,reason,created_at"],
  ["summary: homes added", "rift_shortlist_homes", "journey_id,address,added_by_member,created_at"],
  ["summary: showing requests", "rift_tour_stops", "journey_id,home_id,requested_by_member,created_at"],
  ["summary: showing answers", "rift_tour_feedback", "journey_id,stop_id,member_id,offer,created_at"],
  ["summary: offer answers", "rift_bid_responses", "journey_id,bid_id,member_id,version,instruction,told_agent,created_at"],
  ["summary: brief answers", "rift_search_responses", "journey_id,member_id,response,created_at"],
  ["summary: brief proposals", "rift_search_revisions", "journey_id,author_member_id,created_at"],
  ["summary: reported work", "rift_workstream_updates", "journey_id,member_id,workstream,created_at"],
]) {
  await check(name, () => db.from(table).select(cols).eq("agent_id", NIL).gte("created_at", SINCE).limit(1));
}
await check("summary: members", () => db.from("rift_journey_members").select("id,journey_id,display_name,email,accepted_at").eq("agent_id", NIL).limit(1));
await check("summary: bids to homes", () => db.from("rift_bids").select("id,home_id").eq("agent_id", NIL).limit(1));
// The pilot report (lib/db/pilot.ts, W12): replies against the same-day promise, and checks against Matrix and documents.
await check("pilot: buying journeys", () => db.from("rift_journeys").select("id,label,origin_lead_id").eq("agent_id", NIL).eq("side", "buy")
  .order("created_at", { ascending: false }).limit(1));
for (const [name, table, cols] of [
  ["pilot: events", "rift_journey_events", "journey_id,seq,kind,from_value,to_value,reason,evidence,transaction_id,actor_label,created_at"],
  ["pilot: members", "rift_journey_members", "journey_id,accepted_at,revoked_at"],
  ["pilot: searches", "rift_search_packages", "id,journey_id,status,approved_at,confirmed_at,ended_at,external_ref"],
  ["pilot: brief versions", "rift_search_revisions", "journey_id,author_kind,created_at"],
  ["pilot: brief answers", "rift_search_responses", "journey_id,response,created_at"],
  ["pilot: showings", "rift_tour_stops", "id,journey_id,requested_by_kind,created_at"],
  ["pilot: showing steps", "rift_tour_steps", "stop_id,seq,created_at"],
  ["pilot: work", "rift_workstream_updates", "transaction_id,journey_id,workstream,seq,state,actor_kind,created_at"],
  ["pilot: offer answers", "rift_bid_responses", "bid_id,journey_id,told_agent,created_at"],
  ["pilot: offer steps", "rift_bid_steps", "bid_id,created_at"],
  ["pilot: contracts", "rift_transactions", "id,journey_id,created_at"],
  ["pilot: dates", "rift_deadlines", "id,journey_id,transaction_id"],
  ["pilot: date versions", "rift_deadline_revisions", "deadline_id,journey_id,seq,state,verified,created_at"],
]) {
  await check(name, () => db.from(table).select(cols).eq("agent_id", NIL).limit(1));
}
await check("pilot: checks", () => db.from("rift_reconciliations").select("journey_id,search,dates,note,actor_label,created_at")
  .eq("agent_id", NIL).order("created_at", { ascending: false }).limit(1));
await check("pilot: check replay (recordCheck)", () => db.from("rift_reconciliations").select("id").eq("request_id", NIL).eq("agent_id", NIL).maybeSingle());
await check("pilot: live search (recordCheck)", () => db.from("rift_search_packages").select("id").eq("journey_id", NIL).eq("agent_id", NIL)
  .in("status", ["active-confirmed", "paused"]).limit(1));

for (const [status, name, err] of results) {
  console.log(`${status.padEnd(6)} ${name}${err ? "  → " + err.slice(0, 140) : ""}`);
}

const bad = results.filter((r) => r[0] !== "ok").length;
console.log(bad ? `\n${bad} query path(s) broken` : `\nAll ${results.length} query paths OK`);
process.exit(bad ? 1 : 0);
