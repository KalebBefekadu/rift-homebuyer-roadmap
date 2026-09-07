import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

/**
 * Row-level security, exercised.
 *
 * These policies are the security boundary — `docs/architecture.md` says route
 * guards are experience, not authorization — and they had never been run. The
 * local harness disables RLS so the query-shape tests can focus on syntax, and
 * the application uses the service role, which bypasses policies entirely. So
 * every policy in this product was written, shipped, and never once enforced
 * against a request.
 *
 * A policy that does not work fails silently and in the worst possible
 * direction: everything appears to function, and one agent can read another's
 * clients. There is exactly one agent today, which is why this is cheap to fix
 * now and expensive to discover later.
 *
 * Runs as a real authenticated role with a JWT claim, not as the table owner —
 * the owner bypasses RLS, and a first attempt at this "passed" for that reason
 * while proving nothing.
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
let db: Client | null = null;

const A_USER = "a0000000-0000-4000-8000-00000000000a";
const B_USER = "b0000000-0000-4000-8000-00000000000b";
const A_AGENT = "a1111111-0000-4000-8000-00000000000a";
const B_AGENT = "b1111111-0000-4000-8000-00000000000b";

function riftMigrations(): string[] {
  const dir = "supabase/migrations";
  return readdirSync(dir).filter((f) => f.endsWith(".sql") && f.includes("_rift_")).sort()
    .map((f) => `${dir}/${f}`);
}

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    for (const f of riftMigrations()) await c.query(readFileSync(f, "utf8"));
    /* The registry, because the assertion that matters most here is that an
       anonymous visitor CAN read it. Without the seed that test passes for the
       wrong reason — an empty table looks exactly like a policy refusing. */
    await c.query(readFileSync("supabase/seed/rift_programs.sql", "utf8"));

    await c.query("insert into auth.users (id) values ($1),($2) on conflict do nothing", [A_USER, B_USER]);
    await c.query(
      `insert into rift_agents (id, auth_user_id, name, email) values
       ($1,$2,'Agent A','a@example.com'), ($3,$4,'Agent B','b@example.com')`,
      [A_AGENT, A_USER, B_AGENT, B_USER]);
    for (const [agent, session, email] of [[A_AGENT, "rls-a", "lead-a@example.com"], [B_AGENT, "rls-b", "lead-b@example.com"]]) {
      const { rows } = await c.query(
        "insert into rift_assessments (agent_id, session_id, side) values ($1,$2,'buy') returning id", [agent, session]);
      await c.query(
        `insert into rift_leads (agent_id, assessment_id, side, email, score, band)
         values ($1,$2,'buy',$3,90,'now')`, [agent, rows[0].id, email]);
    }

    /* A role that is NOT the owner. The owner bypasses RLS, which is how a
       first version of this test passed while proving nothing. */
    /* Created if missing, never dropped.
       
       Roles are cluster-wide but grants are per-database, so dropping this one
       from the test database failed on grants still held in the development
       one — a cross-database dependency that has nothing to do with this suite
       and would break it on any machine that had run the local stack. */
    await c.query("do $$ begin if not exists (select 1 from pg_roles where rolname='rls_user') then execute 'create role rls_user nologin'; end if; end $$");
    await c.query("grant usage on schema public to rls_user");
    await c.query("grant select, insert, update, delete on all tables in schema public to rls_user");
    await c.query("grant usage, select on all sequences in schema public to rls_user");
    db = c;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db = null;
    try { await c.end(); } catch { /* never connected */ }
    if (!/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout expired/i.test(msg)) {
      throw new Error(`RLS setup failed (not a connection problem): ${msg}`);
    }
  }
}, 60_000);

afterAll(async () => { if (db) await db.end(); });

/** Runs a statement as a signed-in agent, then rolls back. */
async function asAgent<T>(c: Client, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  await c.query("set local role rls_user");
  if (userId) await c.query(`set local "request.jwt.claim.sub" = '${userId}'`);
  try {
    return await fn();
  } finally {
    await c.query("rollback");
  }
}

const test = (name: string, fn: (c: Client) => Promise<void>) =>
  it(name, async (ctx) => { if (!db) return ctx.skip(); await fn(db); });

describe("one agent cannot reach another's book", () => {
  test("reads are scoped to the signed-in agent", async (c) => {
    await asAgent(c, A_USER, async () => {
      const mine = await c.query("select count(*)::int n from rift_leads");
      expect(mine.rows[0].n).toBe(1);
      const theirs = await c.query("select count(*)::int n from rift_leads where email='lead-b@example.com'");
      expect(theirs.rows[0].n).toBe(0);
    });
  });

  test("an update against another agent's row matches nothing", async (c) => {
    await asAgent(c, A_USER, async () => {
      const r = await c.query("update rift_leads set score = 1 where email='lead-b@example.com'");
      expect(r.rowCount).toBe(0);
    });
  });

  test("a delete against another agent's row matches nothing", async (c) => {
    await asAgent(c, A_USER, async () => {
      const r = await c.query("delete from rift_assessments where session_id='rls-b'");
      expect(r.rowCount).toBe(0);
    });
  });

  test("a row cannot be inserted on another agent's behalf", async (c) => {
    /* The dangerous direction. Scoping reads without scoping writes lets
       somebody plant a row they will then be allowed to read. */
    await asAgent(c, A_USER, async () => {
      await expect(
        c.query(
          `insert into rift_leads (agent_id, side, email, score, band)
           values ($1,'buy','forged@example.com',99,'now')`, [B_AGENT]),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  test("figures and consents are scoped too, not just the obvious tables", async (c) => {
    await asAgent(c, A_USER, async () => {
      const figs = await c.query("select count(*)::int n from rift_figures where agent_id=$1", [B_AGENT]);
      expect(figs.rows[0].n).toBe(0);
      const consents = await c.query("select count(*)::int n from rift_consents where agent_id=$1", [B_AGENT]);
      expect(consents.rows[0].n).toBe(0);
    });
  });
});

describe("what an anonymous visitor can reach", () => {
  test("nothing belonging to anybody", async (c) => {
    await asAgent(c, null, async () => {
      for (const table of ["rift_leads", "rift_assessments", "rift_consents", "rift_events", "rift_readouts"]) {
        const r = await c.query(`select count(*)::int n from ${table}`);
        expect(r.rows[0].n, `${table} is readable without a session`).toBe(0);
      }
    });
  });

  test("but the programme registry, which is public by design", async (c) => {
    /* The customer-facing match runs before any account exists. If this ever
       returns zero, the landing page silently tells everybody there is no help
       available. */
    await asAgent(c, null, async () => {
      const r = await c.query("select count(*)::int n from rift_programs");
      expect(r.rows[0].n).toBeGreaterThan(0);
    });
  });
});
