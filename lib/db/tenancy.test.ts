import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

/**
 * The writes that bypass row-level security, and what stops them instead.
 *
 * `lib/db/rls.test.ts` proves the policies work. This file exists because the
 * application never asks them. Every write in Rift goes through the
 * service-role client, which bypasses RLS entirely — that is deliberate and
 * necessary, since a stranger filling in the funnel has no session for a
 * policy to key on — but it means the only thing scoping a Studio write to the
 * right agent is the `.eq("agent_id", …)` somebody remembered to type.
 *
 * Three of them had not. `promoteItem`, `markReplied` and `stop` matched on id
 * alone, and all three are reachable from a `"use server"` action, which is a
 * public HTTP endpoint with a generated name. The action checked that somebody
 * was signed in; nothing checked that the record was theirs.
 *
 * There is one agent today, so nothing was exposed. The reason to fix it now
 * is that all three writes are effectively irreversible — `markReplied` refuses
 * to be re-set because speed-to-lead must not be retroactively flattered, a
 * stopped sequence does not restart, and a figure promoted to `verified` has
 * had a name attached to it in writing — so the discovery would come long
 * after the damage.
 *
 * These assert the QUERY SHAPE against a real Postgres: the same filters the
 * data layer sends, run as two agents, checking that agent B's id matches
 * nothing of agent A's.
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
let db: Client | null = null;

const A_AGENT = "aaaa1111-0000-4000-8000-0000000000a1";
const B_AGENT = "bbbb1111-0000-4000-8000-0000000000b1";
const A_USER = "aaaa2222-0000-4000-8000-0000000000a2";
const B_USER = "bbbb2222-0000-4000-8000-0000000000b2";
const A_LEAD = "aaaa3333-0000-4000-8000-0000000000a3";

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

    for (const [user, agent, name] of [[A_USER, A_AGENT, "Kaleb"], [B_USER, B_AGENT, "Someone else"]]) {
      await c.query("insert into auth.users (id) values ($1) on conflict do nothing", [user]);
      await c.query(
        "insert into rift_agents (id, auth_user_id, name, email) values ($1,$2,$3,$4)",
        [agent, user, name, `${name.split(" ")[0]!.toLowerCase()}@example.com`]);
    }

    /* One lead, one enrolment and one review item, all belonging to A. */
    await c.query(
      "insert into rift_leads (id, agent_id, name, email, side) values ($1,$2,'A client','a@example.com','buy')",
      [A_LEAD, A_AGENT]);
    await c.query(
      "insert into rift_enrolments (agent_id, lead_id, band) values ($1,$2,'now')",
      [A_AGENT, A_LEAD]);
    await c.query(
      `insert into rift_review_items
         (id, agent_id, who, kind, what, claim, state, ceiling, raised_by, to_advance)
       values ('aaaa4444-0000-4000-8000-0000000000a4', $1, 'A client', 'figure',
               'Cash to close', '$26,187.50', 'pending-review', 'verified', 'client',
               'A lender letter naming the figure')`,
      [A_AGENT]);
    db = c;
  } catch (e) {
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

describe("a second agent cannot reach the first agent's records", () => {
  test("marking a reply: B's filter matches nothing, A's matches the lead", async (c) => {
    /* The exact shape lib/db/leads.ts sends. The `human_replied_at is null`
       clause is the idempotence guard, not the tenancy one. */
    const asB = await c.query(
      "update rift_leads set human_replied_at = now() where id = $1 and agent_id = $2 and human_replied_at is null returning id",
      [A_LEAD, B_AGENT]);
    expect(asB.rowCount, "another agent must not be able to stop this clock").toBe(0);

    const asA = await c.query(
      "update rift_leads set human_replied_at = now() where id = $1 and agent_id = $2 and human_replied_at is null returning id",
      [A_LEAD, A_AGENT]);
    expect(asA.rowCount, "the owning agent must still be able to").toBe(1);
  });

  test("stopping a sequence: B's filter matches nothing", async (c) => {
    const asB = await c.query(
      "update rift_enrolments set stopped_at = now(), stop_reason = 'replied' where lead_id = $1 and agent_id = $2 and stopped_at is null returning id",
      [A_LEAD, B_AGENT]);
    expect(asB.rowCount, "a stopped sequence does not restart — this must not be reachable").toBe(0);

    const asA = await c.query(
      "update rift_enrolments set stopped_at = now(), stop_reason = 'replied' where lead_id = $1 and agent_id = $2 and stopped_at is null returning id",
      [A_LEAD, A_AGENT]);
    expect(asA.rowCount).toBe(1);
  });

  test("promoting a figure: B cannot read the item, so cannot advance it", async (c) => {
    /* The read comes first in promoteItem, and scoping it is what makes the
       function report "no such review item" rather than promoting somebody
       else's estimate to verified with a name attached. */
    const readAsB = await c.query(
      "select id from rift_review_items where id = 'aaaa4444-0000-4000-8000-0000000000a4' and agent_id = $1",
      [B_AGENT]);
    expect(readAsB.rowCount).toBe(0);

    const writeAsB = await c.query(
      `update rift_review_items set state = 'reviewed'
         where id = 'aaaa4444-0000-4000-8000-0000000000a4' and agent_id = $1
           and state = 'pending-review' returning id`,
      [B_AGENT]);
    expect(writeAsB.rowCount, "a green verified chip must never be someone else's doing").toBe(0);

    const readAsA = await c.query(
      "select id from rift_review_items where id = 'aaaa4444-0000-4000-8000-0000000000a4' and agent_id = $1",
      [A_AGENT]);
    expect(readAsA.rowCount).toBe(1);
  });
});

describe("the data layer still asks the way these tests assume", () => {
  /* The suite above proves the FILTER works. It cannot notice somebody
     deleting the filter, which is the way this actually regresses — the code
     keeps compiling, every test keeps passing, and the scope is simply gone.
     So the source is read directly. Not elegant; it is the only thing between
     a one-line deletion and a silent cross-agent write.
     
     What it catches: the scoping disappearing from a function entirely, and
     the parameter going back to being resolved inside rather than passed in.
     What it does NOT catch: `markReplied` scopes in two places — the update
     and the re-read that follows it — and removing one of the two still
     passes this. Said out loud so nobody reads a green tick here as more
     assurance than it is. */
  const scoped: [string, string][] = [
    ["lib/db/leads.ts", "markReplied"],
    ["lib/db/nurture.ts", "stop"],
    ["lib/db/review.ts", "promoteItem"],
  ];

  for (const [file, fn] of scoped) {
    it(`${fn} takes an agentId and filters on it`, () => {
      const src = readFileSync(file, "utf8");
      const start = src.indexOf(`export async function ${fn}(`);
      expect(start, `${fn} should exist in ${file}`).toBeGreaterThan(-1);

      /* To the end of the function, found by the next top-level export. */
      const rest = src.slice(start + 1);
      const next = rest.indexOf("\nexport ");
      const body = next === -1 ? rest : rest.slice(0, next);

      expect(body, `${fn} must accept the signed-in agent, not resolve one`)
        .toMatch(/agentId: string/);
      expect(body, `${fn} must scope its write — it runs on the service-role client, which RLS never sees`)
        .toMatch(/\.eq\("agent_id", agentId\)/);
    });
  }
});

describe("the single-agent assumption", () => {
  test("more than one agent row exists here, which is the case that used to be silent", async (c) => {
    /* `currentAgentId()` was `select id from rift_agents limit 1`. Against
       this fixture that returns whichever row Postgres feels like, and every
       public write would attach a stranger's lead to it. It asks for two rows
       now and refuses when it gets them. */
    const { rows } = await c.query("select id from rift_agents limit 2");
    expect(rows.length, "the fixture needs two agents for the refusal to mean anything").toBe(2);
  });
});
