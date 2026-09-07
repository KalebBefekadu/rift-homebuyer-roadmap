import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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

/**
 * A database of its own.
 *
 * These suites rebuild the schema from the migrations, so pointing them at the
 * same database the local stack uses meant `npm test` silently destroyed the
 * development environment — including the agent row, after which every write
 * reported "no agent row exists yet" and the cause was two commands earlier.
 */
const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
let db: Client | null = null;

/** The Rift migrations, in filename order. The retired MVP's are skipped. */
function riftMigrations(): string[] {
  const dir = "supabase/migrations";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f.includes("_rift_"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

const AGENT = "aaaa1111-0000-4000-8000-000000000001";
const USER = "bbbb2222-0000-4000-8000-000000000001";

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    /* Every Rift migration, in order, rather than a hand-written list. Naming
       them individually meant each new migration had to be remembered in two
       test files, and the first one forgotten dropped a table the suite then
       reported as "not found in the schema cache" — a confusing failure a long
       way from its cause. */
    for (const f of riftMigrations()) await c.query(readFileSync(f, "utf8"));
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

describe("the cadence, as stored", () => {
  test("a step cannot be sent twice, however many workers try", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sn','buy') returning id", [AGENT]);
    const { rows: [l] } = await c.query(
      "insert into rift_leads (agent_id, assessment_id, side, email, score, band) values ($1,$2,'buy','n@b.com',80,'now') returning id",
      [AGENT, a.id]);
    const { rows: [e] } = await c.query(
      "insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'now') returning id", [AGENT, l.id]);

    await c.query("insert into rift_touches (enrolment_id, step_id, channel) values ($1,'n1','email')", [e.id]);
    /* The only guarantee that survives a retry, a double cron fire, or two
       workers racing. No amount of application-level care can promise it. */
    await expect(
      c.query("insert into rift_touches (enrolment_id, step_id, channel) values ($1,'n1','email')", [e.id]),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  test("one live enrolment per lead", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sn2','buy') returning id", [AGENT]);
    const { rows: [l] } = await c.query(
      "insert into rift_leads (agent_id, assessment_id, side, email, score, band) values ($1,$2,'buy','n2@b.com',80,'now') returning id",
      [AGENT, a.id]);
    await c.query("insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'now')", [AGENT, l.id]);
    /* Two enrolments would send the whole sequence twice. */
    await expect(
      c.query("insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'soon')", [AGENT, l.id]),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  test("a stop must name its reason", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sn3','buy') returning id", [AGENT]);
    const { rows: [l] } = await c.query(
      "insert into rift_leads (agent_id, assessment_id, side, email, score, band) values ($1,$2,'buy','n3@b.com',80,'now') returning id",
      [AGENT, a.id]);
    const { rows: [e] } = await c.query(
      "insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'now') returning id", [AGENT, l.id]);
    /* "Stopped, and nobody recorded why" is how a cadence quietly dies. */
    await expect(
      c.query("update rift_enrolments set stopped_at = now() where id = $1", [e.id]),
    ).rejects.toThrow(/stop_needs_a_reason/);

    await c.query("update rift_enrolments set stopped_at = now(), stop_reason = 'replied' where id = $1", [e.id]);
    const { rows } = await c.query("select stop_reason from rift_enrolments where id = $1", [e.id]);
    expect(rows[0].stop_reason).toBe("replied");
  });

  test("a review item cannot be verified without a named party", async (c) => {
    await expect(
      c.query(
        `insert into rift_review_items (agent_id, who, kind, what, claim, state, raised_by, to_advance)
         values ($1,'Maya','figure','Cash to close','$31,190','verified','client','...')`, [AGENT]),
    ).rejects.toThrow(/review_verified_needs_a_name/);
  });
});

describe("retention, as enforced", () => {
  test("deleting an assessment takes its answers with it", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sret','buy') returning id", [AGENT]);
    await c.query("insert into rift_answers (assessment_id, question_key, value) values ($1,'savings','9000')", [a.id]);

    await c.query("delete from rift_assessments where id = $1", [a.id]);

    /* One delete, not two. A partial sweep that removed the assessment and
       left the answers would leave orphaned finances behind with nothing
       pointing at them. */
    const { rows } = await c.query("select count(*)::int n from rift_answers where assessment_id = $1", [a.id]);
    expect(rows[0].n).toBe(0);
  });

  test("deletion is deletion, not a flag", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sret2','buy') returning id", [AGENT]);
    await c.query("delete from rift_assessments where id = $1", [a.id]);
    /* The customer-facing promise says "deleted outright — not anonymised,
       not archived". A soft delete would make that sentence false while
       looking like compliance. */
    const { rows } = await c.query("select count(*)::int n from rift_assessments where id = $1", [a.id]);
    expect(rows[0].n).toBe(0);
  });

  test("consent records outlive the assessment they came from", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'sret3','buy') returning id", [AGENT]);
    await c.query(
      `insert into rift_consents (agent_id, assessment_id, kind, wording, version, granted)
       values ($1,$2,'phone','...','2026-09-01',true)`, [AGENT, a.id]);

    await c.query("delete from rift_assessments where id = $1", [a.id]);

    /* They are the evidence that the contact was lawful, so they survive with
       the link nulled rather than cascading away with it. */
    const { rows } = await c.query("select assessment_id from rift_consents where agent_id = $1 and kind='phone' order by at desc limit 1", [AGENT]);
    expect(rows[0].assessment_id).toBeNull();
  });
});

describe("a lead without an assessment", () => {
  test("stores rather than failing the whole capture", async (c) => {
    /* Two real paths produce one: somebody asking for a readout they were sent
       a link to, and somebody booking straight from the landing page. The
       column was NOT NULL, so an empty string reached Postgres as an invalid
       uuid and the capture failed outright — losing the lead at the single
       most valuable moment in the funnel, a stranger volunteering an address. */
    await c.query(
      `insert into rift_leads (agent_id, assessment_id, side, email, score, band)
       values ($1, null, 'buy', 'unlinked@example.com', 88, 'now')`, [AGENT]);
    const { rows } = await c.query(
      "select assessment_id, score from rift_leads where email='unlinked@example.com'");
    expect(rows[0].assessment_id).toBeNull();
    expect(rows[0].score).toBe(88);
  });

  test("its consent record stores too", async (c) => {
    await c.query(
      `insert into rift_consents (agent_id, assessment_id, kind, wording, version, granted)
       values ($1, null, 'email', 'We email you your readout.', '2026-09-01', true)`, [AGENT]);
    const { rows } = await c.query(
      "select count(*)::int n from rift_consents where assessment_id is null and kind='email'");
    expect(rows[0].n).toBeGreaterThan(0);
  });
});

describe("what a nurture touch is allowed to say", () => {
  test("a lead with no readout has nothing to carry", async (c) => {
    /* The runner used to send zeroes — "Buying in your County takes $0 at the
       table" — to somebody deciding whether to trust us with their finances.
       There is no version of that email worth sending, so the queue has to be
       able to tell that the figures are absent. */
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'snofig','buy') returning id", [AGENT]);
    const { rows: [l] } = await c.query(
      `insert into rift_leads (agent_id, assessment_id, side, email, score, band)
       values ($1,$2,'buy','nofig@example.com',80,'now') returning id`, [AGENT, a.id]);
    await c.query("insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'now')", [AGENT, l.id]);

    const { rows } = await c.query(
      `select r.share_token from rift_leads le
       left join rift_readouts r on r.assessment_id = le.assessment_id
       where le.id = $1`, [l.id]);
    expect(rows[0].share_token).toBeNull();
  });

  test("a lead with a readout carries its figures and its link", async (c) => {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side, county) values ($1,'sfig','buy','DeKalb') returning id", [AGENT]);
    await c.query(
      `insert into rift_readouts (agent_id, assessment_id, side, share_token, inputs, figures)
       values ($1,$2,'buy','tok-touch','{}',$3)`,
      [AGENT, a.id, JSON.stringify({ cashToClose: 26187.5, gap: 17187.5 })]);
    const { rows: [l] } = await c.query(
      `insert into rift_leads (agent_id, assessment_id, side, email, score, band)
       values ($1,$2,'buy','fig@example.com',80,'now') returning id`, [AGENT, a.id]);
    await c.query("insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'now')", [AGENT, l.id]);

    const { rows } = await c.query(
      `select r.figures, r.share_token, ass.county from rift_leads le
       join rift_readouts r on r.assessment_id = le.assessment_id
       join rift_assessments ass on ass.id = le.assessment_id
       where le.id = $1`, [l.id]);
    expect(rows[0].figures.cashToClose).toBe(26187.5);
    expect(rows[0].share_token).toBe("tok-touch");
    expect(rows[0].county).toBe("DeKalb");
  });
});

