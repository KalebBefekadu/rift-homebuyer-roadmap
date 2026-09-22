import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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
    /* `status` is the one that matters and the reason this became an
       allowlist. The old constraint named three keys and let it through: the
       buyers-abroad page sent the visitor's residency situation under it, on
       every view, into a table keyed on a session that joins to a lead.
       `savings` and `county` are here because they are the next two somebody
       would reach for without thinking. */
    for (const key of ["value", "answer", "input", "status", "savings", "county", "email"]) {
      await rejects(c,
        "insert into rift_events (agent_id,session_id,name,payload) values ($1,'s1','question_answer',$2)",
        [AGENT, JSON.stringify({ [key]: 42000 })], /events_carry_no_answer/);
    }
  });

  test("one unapproved key poisons an otherwise fine payload", async (c) => {
    /* The realistic shape of the mistake: somebody adds a field to a payload
       that was already correct. The row is refused rather than partially
       written, because a constraint that accepted the good half would have
       stored the bad half too. */
    await rejects(c,
      "insert into rift_events (agent_id,session_id,name,payload) values ($1,'s1','landing_view',$2)",
      [AGENT, JSON.stringify({ page: "abroad", status: "foreign" })], /events_carry_no_answer/);
  });

  test("a telemetry event with counts and flags is accepted", async (c) => {
    await c.query(
      "insert into rift_events (agent_id,session_id,name,question_key,dwell_ms,payload) values ($1,'s1','question_view','savings',4200,$2)",
      [AGENT, JSON.stringify({ step: 3, of: 7, band: "close" })]);
    const { rows } = await c.query("select count(*)::int n from rift_events where question_key='savings'");
    expect(rows[0].n).toBe(1);
  });

  test("an empty payload is still fine", async (c) => {
    /* The default. A constraint that rejected `{}` would refuse every event
       that has nothing to say, which is most of them. */
    await c.query(
      "insert into rift_events (agent_id,session_id,name) values ($1,'s-empty','readout_view')", [AGENT]);
    const { rows } = await c.query("select count(*)::int n from rift_events where session_id='s-empty'");
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

  /* ---------------------------------------------------------------- *
   * The one constraint standing between a retry and a second email
   * ---------------------------------------------------------------- */

  const LEAD = "66666666-0000-4000-8000-000000000001";
  const ENROL = "77777777-0000-4000-8000-000000000001";

  test("a step cannot be sent to the same person twice", async (c) => {
    /* `claimStep` inserts a touch BEFORE sending and treats a unique violation
       as "somebody else already has this one". That is the whole idempotency
       story for the only job in this product that contacts strangers on a
       timer — if this constraint were ever dropped, the insert would succeed
       twice, two emails would go out, and nothing anywhere would report a
       problem. The person on the other end has no way to know it was a bug
       rather than a company that does not pay attention.

       Asserted here rather than in TypeScript because the guarantee is the
       database's. A second cron worker on another machine is exactly the case
       application code cannot cover. */
    await c.query(
      "insert into rift_leads (id, agent_id, assessment_id, side, name, email, band) values ($1,$2,$3,'buy','Sara','sara@example.com','soon') on conflict do nothing",
      [LEAD, AGENT, ASSESS]);
    await c.query(
      "insert into rift_enrolments (id, agent_id, lead_id, band) values ($1,$2,$3,'soon') on conflict do nothing",
      [ENROL, AGENT, LEAD]);

    await c.query(
      "insert into rift_touches (enrolment_id, step_id, channel) values ($1,'s1','email')", [ENROL]);

    await rejects(c,
      "insert into rift_touches (enrolment_id, step_id, channel) values ($1,'s1','email')",
      [ENROL], /duplicate key|unique/i);

    /* A DIFFERENT step to the same person is not a duplicate. A constraint
       that also blocked this would stop the cadence after one message. */
    await c.query(
      "insert into rift_touches (enrolment_id, step_id, channel) values ($1,'s2','email')", [ENROL]);

    const { rows } = await c.query("select count(*)::int n from rift_touches where enrolment_id = $1", [ENROL]);
    expect(rows[0].n).toBe(2);
  });

  test("a touch cannot record an outcome nobody handles", async (c) => {
    /* The route branches on exactly three outcomes. A fourth would be written
       and then silently never read. */
    await rejects(c,
      "insert into rift_touches (enrolment_id, step_id, channel, outcome) values ($1,'s3','email','bounced')",
      [ENROL], /outcome/i);
  });
});

