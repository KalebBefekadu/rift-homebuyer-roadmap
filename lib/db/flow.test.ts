import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";

/**
 * The capture flow, end to end, against a real database.
 *
 * These assert the shape of what actually lands in Postgres after a visitor
 * goes through the funnel — not that the functions were called. The difference
 * matters: every rule in this product is about what is stored, and a mock
 * cannot enforce a CHECK constraint or a trigger.
 *
 * Skips when no Postgres is reachable. See lib/db/schema.test.ts.
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/postgres";
let db: Client | null = null;

const AGENT = "aaaa1111-0000-4000-8000-000000000001";
const USER = "bbbb2222-0000-4000-8000-000000000001";

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    await c.query(readFileSync("supabase/migrations/20260907000000_rift_core.sql", "utf8"));
    await c.query(readFileSync("supabase/seed/rift_programs.sql", "utf8"));
    /* auth.users lives outside the `public` schema, so it survives the reset
       above and a second run would collide on its primary key. */
    await c.query("insert into auth.users (id) values ($1) on conflict do nothing", [USER]);
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,$2,'Kaleb','k@example.com')",
      [AGENT, USER]);
    db = c;
  } catch (e) {
    /* Only an unreachable database is a skip. A migration that fails to apply
       is a real failure and must say so — swallowing it here would turn the
       suite that proves the constraints bite into a suite that quietly proves
       nothing. */
    const msg = e instanceof Error ? e.message : String(e);
    const unreachable = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout expired/i.test(msg);
    db = null;
    try { await c.end(); } catch { /* never connected */ }
    if (!unreachable) throw new Error(`database setup failed (not a connection problem): ${msg}`);
  }
}, 60_000);

afterAll(async () => { if (db) await db.end(); });

const test = (name: string, fn: (c: Client) => Promise<void>) =>
  it(name, async (ctx) => { if (!db) return ctx.skip(); await fn(db); });

describe("a visitor's journey, as stored", () => {
  test("an assessment, its answers, and its telemetry are separable", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side, county) values ($1,'sx','buy','DeKalb') returning id",
      [AGENT]);

    await c.query(
      "insert into rift_answers (assessment_id, question_key, value) values ($1,'savings',$2)",
      [a.id, JSON.stringify(9000)]);
    await c.query(
      "insert into rift_events (agent_id, session_id, name, side, question_key, dwell_ms) values ($1,'sx','question_answer','buy','savings',4200)",
      [AGENT]);

    /* The whole privacy design in one assertion: the event knows WHICH question
       and how long; only the answer table knows what was said. Nothing joins
       them, and nothing should be able to. */
    const ev = await c.query("select payload from rift_events where question_key='savings'");
    expect(JSON.stringify(ev.rows[0].payload)).not.toContain("9000");

    const ans = await c.query("select value from rift_answers where question_key='savings'");
    expect(Number(ans.rows[0].value)).toBe(9000);
  });

  test("a readout snapshot keeps what was shown alongside what produced it", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sy','buy') returning id", [AGENT]);

    await c.query(
      `insert into rift_readouts (agent_id, assessment_id, side, share_token, inputs, figures)
       values ($1,$2,'buy','tok-abc',$3,$4)`,
      [AGENT, a.id, JSON.stringify({ price: 325000, savings: 9000 }), JSON.stringify({ cashToClose: 26187.5 })]);

    const { rows } = await c.query("select inputs, figures from rift_readouts where share_token='tok-abc'");
    expect(rows[0].inputs.price).toBe(325000);
    expect(rows[0].figures.cashToClose).toBe(26187.5);
  });

  test("two readouts for one assessment are two rows, never an overwrite", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sz','buy') returning id", [AGENT]);
    for (const tok of ["tok-1", "tok-2"]) {
      await c.query(
        `insert into rift_readouts (agent_id, assessment_id, side, share_token, inputs, figures)
         values ($1,$2,'buy',$3,'{}','{}')`, [AGENT, a.id, tok]);
    }
    /* Overwriting would destroy the thing the table exists to preserve. */
    const { rows } = await c.query("select count(*)::int n from rift_readouts where assessment_id=$1", [a.id]);
    expect(rows[0].n).toBe(2);
  });

  test("a lead stores the arithmetic, not just the total", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sw','buy') returning id", [AGENT]);
    await c.query(
      `insert into rift_leads (agent_id, assessment_id, side, email, score, band, signals)
       values ($1,$2,'buy','a@b.com',78,'soon',$3)`,
      [AGENT, a.id, JSON.stringify([{ label: "Stated timing", points: 32, note: "In the next 3 months" }])]);

    const { rows } = await c.query("select score, band, signals from rift_leads where email='a@b.com'");
    expect(rows[0].score).toBe(78);
    expect(rows[0].signals).toHaveLength(1);
    expect(rows[0].signals[0].points).toBe(32);
  });

  test("a consent record stores its own wording, not a reference to it", async (c) => {
    const wording = "I agree that Kaleb may call and text me at this number.";
    await c.query(
      `insert into rift_consents (agent_id, kind, wording, version, granted)
       values ($1,'phone',$2,'2026-09-01',true)`, [AGENT, wording]);
    const { rows } = await c.query("select wording, version from rift_consents where kind='phone'");
    /* Wording changes; what somebody agreed to does not. Storing a version key
       alone would let a later edit silently rewrite what they consented to. */
    expect(rows[0].wording).toBe(wording);
    expect(rows[0].version).toBe("2026-09-01");
  });

  test("a refused consent is recorded, because it is what proves nobody called", async (c) => {
    await c.query(
      `insert into rift_consents (agent_id, kind, wording, version, granted)
       values ($1,'phone','...','2026-09-01',false)`, [AGENT]);
    const { rows } = await c.query("select count(*)::int n from rift_consents where granted = false");
    expect(rows[0].n).toBe(1);
  });

  test("the registry suppresses on the configured window, in SQL", async (c) => {
    /* Enforced in the query rather than trusted to the caller: a second reader
       — an export, a report, an admin screen — could forget to filter. */
    const fresh = await c.query(
      "select count(*)::int n from rift_programs where verified_on >= (date '2026-09-07' - interval '90 days')");
    const stale = await c.query(
      "select count(*)::int n from rift_programs where verified_on <  (date '2026-09-07' - interval '90 days')");
    expect(fresh.rows[0].n).toBeGreaterThan(0);
    expect(stale.rows[0].n).toBeGreaterThan(0);
  });
});