describe("the human reply", () => {
  test("the first reply is the one the clock measures", async (c) => {
    /* `human_replied_at` was read in three places and written in none, so
       every lead stayed "waiting" forever and the breach count could only
       grow. An agent who replied within a minute watched the product tell him
       he was late, which is the fastest way to make him stop looking at it. */
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side) values ($1,'srep','buy') returning id", [AGENT]);
    const { rows: [l] } = await c.query(
      `insert into rift_leads (agent_id, assessment_id, side, email, score, band)
       values ($1,$2,'buy','rep@example.com',80,'now') returning id`, [AGENT, a.id]);

    await c.query(
      "update rift_leads set human_replied_at = now() - interval '10 minutes' where id=$1 and human_replied_at is null", [l.id]);
    const { rows: first } = await c.query("select human_replied_at from rift_leads where id=$1", [l.id]);

    /* A second attempt must not move it. Speed to lead is about the FIRST
       response, and a metric you can retroactively flatter is not a metric. */
    await c.query(
      "update rift_leads set human_replied_at = now() where id=$1 and human_replied_at is null", [l.id]);
    const { rows: second } = await c.query("select human_replied_at from rift_leads where id=$1", [l.id]);

    expect(second[0].human_replied_at.getTime()).toBe(first[0].human_replied_at.getTime());
  });
});