describe("deleting a login does not delete the business", () => {
  test("the agent and everything belonging to them survives", async (c) => {
    /* `rift_agents.auth_user_id` cascaded from auth.users, and every other
       table cascades from rift_agents. So removing one row in Supabase's
       Authentication panel — a routine action, and an easy misclick — would
       have deleted every assessment, lead, consent record, readout, figure,
       enrolment and event in the product.
       
       Consent records are what make that unrecoverable rather than merely
       catastrophic: they are the evidence that contacting those people was
       lawful, and they cannot be reconstructed from a backup of anything else. */
    const uid = "eeee0000-0000-4000-8000-000000000001";
    await c.query("insert into auth.users (id) values ($1) on conflict do nothing", [uid]);
    const { rows: [agent] } = await c.query(
      "insert into rift_agents (auth_user_id, name, email) values ($1,'Temp','t@example.com') returning id", [uid]);
    await c.query(
      `insert into rift_consents (agent_id, kind, wording, version, granted)
       values ($1,'phone','...','2026-09-01',true)`, [agent.id]);

    await c.query("delete from auth.users where id=$1", [uid]);

    const survived = await c.query("select auth_user_id from rift_agents where id=$1", [agent.id]);
    expect(survived.rows).toHaveLength(1);
    /* Unlinked, not deleted. The bootstrap re-links it. */
    expect(survived.rows[0].auth_user_id).toBeNull();

    const consents = await c.query("select count(*)::int n from rift_consents where agent_id=$1", [agent.id]);
    expect(consents.rows[0].n).toBe(1);
  });
});

describe("referral attribution", () => {
  const AGENT = "77777777-0000-4000-8000-000000000001";
  const A = "77777777-0000-4000-8000-0000000000a1";
  const B = "77777777-0000-4000-8000-0000000000b1";
  const C = "77777777-0000-4000-8000-0000000000c1";

  test("fixtures insert", async (c) => {
    await c.query("insert into auth.users (id) values ('77777777-0000-4000-8000-000000000009') on conflict do nothing");
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,'77777777-0000-4000-8000-000000000009','R','r@example.com') on conflict do nothing", [AGENT]);
    for (const [id, name] of [[A, "Referrer"], [B, "Referee"], [C, "Someone else"]]) {
      await c.query(
        "insert into rift_leads (id, agent_id, side, name, contact_basis) values ($1,$2,'buy',$3,'assessment') on conflict do nothing",
        [id, AGENT, name]);
    }
    const { rows } = await c.query("select count(*)::int n from rift_leads where agent_id = $1", [AGENT]);
    expect(rows[0].n).toBe(3);
  });

  test("every lead is given a handle it can pass on", async (c) => {
    const { rows } = await c.query(
      "select count(*)::int n, count(distinct referral_token)::int d from rift_leads where agent_id = $1", [AGENT]);
    expect(rows[0].n).toBe(rows[0].d);
  });

  test("nobody refers themselves", async (c) => {
    await rejects(c, "update rift_leads set referred_by = $1 where id = $1", [A], /no_self_referral/);
  });

  test("a referral can be recorded once", async (c) => {
    await c.query("update rift_leads set referred_by = $1 where id = $2", [A, B]);
    const { rows } = await c.query("select referred_by from rift_leads where id = $1", [B]);
    expect(rows[0].referred_by).toBe(A);
  });

  test("a referral can never be repointed at another channel", async (c) => {
    /* The failure this prevents is not a wrong row. It is an agent who
       re-attributes a referral to the retargeting ad that caught it on the way
       back, keeps buying retargeting, and stops asking for referrals. */
    await rejects(c, "update rift_leads set referred_by = $1 where id = $2", [C, B], /repointed/);
  });

  test("deleting a referrer still works, and does not take the referee with them", async (c) => {
    /* THE REGRESSION THIS FILE EXISTS FOR.
    
       The first version of the trigger above refused every change to a
       non-null referred_by, including NULL. referred_by is `on delete set
       null`, and a foreign-key SET NULL action fires row-level UPDATE
       triggers — so deleting a referrer raised, and "delete all of it" failed
       for any client who had introduced somebody. The strongest promise the
       product makes, broken by a correctness guarantee about attribution, and
       it would have surfaced the first time a referrer asked to be erased. */
    await c.query("delete from rift_leads where id = $1", [A]);
    const { rows } = await c.query("select id, referred_by from rift_leads where id = $1", [B]);
    expect(rows, "the referee is a different person and must survive").toHaveLength(1);
    expect(rows[0].referred_by, "the link goes with the deleted referrer").toBeNull();
  });

  test("first_ref is as immutable as every other first touch", async (c) => {
    /* The trigger names its columns one at a time, so a new first_* column is
       uncovered until it is added there. A guarantee that silently stops
       applying to the newest field is worse than no guarantee. */
    await c.query(
      "insert into rift_attributions (session_id, agent_id, first_ref) values ('ref-sess',$1,'handle-1')", [AGENT]);
    await rejects(c,
      "update rift_attributions set first_ref = 'handle-2' where session_id = 'ref-sess'", [], /first touch is immutable/);
  });

  test("last_ref may move, because last touch is what it is for", async (c) => {
    await c.query("update rift_attributions set last_ref = 'handle-2' where session_id = 'ref-sess'");
    const { rows } = await c.query("select last_ref from rift_attributions where session_id = 'ref-sess'");
    expect(rows[0].last_ref).toBe("handle-2");
  });
});

