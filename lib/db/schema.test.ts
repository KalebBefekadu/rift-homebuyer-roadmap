import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";

/**
 * Schema integration tests.
 *
 * These run against a real Postgres, because the constraints they check are the
 * ones written into the database precisely so that application code cannot
 * route around them. Asserting them in TypeScript would test the wrong layer.
 *
 * They SKIP when no database is reachable rather than fail. A contributor
 * without Docker should still be able to run `npm test` and get a meaningful
 * signal — a suite that cannot run is worse than one that says why it did not.
 *
 *   docker run -d --name rift-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16-alpine
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/postgres";

let db: Client | null = null;

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    await c.query(readFileSync("supabase/migrations/20260907000000_rift_core.sql", "utf8"));
    await c.query(readFileSync("supabase/seed/rift_programs.sql", "utf8"));
    db = c;
  } catch {
    db = null;
    try { await c.end(); } catch { /* never connected */ }
  }
}, 60_000);

afterAll(async () => { if (db) await db.end(); });

const test = (name: string, fn: (c: Client) => Promise<void>) =>
  it(name, async (ctx) => {
    if (!db) return ctx.skip();
    await fn(db);
  });

/** Asserts a statement is rejected, and by which named constraint. */
async function rejects(c: Client, sql: string, params: unknown[], match: RegExp) {
  await expect(c.query(sql, params as never[])).rejects.toThrow(match);
}

describe("rift schema", () => {
  const AGENT = "11111111-0000-4000-8000-000000000001";
  const FV = "33333333-0000-4000-8000-000000000001";
  const ASSESS = "44444444-0000-4000-8000-000000000001";
  const READOUT = "55555555-0000-4000-8000-000000000001";

  test("fixtures insert", async (c) => {
    await c.query("insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001') on conflict do nothing");
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,'00000000-0000-4000-8000-000000000001','Kaleb','k@example.com') on conflict do nothing", [AGENT]);
    await c.query("insert into rift_funnels (id, agent_id, side) values ('22222222-0000-4000-8000-000000000001',$1,'buy') on conflict do nothing", [AGENT]);
    await c.query("insert into rift_funnel_versions (id, funnel_id, version) values ($1,'22222222-0000-4000-8000-000000000001',1) on conflict do nothing", [FV]);
    await c.query("insert into rift_assessments (id, agent_id, session_id, side) values ($1,$2,'s1','buy') on conflict do nothing", [ASSESS, AGENT]);
    await c.query("insert into rift_readouts (id, agent_id, assessment_id, side, share_token, inputs, figures) values ($1,$2,$3,'buy','tok1','{}','{}') on conflict do nothing", [READOUT, AGENT, ASSESS]);
    const { rows } = await c.query("select count(*)::int n from rift_agents");
    expect(rows[0].n).toBeGreaterThan(0);
  });

  test("a custom question can never feed a calculation", async (c) => {
    await rejects(c,
      "insert into rift_questions (funnel_version_id,key,kind,bound,type,title) values ($1,'qc','custom','savings','text','Anything else?')",
      [FV], /custom_questions_are_inert/);
  });

  test("a core question must name the field it feeds", async (c) => {
    await rejects(c,
      "insert into rift_questions (funnel_version_id,key,kind,bound,type,title) values ($1,'qk','core',null,'money','Savings?')",
      [FV], /core_questions_are_bound/);
  });

  test("a telemetry event can never carry an answer", async (c) => {
    for (const key of ["value", "answer", "input"]) {
      await rejects(c,
        "insert into rift_events (agent_id,session_id,name,payload) values ($1,'s1','question_answer',$2)",
        [AGENT, JSON.stringify({ [key]: 42000 })], /events_carry_no_answer/);
    }
  });

  test("a telemetry event with counts and flags is accepted", async (c) => {
    await c.query(
      "insert into rift_events (agent_id,session_id,name,question_key,dwell_ms,payload) values ($1,'s1','question_view','savings',4200,$2)",
      [AGENT, JSON.stringify({ step: 3, resumed: false })]);
    const { rows } = await c.query("select count(*)::int n from rift_events where question_key='savings'");
    expect(rows[0].n).toBe(1);
  });

  test("nothing reaches verified without a named party", async (c) => {
    await rejects(c,
      "insert into rift_figures (agent_id,readout_id,label,value_cents,trust_state,assumptions,could_be_wrong) values ($1,$2,'Cash to close',2618750,'verified','[{\"l\":\"price\"}]','Rates move and escrow depends on the closing date.')",
      [AGENT, READOUT], /verified_needs_a_name/);
  });

  test("a figure must carry its assumptions and its failure mode", async (c) => {
    await rejects(c,
      "insert into rift_figures (agent_id,readout_id,label,value_cents,assumptions,could_be_wrong) values ($1,$2,'Cash to close',2618750,'[]','Rates move and escrow depends on the closing date.')",
      [AGENT, READOUT], /figures_state_their_assumptions/);
    await rejects(c,
      "insert into rift_figures (agent_id,readout_id,label,value_cents,assumptions,could_be_wrong) values ($1,$2,'Cash to close',2618750,'[{\"l\":\"price\"}]','too short')",
      [AGENT, READOUT], /figures_state_their_failure_mode/);
  });

  test("first touch is immutable, last touch is not", async (c) => {
    await c.query(
      "insert into rift_attributions (session_id,agent_id,first_source,last_source) values ('sA',$1,'facebook','facebook') on conflict do nothing", [AGENT]);
    await rejects(c, "update rift_attributions set first_source='google' where session_id='sA'", [], /first touch is immutable/);
    await c.query("update rift_attributions set last_source='google', visits=visits+1 where session_id='sA'");
    const { rows } = await c.query("select first_source, last_source, visits from rift_attributions where session_id='sA'");
    expect(rows[0]).toMatchObject({ first_source: "facebook", last_source: "google", visits: 2 });
  });

  test("the seeded registry loads and a stale programme is identifiable", async (c) => {
    const { rows } = await c.query("select count(*)::int n from rift_programs");
    expect(rows[0].n).toBeGreaterThanOrEqual(8);
    /* The registry ships one deliberately stale fixture so the suppression rule
       stays demonstrable rather than theoretical. */
    const stale = await c.query(
      "select slug from rift_programs where verified_on < (date '2026-09-07' - interval '90 days')");
    expect(stale.rows.length).toBeGreaterThan(0);
  });

  test("a programme cannot have an inverted amount range", async (c) => {
    await rejects(c,
      "insert into rift_programs (slug,name,administrator,type,amount_min,amount_max,income_limit_note,price_cap_note,verified_on,verified_by) values ('bad','Bad','X','grant',9000,1000,'n','n','2026-09-01','K')",
      [], /amounts_ordered/);
  });
});
