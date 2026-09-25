import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { pendingMigrationsSql, riftMigrations, OUTPUT } from "../../scripts/pending-migrations.mjs";

/**
 * output/pending-migrations.sql is what production is actually caught up with:
 * pasted into the Supabase SQL editor by someone who cannot tell which
 * migrations the database already has. So the property that matters is not
 * that each migration works, which the schema suites prove, but that the one
 * file lands on the same schema from ANY starting point, and twice.
 *
 * Each case gets a database of its own, created and dropped here, so this
 * never touches the schema the other suites rebuild.
 */

type Migration = { name: string; sql: string };

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
const at = (db: string) => { const u = new URL(URL_); u.pathname = `/${db}`; return u.toString(); };

let admin: Client | null = null;
const migrations: Migration[] = riftMigrations();
const catchUp: string = pendingMigrationsSql(migrations);
const shim = readFileSync("supabase/test/shim.sql", "utf8");

beforeAll(async () => {
  const c = new Client({ connectionString: at("postgres"), connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    admin = c;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try { await c.end(); } catch { /* never connected */ }
    if (!/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout expired/i.test(msg)) throw e;
  }
});

afterAll(async () => { if (admin) await admin.end(); });

/** A fresh database with the Supabase shim and the first `applied` migrations. */
async function databaseAt(name: string, applied: number): Promise<Client> {
  await admin!.query(`drop database if exists ${name} with (force)`);
  await admin!.query(`create database ${name}`);
  const c = new Client({ connectionString: at(name) });
  await c.connect();
  c.on("notice", () => { /* the skips are expected; they are not output */ });
  await c.query(shim);
  for (const m of migrations.slice(0, applied)) await c.query(m.sql);
  return c;
}

/** Everything a migration can create, in a form two databases can be compared by. */
async function schemaOf(c: Client): Promise<string[]> {
  const rows = await c.query<{ line: string }>(`
    select 'column ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable
           || ' ' || coalesce(column_default, '') as line
      from information_schema.columns where table_schema = 'public'
    union all
    select 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
      from pg_constraint where connamespace = 'public'::regnamespace
    union all
    select 'index ' || indexdef from pg_indexes where schemaname = 'public'
    union all
    select 'policy ' || schemaname || '.' || tablename || ' ' || policyname || ' ' || cmd
           || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
      from pg_policies where schemaname in ('public', 'storage')
    union all
    select 'rls ' || relname || ' ' || relrowsecurity
      from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
    union all
    select 'function ' || p.oid::regprocedure || ' ' || md5(pg_get_functiondef(p.oid))
      from pg_proc p where p.pronamespace = 'public'::regnamespace
    union all
    select 'trigger ' || tgrelid::regclass || ' ' || tgname
      from pg_trigger where not tgisinternal
  `);
  return rows.rows.map((r) => r.line).sort();
}

const test = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!admin) return ctx.skip();
    await fn();
  }, 120_000);

describe("output/pending-migrations.sql", () => {
  it("is the file the script generates now: regenerate with npm run rift:pending-migrations", () => {
    expect(readFileSync(OUTPUT, "utf8")).toBe(catchUp);
  });

  test("lands on the same schema as the migrations run in order, from every starting point, twice", async () => {
    const reference = await databaseAt("rift_catchup_reference", migrations.length);
    const expected = await schemaOf(reference);
    await reference.end();
    expect(expected.length).toBeGreaterThan(100);

    for (let applied = 0; applied <= migrations.length; applied++) {
      const c = await databaseAt("rift_catchup_case", applied);
      const from = applied === 0 ? "an empty database" : `after ${migrations[applied - 1].name}`;
      try {
        await c.query(catchUp);
        await c.query(catchUp);
      } catch (e) {
        throw new Error(`the catch-up file failed ${from}: ${e instanceof Error ? e.message : e}. ` +
          `A migration that cannot run twice needs an entry in APPLIED_WHEN in scripts/pending-migrations.mjs.`);
      }
      expect(await schemaOf(c), from).toEqual(expected);
      await c.end();
    }
    await admin!.query("drop database if exists rift_catchup_case with (force)");
    await admin!.query("drop database if exists rift_catchup_reference with (force)");
  });
});