describe("representation", () => {
  const AGENT = "88888888-0000-4000-8000-000000000001";
  const L = "88888888-0000-4000-8000-0000000000a1";

  test("fixtures insert", async (c) => {
    await c.query("insert into auth.users (id) values ('88888888-0000-4000-8000-000000000009') on conflict do nothing");
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,'88888888-0000-4000-8000-000000000009','G','g@example.com') on conflict do nothing", [AGENT]);
    await c.query(
      "insert into rift_leads (id, agent_id, side, name, contact_basis) values ($1,$2,'buy','Gated','assessment') on conflict do nothing",
      [L, AGENT]);
    const { rows } = await c.query("select representation from rift_leads where id = $1", [L]);
    expect(rows[0].representation, "a new lead starts uncovered").toBe("none");
  });

  test("the status vocabulary is closed", async (c) => {
    /* A status outside the list does not error anywhere in the application —
       it fails isCovered, so the journey silently stops advancing and nobody
       can see why. The database is the only place that can refuse it. */
    await rejects(c,
      "update rift_leads set representation = 'probably fine' where id = $1",
      [L], /representation_check/);
  });

  test("a signed agreement must carry the date it was signed", async (c) => {
    /* The dates are the evidentiary value of the record. "Signed" with no date
       says an agreement exists without saying when it began, which is the
       question that gets asked. */
    await rejects(c,
      "update rift_leads set representation = 'signed' where id = $1",
      [L], /signed_is_dated/);
  });

  test("an unsigned status may not carry a signing date", async (c) => {
    await rejects(c,
      "update rift_leads set representation = 'declined', representation_signed_on = '2026-01-01' where id = $1",
      [L], /signed_is_dated/);
  });

  test("an expiry date belongs to an agreement", async (c) => {
    /* A date attached to nothing renders on the agent's screen as a deadline
       he has no way to meet. */
    await rejects(c,
      "update rift_leads set representation_expires_on = '2026-12-31' where id = $1",
      [L], /expiry_needs_an_agreement/);
  });

  test("an agreement cannot run out before it starts", async (c) => {
    await rejects(c,
      "update rift_leads set representation='signed', representation_signed_on='2026-06-01', representation_expires_on='2026-01-01' where id = $1",
      [L], /expiry_follows_signing/);
  });

  test("a properly dated agreement is accepted", async (c) => {
    await c.query(
      "update rift_leads set representation='signed', representation_signed_on='2026-01-01', representation_expires_on='2026-12-31' where id = $1",
      [L]);
    const { rows } = await c.query(
      "select representation, representation_expires_on from rift_leads where id = $1", [L]);
    expect(rows[0].representation).toBe("signed");
  });

  test("the vocabulary matches the one the code enforces", async (c) => {
    /* Two lists of the same six strings in two languages. They drift the day
       somebody adds a seventh to one of them. */
    const { STATUSES } = await import("@/lib/core/representation");
    const { rows } = await c.query(
      "select pg_get_constraintdef(oid) d from pg_constraint where conname = 'rift_leads_representation_check'");
    for (const s of STATUSES) {
      expect(rows[0].d, `the database does not allow "${s}"`).toContain(`'${s}'`);
    }
    /* And nothing the code does not know about. */
    const inDb = [...String(rows[0].d).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(new Set(inDb)).toEqual(new Set(STATUSES));
  });
});

