import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

/**
 * The agent's details, changed through the one door, against a real Postgres.
 *
 * rift_agents is read-only to a session (20260929100000). The settings page
 * changes it through rift_update_agent_profile() with the service role, and
 * every change is recorded in rift_agent_profile_changes in the same
 * transaction. These check that the door changes only what it should, that
 * the record cannot be rewritten, and that a signed-in user cannot walk
 * through it with somebody else's id.
 *
 * Skips when no database is reachable, like every database suite here.
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
let db: Client | null = null;

const A_USER = "a0000000-0000-4000-8000-00000000000a";
const B_USER = "b0000000-0000-4000-8000-00000000000b";
const A_AGENT = "a1111111-0000-4000-8000-00000000000a";
const B_AGENT = "b1111111-0000-4000-8000-00000000000b";

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    const dir = "supabase/migrations";
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql") && x.includes("_rift_")).sort()) {
      await c.query(readFileSync(`${dir}/${f}`, "utf8"));
    }
    await c.query("insert into auth.users (id) values ($1),($2) on conflict do nothing", [A_USER, B_USER]);
    await c.query(
      `insert into rift_agents (id, auth_user_id, name, email, brokerage) values
       ($1,$2,'Agent A','a@example.com','Firm A'), ($3,$4,'Agent B','b@example.com',null)`,
      [A_AGENT, A_USER, B_AGENT, B_USER]);
    /* Not the owner, who bypasses RLS: see lib/db/rls.test.ts. */
    await c.query("do $$ begin if not exists (select 1 from pg_roles where rolname='rls_user') then execute 'create role rls_user nologin'; end if; end $$");
    await c.query("grant usage on schema public to rls_user");
    await c.query("grant select, insert, update, delete on all tables in schema public to rls_user");
    db = c;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db = null;
    try { await c.end(); } catch { /* never connected */ }
    if (!/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout expired/i.test(msg)) throw new Error(`database setup failed (not a connection problem): ${msg}`);
  }
}, 60_000);

afterAll(async () => { if (db) await db.end(); });

const test = (name: string, fn: (c: Client) => Promise<void>) =>
  it(name, async (ctx) => { if (!db) return ctx.skip(); await fn(db); });

const update = (c: Client, agent: string, changes: Record<string, unknown>, by = "Agent A") =>
  c.query("select rift_update_agent_profile($1, $2::jsonb, $3) n", [agent, JSON.stringify(changes), by]);

describe("changing the agent's details", () => {
  test("changes the columns and records before and after, together", async (c) => {
    const r = await update(c, A_AGENT, { phone: "404 555 0100", brokerage: "Firm A" });
    /* The brokerage did not change, so only one field is recorded. */
    expect(r.rows[0].n).toBe(1);
    const row = await c.query("select phone, brokerage from rift_agents where id = $1", [A_AGENT]);
    expect(row.rows[0]).toEqual({ phone: "404 555 0100", brokerage: "Firm A" });
    const hist = await c.query("select field, before, after, by_name from rift_agent_profile_changes where agent_id = $1", [A_AGENT]);
    expect(hist.rows).toEqual([{ field: "phone", before: null, after: "404 555 0100", by_name: "Agent A" }]);
  });

  test("a JSON null clears a field, and is recorded as a change to nothing", async (c) => {
    await update(c, A_AGENT, { brokerage: null });
    const hist = await c.query("select before, after from rift_agent_profile_changes where agent_id = $1 and field = 'brokerage'", [A_AGENT]);
    expect(hist.rows).toEqual([{ before: "Firm A", after: null }]);
  });

  test("refuses to empty the name or the email, and a non-address", async (c) => {
    await expect(update(c, A_AGENT, { email: "" })).rejects.toThrow(/cannot be empty/);
    await expect(update(c, A_AGENT, { name: "  " })).rejects.toThrow(/cannot be empty/);
    await expect(update(c, A_AGENT, { email: "nope" })).rejects.toThrow(/not an email/);
  });

  test("cannot reach the columns that make a login the agent", async (c) => {
    await expect(update(c, A_AGENT, { auth_user_id: B_USER })).rejects.toThrow(/not a profile field/);
    await expect(update(c, A_AGENT, { id: B_AGENT })).rejects.toThrow(/not a profile field/);
  });

  test("a refused field leaves every field in the same call unchanged", async (c) => {
    /* One transaction: the phone must not change because the email failed. */
    await expect(update(c, A_AGENT, { phone: "770 555 0199", email: "nope" })).rejects.toThrow();
    const row = await c.query("select phone from rift_agents where id = $1", [A_AGENT]);
    expect(row.rows[0].phone).toBe("404 555 0100");
  });

  test("the record is history: it cannot be edited", async (c) => {
    await expect(c.query("update rift_agent_profile_changes set after = 'forged'")).rejects.toThrow(/history/);
  });
});

describe("the door is the server's", () => {
  async function asUser<T>(c: Client, userId: string, fn: () => Promise<T>): Promise<T> {
    await c.query("begin");
    await c.query("set local role rls_user");
    await c.query(`set local "request.jwt.claim.sub" = '${userId}'`);
    try { return await fn(); } finally { await c.query("rollback"); }
  }

  test("a signed-in user cannot call the function, with any id", async (c) => {
    await asUser(c, A_USER, async () => {
      await expect(update(c, A_AGENT, { phone: "1" })).rejects.toThrow(/permission denied/);
    });
  });

  test("a signed-in agent reads their own history and nobody else's, and cannot write it", async (c) => {
    await update(c, B_AGENT, { phone: "678 555 0142" }, "Agent B");
    await asUser(c, A_USER, async () => {
      const seen = await c.query("select distinct agent_id from rift_agent_profile_changes");
      expect(seen.rows.map((r) => r.agent_id)).toEqual([A_AGENT]);
    });
    await asUser(c, A_USER, async () => {
      await expect(c.query(
        "insert into rift_agent_profile_changes (agent_id, field, before, after, by_name) values ($1,'phone',null,'1','x')",
        [A_AGENT],
      )).rejects.toThrow(/row-level security/i);
    });
  });
});