describe("decision rooms", () => {
  const AGENT = "99999999-0000-4000-8000-000000000001";
  const LEAD = "99999999-0000-4000-8000-0000000000a1";
  const D1 = "99999999-0000-4000-8000-0000000000d1";
  const D2 = "99999999-0000-4000-8000-0000000000d2";
  const O1 = "99999999-0000-4000-8000-0000000000e1";
  const O2 = "99999999-0000-4000-8000-0000000000e2";

  test("fixtures insert", async (c) => {
    await c.query("insert into auth.users (id) values ('99999999-0000-4000-8000-000000000009') on conflict do nothing");
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,'99999999-0000-4000-8000-000000000009','D','d@example.com') on conflict do nothing", [AGENT]);
    await c.query(
      "insert into rift_leads (id, agent_id, side, name, contact_basis) values ($1,$2,'sell','Decider','assessment') on conflict do nothing",
      [LEAD, AGENT]);
    await c.query(
      "insert into rift_decisions (id, agent_id, lead_id, kind, question) values ($1,$2,$3,'offers','Which offer should we take?') on conflict do nothing",
      [D1, AGENT, LEAD]);
    await c.query(
      "insert into rift_decisions (id, agent_id, lead_id, kind, question) values ($1,$2,$3,'offers','A different question entirely') on conflict do nothing",
      [D2, AGENT, LEAD]);
    await c.query(
      "insert into rift_decision_options (id, agent_id, decision_id, label, amount_cents, amount_label) values ($1,$2,$3,'The Okafor offer',41230000,'would reach you') on conflict do nothing",
      [O1, AGENT, D1]);
    await c.query(
      "insert into rift_decision_options (id, agent_id, decision_id, label) values ($1,$2,$3,'Belongs to the other room') on conflict do nothing",
      [O2, AGENT, D2]);
    const { rows } = await c.query("select count(*)::int n from rift_decisions where agent_id = $1", [AGENT]);
    expect(rows[0].n).toBe(2);
  });

  test("a new room is invisible to the client", async (c) => {
    /* Prepare-then-approve. NULL released_at is the whole gate. */
    const { rows } = await c.query("select released_at from rift_decisions where id = $1", [D1]);
    expect(rows[0].released_at).toBeNull();
  });

  test("a figure must say what it is", async (c) => {
    /* A bare number in a comparison column is the reader's guess about what
       they are comparing. */
    await rejects(c,
      "insert into rift_decision_options (agent_id, decision_id, label, amount_cents) values ($1,$2,'Unlabelled',500)",
      [AGENT, D1], /amount_is_labelled/);
  });

  test("an outcome cannot name an option from a different room", async (c) => {
    /* A plain foreign key would allow this, and it renders as a perfectly
       ordinary decision naming an option the reader cannot see. */
    await rejects(c,
      "update rift_decisions set decided_at = now(), chosen_option_id = $1 where id = $2",
      [O2, D1], /chosen_is_ours/);
  });

  test("half an outcome is refused", async (c) => {
    /* A room that says a decision was made without saying what it was. */
    await rejects(c,
      "update rift_decisions set decided_at = now() where id = $1", [D1], /outcome_is_whole/);
    await rejects(c,
      "update rift_decisions set chosen_option_id = $1 where id = $2", [O1, D1], /outcome_is_whole/);
  });

  test("a whole outcome naming its own option is accepted", async (c) => {
    await c.query(
      "update rift_decisions set decided_at = now(), chosen_option_id = $1 where id = $2", [O1, D1]);
    const { rows } = await c.query("select chosen_option_id from rift_decisions where id = $1", [D1]);
    expect(rows[0].chosen_option_id).toBe(O1);
  });

  test("an option a decision names cannot be deleted out from under it", async (c) => {
    /* RESTRICT, and the first version of this migration used SET NULL, which
       is a trap on a COMPOSITE key: it nulls every column in the key, and the
       second column here is rift_decisions.id. Deleting an option failed with
       "null value in column id violates not-null constraint" — this test is
       why that was found before it shipped rather than after.
    
       RESTRICT is also the better rule. Quietly removable evidence is not
       evidence. */
    await rejects(c,
      "delete from rift_decision_options where id = $1", [O1], /chosen_is_ours|violates foreign key/);
  });

  test("reopening the decision frees the option again", async (c) => {
    await c.query(
      "update rift_decisions set decided_at = null, chosen_option_id = null where id = $1", [D1]);
    await c.query("delete from rift_decision_options where id = $1", [O1]);
    const { rows } = await c.query("select id from rift_decisions where id = $1", [D1]);
    expect(rows, "the room is untouched").toHaveLength(1);
  });

  test("the kind vocabulary matches the one the code enforces", async (c) => {
    const { KIND_LABEL } = await import("@/lib/core/decision");
    const { rows } = await c.query(
      "select pg_get_constraintdef(oid) d from pg_constraint where conname like '%decisions_kind%'");
    const inDb = [...String(rows[0].d).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(new Set(inDb)).toEqual(new Set(Object.keys(KIND_LABEL)));
  });
});

describe("the offer room", () => {
  const AGENT = "77777777-0000-4000-8000-000000000001";
  const SELLER = "77777777-0000-4000-8000-0000000000a1";
  const OTHER = "77777777-0000-4000-8000-0000000000a2";
  const HELD = "77777777-0000-4000-8000-0000000000b1";    // not released
  const SHOWN = "77777777-0000-4000-8000-0000000000b2";   // released
  const THEIRS = "77777777-0000-4000-8000-0000000000b3";  // released, on the other seller

  test("fixtures insert", async (c) => {
    await c.query("insert into auth.users (id) values ('77777777-0000-4000-8000-000000000009') on conflict do nothing");
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,'77777777-0000-4000-8000-000000000009','R','r@example.com') on conflict do nothing", [AGENT]);
    for (const [id, name] of [[SELLER, "Seller"], [OTHER, "Other seller"]]) {
      await c.query(
        "insert into rift_leads (id, agent_id, side, name, contact_basis) values ($1,$2,'sell',$3,'assessment') on conflict do nothing",
        [id, AGENT, name]);
    }
    await c.query(
      "insert into rift_offers (id, agent_id, lead_id, offered_by, price_cents, financing) values ($1,$2,$3,'Held back',40000000,'conventional')",
      [HELD, AGENT, SELLER]);
    await c.query(
      "insert into rift_offers (id, agent_id, lead_id, offered_by, price_cents, financing, released_at) values ($1,$2,$3,'Shown',41000000,'fha',now())",
      [SHOWN, AGENT, SELLER]);
    await c.query(
      "insert into rift_offers (id, agent_id, lead_id, offered_by, price_cents, financing, released_at) values ($1,$2,$3,'Elsewhere',30000000,'cash',now())",
      [THEIRS, AGENT, OTHER]);
    await c.query("insert into rift_offer_rooms (lead_id, agent_id) values ($1,$2)", [SELLER, AGENT]);
  });

  test("a take cannot be stored without the draft and the offers it was approved for", async (c) => {
    /* 2.2 is "the difference is visible and recorded". A take with no draft
       beside it records nothing about the difference. */
    await rejects(c,
      "update rift_offer_rooms set take = 'x', approved_at = now() where lead_id = $1",
      [SELLER], /approval_is_whole/);
  });

  test("a seller cannot choose an offer they were never shown", async (c) => {
    await rejects(c,
      "update rift_offer_rooms set chosen_offer_id = $1, chosen_at = now(), chosen_seen = '{}' where lead_id = $2",
      [HELD, SELLER], /has not been released/);
  });

  test("a choice cannot name an offer on somebody else's house", async (c) => {
    /* Released, so the trigger passes it. Only the composite key stops it. */
    await rejects(c,
      "update rift_offer_rooms set chosen_offer_id = $1, chosen_at = now(), chosen_seen = '{}' where lead_id = $2",
      [THEIRS, SELLER], /chosen_is_theirs/);
  });

  test("a choice is stored whole", async (c) => {
    await rejects(c,
      "update rift_offer_rooms set chosen_offer_id = $1 where lead_id = $2",
      [SHOWN, SELLER], /choice_is_whole/);
  });

  test("a chosen offer cannot be withdrawn or deleted from under the choice", async (c) => {
    await c.query(
      "update rift_offer_rooms set chosen_offer_id = $1, chosen_at = now(), chosen_seen = '{}' where lead_id = $2",
      [SHOWN, SELLER]);
    await rejects(c, "update rift_offers set released_at = null where id = $1", [SHOWN], /reopen their choice/);
    await rejects(c, "delete from rift_offers where id = $1", [SHOWN], /chosen_is_theirs/);

    /* An offer nobody chose is still the agent's to take back. */
    await c.query("update rift_offers set released_at = now() where id = $1", [HELD]);
    await c.query("update rift_offers set released_at = null where id = $1", [HELD]);
  });

  test("forgetting the seller takes the room with them, choice and all", async (c) => {
    /* NO ACTION, not RESTRICT: the lead's delete cascades to both the offers
       and this row, and RESTRICT can fire between the two. */
    await c.query("delete from rift_leads where id = $1", [SELLER]);
    const { rows } = await c.query("select count(*)::int n from rift_offer_rooms where lead_id = $1", [SELLER]);
    expect(rows[0].n).toBe(0);
  });
});
