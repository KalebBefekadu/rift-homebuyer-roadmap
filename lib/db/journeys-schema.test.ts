import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

/**
 * Journeys, members, the search brief and the shortlist, against a real
 * Postgres with the whole migration history applied.
 *
 * The acceptance list in docs/blueprint-v4/first-migration-proposal.md is the
 * spine of this file, extended to the three migrations after it. Policies are
 * exercised as a role that is NOT the table owner (the owner bypasses RLS,
 * which is how a first version of lib/db/rls.test.ts passed while proving
 * nothing).
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
let db: Client | null = null;

const A_USER = "a0000000-0000-4000-8000-0000000000aa";
const B_USER = "b0000000-0000-4000-8000-0000000000bb";
const CLIENT_USER = "c0000000-0000-4000-8000-0000000000cc";
const A = "a2222222-0000-4000-8000-00000000000a";
const B = "b2222222-0000-4000-8000-00000000000b";
const A_LEAD = "a3333333-0000-4000-8000-00000000000a";
const B_LEAD = "b3333333-0000-4000-8000-00000000000b";
const J1 = "a4444444-0000-4000-8000-000000000001";
const J2 = "a4444444-0000-4000-8000-000000000002";
const HASH = "a".repeat(64);

function riftMigrations(): string[] {
  const dir = "supabase/migrations";
  return readdirSync(dir).filter((f) => f.endsWith(".sql") && f.includes("_rift_")).sort().map((f) => `${dir}/${f}`);
}

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    for (const f of riftMigrations()) await c.query(readFileSync(f, "utf8"));
    await c.query("insert into auth.users (id) values ($1),($2),($3) on conflict do nothing", [A_USER, B_USER, CLIENT_USER]);
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,$2,'Agent A','a@example.com'), ($3,$4,'Agent B','b@example.com')",
      [A, A_USER, B, B_USER]);
    await c.query(
      "insert into rift_leads (id, agent_id, side, name, contact_basis) values ($1,$2,'buy','Devon','assessment'), ($3,$4,'buy','Other','assessment')",
      [A_LEAD, A, B_LEAD, B]);
    await c.query("do $$ begin if not exists (select 1 from pg_roles where rolname='rls_user') then execute 'create role rls_user nologin'; end if; end $$");
    await c.query("grant usage on schema public to rls_user");
    await c.query("grant select, insert, update, delete on all tables in schema public to rls_user");
    db = c;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db = null;
    try { await c.end(); } catch { /* never connected */ }
    if (!/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout expired/i.test(msg)) {
      throw new Error(`database setup failed (not a connection problem): ${msg}`);
    }
  }
}, 60_000);

afterAll(async () => { if (db) await db.end(); });

const test = (name: string, fn: (c: Client) => Promise<void>) =>
  it(name, async (ctx) => {
    if (!db) return ctx.skip();
    await fn(db);
  });

let inTx = false;

/** Runs as a signed-in user who is not the table owner, then rolls back. */
async function as<T>(c: Client, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  inTx = true;
  await c.query("set local role rls_user");
  if (userId) await c.query(`set local "request.jwt.claim.sub" = '${userId}'`);
  try { return await fn(); } finally { await c.query("rollback"); inTx = false; }
}

/** A statement expected to fail, isolated so the failure does not poison what follows. */
async function refused(c: Client, sql: string, params: unknown[], match: RegExp) {
  await c.query(inTx ? "savepoint s" : "begin");
  try {
    await expect(c.query(sql, params as never[])).rejects.toThrow(match);
  } finally {
    await c.query(inTx ? "rollback to savepoint s" : "rollback");
  }
}

describe("journeys (first-migration-proposal acceptance)", () => {
  test("fixtures: two journeys on one relationship, both buying", async (c) => {
    // 6. Two journeys for one relationship, including two on the same side, are permitted.
    await c.query(
      "insert into rift_journeys (id, agent_id, origin_lead_id, side, label) values ($1,$2,$3,'buy','First home'), ($4,$2,$3,'buy','Rental')",
      [J1, A, A_LEAD, J2]);
    const { rows } = await c.query("select count(*)::int n from rift_journeys where origin_lead_id = $1", [A_LEAD]);
    expect(rows[0].n).toBe(2);
  });

  test("1. the agent reads their own journeys; another agent and a stranger read none", async (c) => {
    expect((await as(c, A_USER, () => c.query("select id from rift_journeys"))).rowCount).toBe(2);
    expect((await as(c, B_USER, () => c.query("select id from rift_journeys"))).rowCount).toBe(0);
    expect((await as(c, null, () => c.query("select id from rift_journeys"))).rowCount).toBe(0);
  });

  test("2. B cannot insert a journey under A's agent id", async (c) => {
    await as(c, B_USER, () => refused(c,
      "insert into rift_journeys (agent_id, origin_lead_id, side, label) values ($1,$2,'buy','x')",
      [A, A_LEAD], /row-level security/));
  });

  test("3. A cannot attach a journey to B's relationship, even bypassing RLS (AT02)", async (c) => {
    await refused(c,
      "insert into rift_journeys (agent_id, origin_lead_id, side, label) values ($1,$2,'buy','x')",
      [A, B_LEAD], /rift_journeys_relationship_same_agent/);
  });

  test("4. a signed-in client with no agent row sees no journeys", async (c) => {
    expect((await as(c, CLIENT_USER, () => c.query("select id from rift_journeys"))).rowCount).toBe(0);
  });

  test("7. empty, whitespace and oversized labels and unknown sides fail", async (c) => {
    for (const label of ["", "   ", "x".repeat(161)]) {
      await refused(c, "insert into rift_journeys (agent_id, origin_lead_id, side, label) values ($1,$2,'buy',$3)", [A, A_LEAD, label], /check/);
    }
    await refused(c, "insert into rift_journeys (agent_id, origin_lead_id, side, label) values ($1,$2,'rent','x')", [A, A_LEAD], /check/);
  });

  test("8. deleting a lead or agent that has a journey is refused, not cascaded", async (c) => {
    await refused(c, "delete from rift_leads where id = $1", [A_LEAD], /rift_journeys_relationship_same_agent/);
    await refused(c, "delete from rift_agents where id = $1", [A], /foreign key/);
  });

  test("AT03. updating one journey never changes the other", async (c) => {
    await c.query("begin");
    await c.query("update rift_journeys set label = 'Starter home' where id = $1", [J1]);
    const { rows } = await c.query("select label from rift_journeys where id = $1", [J2]);
    expect(rows[0].label).toBe("Rental");
    await c.query("rollback");
  });
});

describe("members", () => {
  const M1 = "a5555555-0000-4000-8000-000000000001";
  const M2 = "a5555555-0000-4000-8000-000000000002";

  test("fixtures: an invitation and an accepted co-buyer", async (c) => {
    await c.query(
      `insert into rift_journey_members (id, agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
       values ($1,$2,$3,'devon@example.com','buyer','{search,homes,money}',$4, now() + interval '14 days')`,
      [M1, A, J1, HASH]);
    await c.query(
      `insert into rift_journey_members (id, agent_id, journey_id, email, role, scopes, auth_user_id, accepted_at)
       values ($1,$2,$3,'sam@example.com','co-buyer','{search,homes}',$4, now())`,
      [M2, A, J1, CLIENT_USER]);
  });

  test("a member must belong to the same agent as the journey", async (c) => {
    await refused(c,
      `insert into rift_journey_members (agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
       values ($1,$2,'x@example.com','viewer','{search}',$3, now())`,
      [B, J1, "b".repeat(64)], /rift_journey_members_journey_same_agent/);
  });

  test("one live row per address on a journey", async (c) => {
    await refused(c,
      `insert into rift_journey_members (agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
       values ($1,$2,'devon@example.com','viewer','{search}',$3, now())`,
      [A, J1, "c".repeat(64)], /one_live_email/);
  });

  test("addresses are stored lower-case, and scopes are from the list", async (c) => {
    await refused(c,
      `insert into rift_journey_members (agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
       values ($1,$2,'Mixed@Example.com','viewer','{search}',$3, now())`,
      [A, J1, "d".repeat(64)], /check/);
    await refused(c,
      `insert into rift_journey_members (agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
       values ($1,$2,'e@example.com','viewer','{everything}',$3, now())`,
      [A, J1, "e".repeat(64)], /check/);
  });

  test("a login is attached only by accepting, and an accepted link is spent", async (c) => {
    await refused(c, "update rift_journey_members set auth_user_id = $1 where id = $2", [CLIENT_USER, M1], /user_means_accepted/);
    await refused(c, "update rift_journey_members set accepted_at = now() where id = $1", [M1], /accepted_link_spent/);
  });

  test("a waiting invitation has a link and an expiry", async (c) => {
    await refused(c, "update rift_journey_members set invite_token_hash = null where id = $1", [M1], /pending_has_link/);
  });

  test("another agent cannot read the invitations (AT02)", async (c) => {
    expect((await as(c, B_USER, () => c.query("select id from rift_journey_members"))).rowCount).toBe(0);
    expect((await as(c, CLIENT_USER, () => c.query("select id from rift_journey_members"))).rowCount).toBe(0);
  });
});

describe("search revisions", () => {
  const brief = JSON.stringify([{ id: "beds", field: "bedrooms", operator: "atLeast", value: 3, unit: "count", strength: "hard", statedBy: "Devon", statedAt: "2026-09-20", sourceRef: "call" }]);
  const insert = (c: Client, rev: number, journey = J1, agent = A) => c.query(
    `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
     values ($1,$2,$3,1,$4,'agent','Agent A') returning id`, [agent, journey, rev, brief]);

  test("revisions are numbered in order with no gaps", async (c) => {
    await insert(c, 1);
    await refused(c,
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,3,1,$3,'agent','A')`, [A, J1, brief], /out of order/);
    await refused(c,
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,1,1,$3,'agent','A')`, [A, J1, brief], /out of order|one_number/);
  });

  test("a revision is never edited (AT09)", async (c) => {
    await refused(c, "update rift_search_revisions set criteria = '[]' where journey_id = $1", [J1], /cannot be edited/);
  });

  test("another journey keeps its own numbering", async (c) => {
    const r = await insert(c, 1, J2);
    expect(r.rowCount).toBe(1);
  });

  test("a revision cannot be written onto somebody else's journey", async (c) => {
    await refused(c,
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,2,1,$3,'agent','B')`, [B, J1, brief], /journey_same_agent/);
  });

  test("a client revision names the member; an agent revision does not", async (c) => {
    await refused(c,
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,2,1,$3,'client','Sam')`, [A, J1, brief], /rift_search_revisions_author/);
  });

  test("asking for changes has to say what", async (c) => {
    const rev = await c.query("select id from rift_search_revisions where journey_id = $1 and revision = 1", [J1]);
    await refused(c,
      "insert into rift_search_responses (agent_id, journey_id, revision_id, member_id, response) values ($1,$2,$3,$4,'changes-requested')",
      [A, J1, rev.rows[0].id, "a5555555-0000-4000-8000-000000000002"], /changes_say_why/);
  });
});

describe("approval and activation (AT11, AT12, AT13)", () => {
  const pkg = JSON.stringify({ destination: "matrix", filters: [] });
  const brief = JSON.stringify([]);
  let rev1 = "";

  test("fixtures", async (c) => {
    rev1 = (await c.query("select id from rift_search_revisions where journey_id = $1 and revision = 1", [J1])).rows[0].id;
  });

  const approve = (c: Client, revision: string, request: string, agent = A) => c.query(
    "select rift_approve_search_package($1,$2,$3,'daily',$4,$5,'Agent A',$6) id",
    [agent, J1, revision, pkg, HASH, request]);

  test("approving is refused for somebody else's journey", async (c) => {
    await refused(c, "select rift_approve_search_package($1,$2,$3,'daily',$4,$5,'B',$6)",
      [B, J1, rev1, pkg, HASH, "b9999999-0000-4000-8000-000000000001"], /not in your book/);
  });

  test("the same approval request twice records one package", async (c) => {
    const req = "a9999999-0000-4000-8000-000000000001";
    const one = (await approve(c, rev1, req)).rows[0].id;
    const two = (await approve(c, rev1, req)).rows[0].id;
    expect(two).toBe(one);
    const { rows } = await c.query("select status from rift_search_packages where journey_id = $1", [J1]);
    expect(rows).toEqual([{ status: "manual-action-needed" }]);
  });

  test("an approved package is fixed", async (c) => {
    await refused(c, "update rift_search_packages set cadence = 'weekly' where journey_id = $1", [J1], /cannot be changed/);
  });

  test("active means evidence: no reference, no active status (AT11)", async (c) => {
    await refused(c, "update rift_search_packages set status = 'active-confirmed', confirmed_at = now() where journey_id = $1",
      [J1], /confirmed_has_evidence/);
  });

  test("a newer revision makes the older approval unconfirmable (AT12)", async (c) => {
    await c.query("begin");
    await c.query(
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,2,1,$3,'agent','A')`, [A, J1, brief]);
    const waiting = (await c.query("select id from rift_search_packages where journey_id = $1 and status = 'manual-action-needed'", [J1])).rows[0].id;
    await expect(c.query("select rift_confirm_search_package($1,$2,'Devon 3bd',null,null,$3)",
      [A, waiting, "a9999999-0000-4000-8000-0000000000c1"])).rejects.toThrow(/brief changed after you approved/);
    await c.query("rollback");
    // And approving the stale revision is refused too.
    await c.query("begin");
    await c.query(
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,2,1,$3,'agent','A')`, [A, J1, brief]);
    await expect(approve(c, rev1, "a9999999-0000-4000-8000-0000000000c2")).rejects.toThrow(/review the latest revision/);
    await c.query("rollback");
  });

  test("recording the setup twice records it once, and a later setup supersedes it (AT13)", async (c) => {
    const waiting = (await c.query("select id from rift_search_packages where journey_id = $1 and status = 'manual-action-needed'", [J1])).rows[0].id;
    const req = "a9999999-0000-4000-8000-0000000000d1";
    await c.query("select rift_confirm_search_package($1,$2,'Devon 3bd',null,null,$3)", [A, waiting, req]);
    await c.query("select rift_confirm_search_package($1,$2,'Devon 3bd',null,null,$3)", [A, waiting, req]);
    const active = await c.query("select id, status, external_ref from rift_search_packages where journey_id = $1 and status = 'active-confirmed'", [J1]);
    expect(active.rows).toEqual([{ id: waiting, status: "active-confirmed", external_ref: "Devon 3bd" }]);

    // A second round: new approval, new confirmation, the first one is superseded.
    await approve(c, rev1, "a9999999-0000-4000-8000-0000000000d2");
    const next = (await c.query("select id from rift_search_packages where journey_id = $1 and status = 'manual-action-needed'", [J1])).rows[0].id;
    await c.query("select rift_confirm_search_package($1,$2,null,'https://matrix.example/s/1',null,$3)", [A, next, "a9999999-0000-4000-8000-0000000000d3"]);
    const { rows } = await c.query("select id, status from rift_search_packages where journey_id = $1 order by approved_at", [J1]);
    expect(rows.map((r) => r.status)).toEqual(["superseded", "active-confirmed"]);
  });

  test("a second waiting approval replaces the first rather than stacking", async (c) => {
    await approve(c, rev1, "a9999999-0000-4000-8000-0000000000e1");
    await approve(c, rev1, "a9999999-0000-4000-8000-0000000000e2");
    const { rows } = await c.query("select count(*)::int n from rift_search_packages where journey_id = $1 and status = 'manual-action-needed'", [J1]);
    expect(rows[0].n).toBe(1);
  });

  test("the commands are not callable by a signed-in user", async (c) => {
    await as(c, A_USER, () => refused(c, "select rift_approve_search_package($1,$2,$3,'daily',$4,$5,'A',$6)",
      [A, J1, rev1, pkg, HASH, "a9999999-0000-4000-8000-0000000000f1"], /permission denied/));
  });
});

describe("shortlist and reactions (AT14)", () => {
  const H = "a6666666-0000-4000-8000-000000000001";
  test("fixtures", async (c) => {
    await c.query(
      `insert into rift_shortlist_homes (id, agent_id, journey_id, address, url, facts_source, facts_as_of, added_by_kind, added_by_label)
       values ($1,$2,$3,'12 Oak St, Lilburn','https://example.com/1','Matrix listing','2026-09-21','agent','Agent A')`, [H, A, J1]);
  });

  test("two people's reactions to one home both stay", async (c) => {
    await c.query(
      `insert into rift_home_reactions (agent_id, journey_id, home_id, member_id, actor_label, reaction)
       values ($1,$2,$3,'a5555555-0000-4000-8000-000000000002','Sam','pass'),
              ($1,$2,$3,'a5555555-0000-4000-8000-000000000001','Devon','interested')`, [A, J1, H]);
    const { rows } = await c.query("select actor_label, reaction from rift_home_reactions where home_id = $1 order by actor_label", [H]);
    expect(rows).toEqual([{ actor_label: "Devon", reaction: "interested" }, { actor_label: "Sam", reaction: "pass" }]);
  });

  test("a reaction is history", async (c) => {
    await refused(c, "update rift_home_reactions set reaction = 'maybe' where home_id = $1", [H], /is history/);
  });

  test("a link that could run is refused", async (c) => {
    await refused(c,
      `insert into rift_shortlist_homes (agent_id, journey_id, address, url, facts_source, facts_as_of, added_by_kind, added_by_label)
       values ($1,$2,'1 Bad Rd','javascript:alert(1)','x','2026-09-21','agent','A')`, [A, J1], /check/);
  });

  test("a reaction cannot point at a home on another journey", async (c) => {
    await refused(c,
      `insert into rift_home_reactions (agent_id, journey_id, home_id, actor_label, reaction) values ($1,$2,$3,'A','maybe')`,
      [A, J2, H], /home_on_journey/);
  });
});

describe("tours (W06; AT17, AT18 in the record)", () => {
  const H2 = "a6666666-0000-4000-8000-000000000002";
  const S1 = "a7777777-0000-4000-8000-000000000001";
  const req = (n: number) => `a8888888-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const step = (seq: number, status: string, extra = "", vals: unknown[] = []): [string, unknown[]] =>
    [`insert into rift_tour_steps (agent_id, journey_id, stop_id, seq, status, actor_label, request_id${extra ? ", " + extra : ""})
      values ($1,$2,$3,$4,$5,'Agent A',$6${vals.map((_, i) => `,$${7 + i}`).join("")})`, [A, J1, S1, seq, status, req(seq * 10 + vals.length), ...vals]];
  const insert = (c: Client, [sql, params]: [string, unknown[]]) => c.query(sql, params as never[]);

  test("fixtures", async (c) => {
    await c.query(
      `insert into rift_shortlist_homes (id, agent_id, journey_id, address, facts_source, facts_as_of, added_by_kind, added_by_label)
       values ($1,$2,$3,'40 Pine Ct, Duluth','Matrix listing','2026-09-21','agent','Agent A')`, [H2, A, J1]);
    await c.query(
      `insert into rift_tour_stops (id, agent_id, journey_id, home_id, requested_by_kind, requested_by_label, availability)
       values ($1,$2,$3,$4,'agent','Agent A','Saturday afternoon')`, [S1, A, J1, H2]);
    await insert(c, step(1, "requested"));
  });

  test("the first step is always the request, and only the first", async (c) => {
    await refused(c, ...step(2, "requested"), /first_is_request/);
    const [sql, params] = step(1, "confirmed", "starts_at, ends_at", ["2026-10-03T18:00:00Z", "2026-10-03T18:30:00Z"]);
    await refused(c, sql, [...params.slice(0, 5), req(99), ...params.slice(6)], /first_is_request|rift_tour_steps_seq/);
  });

  test("two people recording the same next step: one wins", async (c) => {
    await insert(c, step(2, "awaiting-confirmation"));
    await refused(c, `insert into rift_tour_steps (agent_id, journey_id, stop_id, seq, status, actor_label, request_id, note)
       values ($1,$2,$3,2,'cancelled','Agent A',$4,'x')`, [A, J1, S1, req(500)], /rift_tour_steps_seq/);
  });

  test("a confirmation needs a whole slot, forwards in time", async (c) => {
    await refused(c, ...step(3, "confirmed"), /slot_when_timed/);
    await refused(c, ...step(3, "confirmed", "starts_at, ends_at", ["2026-10-03T18:30:00Z", "2026-10-03T18:00:00Z"]), /slot_forward/);
    await refused(c, ...step(3, "confirmed", "starts_at", ["2026-10-03T18:00:00Z"]), /slot_is_whole/);
    await insert(c, step(3, "confirmed", "starts_at, ends_at", ["2026-10-03T18:00:00Z", "2026-10-03T18:30:00Z"]));
  });

  test("a cancellation says why", async (c) => {
    await refused(c, ...step(4, "cancelled"), /cancel_says_why/);
  });

  test("the same request twice is one step", async (c) => {
    await refused(c, `insert into rift_tour_steps (agent_id, journey_id, stop_id, seq, status, actor_label, request_id)
       values ($1,$2,$3,4,'completed','Agent A',$4)`, [A, J1, S1, req(20)], /request_id/);
  });

  test("steps, stops and answers are history", async (c) => {
    await refused(c, "update rift_tour_steps set status = 'completed' where stop_id = $1 and seq = 3", [S1], /is history/);
    await refused(c, "update rift_tour_stops set availability = 'any time' where id = $1", [S1], /is history/);
    await c.query(`insert into rift_tour_feedback (agent_id, journey_id, stop_id, actor_label, offer) values ($1,$2,$3,'Devon (told the agent)','maybe')`, [A, J1, S1]);
    await refused(c, "update rift_tour_feedback set offer = 'yes' where stop_id = $1", [S1], /is history/);
  });

  test("a showing cannot point at a home on another journey", async (c) => {
    await refused(c,
      `insert into rift_tour_stops (agent_id, journey_id, home_id, requested_by_kind, requested_by_label) values ($1,$2,$3,'agent','A')`,
      [A, J2, H2], /home_on_journey/);
  });

  test("another agent sees none of it", async (c) => {
    const mine = await as(c, A_USER, async () => (await c.query("select count(*)::int n from rift_tour_steps")).rows[0].n);
    const theirs = await as(c, B_USER, async () => (await c.query("select count(*)::int n from rift_tour_steps")).rows[0].n);
    expect(mine).toBeGreaterThan(0);
    expect(theirs).toBe(0);
  });

  test("there is nowhere to put access or lockbox details", async (c) => {
    const { rows } = await c.query(
      "select table_name, column_name from information_schema.columns where table_name like 'rift_tour%' and column_name ~* '(access|lockbox|code|gate|key)'");
    expect(rows).toEqual([]);
  });
});

describe("progress (W07; REQ-STATE-05, 06, REQ-UX-02 in the record)", () => {
  const H3 = "a6666666-0000-4000-8000-000000000003";
  const T1 = "a9999999-0000-4000-8000-000000000001";
  const DEVON = "a5555555-0000-4000-8000-000000000001";
  const rq = (n: number) => `a9999999-1111-4000-8000-${String(n).padStart(12, "0")}`;
  const event = (seq: number, kind: string, from: string, to: string, tx: string | null, n: number) => c2(
    `insert into rift_journey_events (agent_id, journey_id, seq, kind, from_value, to_value, reason, transaction_id, actor_label, request_id)
     values ($1,$2,$3,$4,$5,$6,'because',$7,'Agent A',$8)`, [A, J1, seq, kind, from, to, tx, rq(n)]);
  const work = (seq: number, state: string, extra: Record<string, unknown> = {}, n = seq) => {
    const cols = { owner: "other", owner_name: "Dana at Peach Mortgage", actor_kind: "agent", ...extra };
    const keys = Object.keys(cols);
    return c2(
      `insert into rift_workstream_updates (agent_id, journey_id, transaction_id, workstream, seq, state, actor_label, request_id, ${keys.join(", ")})
       values ($1,$2,$3,'financing',$4,$5,'Agent A',$6${keys.map((_, i) => `,$${7 + i}`).join("")})`,
      [A, J1, T1, seq, state, rq(100 + n), ...Object.values(cols)]);
  };
  function c2(sql: string, params: unknown[]): [string, unknown[]] { return [sql, params]; }
  const run = (c: Client, [sql, params]: [string, unknown[]]) => c.query(sql, params as never[]);

  test("fixtures", async (c) => {
    await c.query(
      `insert into rift_shortlist_homes (id, agent_id, journey_id, address, facts_source, facts_as_of, added_by_kind, added_by_label)
       values ($1,$2,$3,'7 Elm Way, Tucker','Matrix listing','2026-09-21','agent','Agent A')`, [H3, A, J1]);
    await run(c, event(1, "stage", "prepare", "search", null, 1));
  });

  test("Under contract is reached only with a contract attached", async (c) => {
    await refused(c, ...event(2, "stage", "search", "under-contract", null, 2), /contract_stages/);
    await c.query(
      `insert into rift_transactions (id, agent_id, journey_id, home_id, financing, evidence, actor_label, request_id)
       values ($1,$2,$3,$4,'financed','Executed purchase agreement, 23 Sep','Agent A',$5)`, [T1, A, J1, H3, rq(900)]);
    await run(c, event(2, "stage", "search", "under-contract", T1, 3));
  });

  test("two people changing the stage at once: one wins", async (c) => {
    await refused(c, ...event(2, "status", "active", "paused", null, 4), /rift_journey_events_seq/);
  });

  test("a stage never moves to itself or to a value that does not exist", async (c) => {
    await refused(c, ...event(3, "stage", "under-contract", "under-contract", T1, 5), /_moves/);
    await refused(c, ...event(3, "stage", "under-contract", "escrow", T1, 6), /_values/);
  });

  test("a client can report, never confirm", async (c) => {
    await run(c, work(1, "not-started"));
    await refused(c, ...work(2, "confirmed", { actor_kind: "client", member_id: DEVON, source: "me", confirmed_on: "2026-09-22" }), /client_reports/);
    await refused(c, ...work(2, "reported", { actor_kind: "client" }), /client_reports/);
  });

  test("confirmed needs a named source and a date; blocked says why", async (c) => {
    await refused(c, ...work(2, "confirmed", { source: "Dana at Peach Mortgage" }), /confirmed_has_source/);
    await refused(c, ...work(2, "blocked"), /blocked_says_why/);
    await refused(c, ...work(2, "waiting", { owner_name: null }), /other_is_named/);
    await run(c, work(2, "blocked", { note: "Needs two more pay stubs" }));
  });

  test("the walkthrough and possession are workstreams too, and nothing else new is (W11)", async (c) => {
    for (const [ws, n] of [["walkthrough", 950], ["possession", 951]] as const) {
      await c.query(
        `insert into rift_workstream_updates (agent_id, journey_id, transaction_id, workstream, seq, state, owner, actor_kind, actor_label, request_id)
         values ($1,$2,$3,$4,1,'not-started','agent','agent','Agent A',$5)`, [A, J1, T1, ws, rq(n)]);
    }
    await refused(c,
      `insert into rift_workstream_updates (agent_id, journey_id, transaction_id, workstream, seq, state, owner, actor_kind, actor_label, request_id)
       values ($1,$2,$3,'keys',1,'not-started','agent','agent','Agent A',$4)`, [A, J1, T1, rq(952)], /workstream_check/);
    await c.query(`delete from rift_workstream_updates where transaction_id = $1 and workstream in ('walkthrough', 'possession')`, [T1]);
  });

  test("a contract ends once, and everything recorded against it stays", async (c) => {
    await c.query(`insert into rift_transaction_outcomes (agent_id, journey_id, transaction_id, outcome, reason, actor_label)
       values ($1,$2,$3,'terminated','Financing fell through','Agent A')`, [A, J1, T1]);
    await refused(c, `insert into rift_transaction_outcomes (agent_id, journey_id, transaction_id, outcome, reason, actor_label)
       values ($1,$2,$3,'closed','Changed my mind','Agent A')`, [A, J1, T1], /transaction_id/);
    const { rows } = await c.query("select count(*)::int n from rift_workstream_updates where transaction_id = $1", [T1]);
    expect(rows[0].n).toBe(2);
  });

  test("all of it is history", async (c) => {
    await refused(c, "update rift_journey_events set to_value = 'offer' where journey_id = $1 and seq = 1", [J1], /is history/);
    await refused(c, "update rift_transactions set financing = 'cash' where id = $1", [T1], /is history/);
    await refused(c, "update rift_transaction_outcomes set outcome = 'closed' where transaction_id = $1", [T1], /is history/);
    await refused(c, "update rift_workstream_updates set state = 'confirmed' where transaction_id = $1", [T1], /is history/);
  });

  test("a contract cannot point at a home on another journey", async (c) => {
    await refused(c,
      `insert into rift_transactions (agent_id, journey_id, home_id, financing, evidence, actor_label, request_id)
       values ($1,$2,$3,'cash','Executed','A',$4)`, [A, J2, H3, rq(901)], /home_on_journey/);
  });

  test("another agent sees none of it", async (c) => {
    for (const t of ["rift_journey_events", "rift_transactions", "rift_workstream_updates"]) {
      const mine = await as(c, A_USER, async () => (await c.query(`select count(*)::int n from ${t}`)).rows[0].n);
      const theirs = await as(c, B_USER, async () => (await c.query(`select count(*)::int n from ${t}`)).rows[0].n);
      expect(mine, t).toBeGreaterThan(0);
      expect(theirs, t).toBe(0);
    }
  });
});

describe("offers and documents (W08; AT22 to AT25 in the record)", () => {
  const H4 = "a6666666-0000-4000-8000-000000000004";
  const BID = "abbbbbbb-0000-4000-8000-000000000001";
  const DEVON = "a5555555-0000-4000-8000-000000000001";
  const rq = (n: number) => `abbbbbbb-1111-4000-8000-${String(n).padStart(12, "0")}`;
  const TERMS = JSON.stringify({ price: 400000, earnestMoney: 5000, financing: "conventional", downPct: 10 });
  const stepSql = `insert into rift_bid_steps (agent_id, journey_id, bid_id, seq, kind, version, terms, origin, required, note, actor_label, request_id)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,'Agent A',$11)`;
  const st = (seq: number, kind: string, version: number, extra: { terms?: string | null; origin?: string | null; required?: string; note?: string | null } = {}, n = seq): [string, unknown[]] =>
    [stepSql, [A, J1, BID, seq, kind, version, extra.terms ?? null, extra.origin ?? null, extra.required ?? "[]", extra.note ?? null, rq(n)]];
  const answer = (instruction: string, note: string | null, n: number, member = DEVON): [string, unknown[]] =>
    [`insert into rift_bid_responses (agent_id, journey_id, bid_id, version, member_id, instruction, note, actor_label, request_id)
      values ($1,$2,$3,1,$4,$5,$6,'Devon',$7)`, [A, J1, BID, member, instruction, note, rq(n)]];
  const run = (c: Client, [sql, params]: [string, unknown[]]) => c.query(sql, params as never[]);

  test("fixtures", async (c) => {
    await c.query(
      `insert into rift_shortlist_homes (id, agent_id, journey_id, address, facts_source, facts_as_of, added_by_kind, added_by_label)
       values ($1,$2,$3,'3 Birch Ln, Snellville','Matrix listing','2026-09-21','agent','Agent A')`, [H4, A, J1]);
    await c.query(`insert into rift_bids (id, agent_id, journey_id, home_id, actor_label) values ($1,$2,$3,$4,'Agent A')`, [BID, A, J1, H4]);
  });

  test("an offer starts with our terms, as version 1, and terms steps carry terms", async (c) => {
    await refused(c, ...st(1, "ask", 1, { required: '[{"memberId":"x","name":"Devon"}]' }), /first_is_ours/);
    await refused(c, ...st(1, "terms", 1, { terms: TERMS, origin: "theirs" }), /first_is_ours/);
    await refused(c, ...st(1, "terms", 1, { origin: "ours" }), /terms_carry_terms/);
    await run(c, st(1, "terms", 1, { terms: TERMS, origin: "ours" }));
  });

  test("asking names the people whose say is needed", async (c) => {
    await refused(c, ...st(2, "ask", 1), /ask_names_people/);
    await run(c, st(2, "ask", 1, { required: `[{"memberId":"${DEVON}","name":"Devon"}]` }));
  });

  test("signed, submitted and the endings need evidence", async (c) => {
    for (const kind of ["signed", "submitted", "accepted", "rejected", "expired", "withdrawn"]) {
      await refused(c, ...st(3, kind, 1), /evidence/);
    }
  });

  test("anything but go ahead says why, and only household members answer", async (c) => {
    await refused(c, ...answer("stop", null, 50), /not_proceed_says_why/);
    await refused(c, ...answer("proceed", null, 51, "a5555555-0000-4000-8000-0000000000ff"), /member_on_journey/);
    await run(c, answer("proceed", null, 52));
  });

  test("two people recording the next step at once: one wins", async (c) => {
    await run(c, st(3, "prepared", 1));
    await refused(c, ...st(3, "withdrawn", 1, { note: "x" }, 60), /rift_bid_steps_seq/);
  });

  test("a document is kept only from the clean area, with its hash", async (c) => {
    const doc = (path: string, sha: string) => c.query(
      `insert into rift_documents (agent_id, journey_id, family, label, filename, kind, bytes, sha256, storage_path, actor_label)
       values ($1,$2,'counter','Seller counter','counter.pdf','pdf',1200,$3,$4,'Agent A')`, [A, J1, sha, path]);
    await refused(c, `insert into rift_documents (agent_id, journey_id, family, label, filename, kind, bytes, sha256, storage_path, actor_label)
       values ($1,$2,'counter','Seller counter','counter.pdf','pdf',1200,$3,'quarantine/x/y','Agent A')`, [A, J1, "a".repeat(64)], /storage_path/);
    await refused(c, `insert into rift_documents (agent_id, journey_id, family, label, filename, kind, bytes, sha256, storage_path, actor_label)
       values ($1,$2,'counter','Seller counter','counter.exe','exe',1200,$3,'clean/x/y','Agent A')`, [A, J1, "a".repeat(64)], /kind/);
    await doc(`clean/${A}/${J1}/1.pdf`, "b".repeat(64));
  });

  test("all of it is history", async (c) => {
    await refused(c, "update rift_bid_steps set note = 'edited' where bid_id = $1", [BID], /is history/);
    await refused(c, "update rift_bid_responses set instruction = 'stop' where bid_id = $1", [BID], /is history/);
    await refused(c, "update rift_bids set home_id = home_id where id = $1", [BID], /is history/);
    await refused(c, "update rift_documents set label = 'renamed' where journey_id = $1", [J1], /is history/);
  });

  test("an offer cannot point at a home on another journey", async (c) => {
    await refused(c, `insert into rift_bids (agent_id, journey_id, home_id, actor_label) values ($1,$2,$3,'A')`, [A, J2, H4], /home_on_journey/);
  });

  test("another agent sees none of it", async (c) => {
    for (const t of ["rift_bids", "rift_bid_steps", "rift_bid_responses", "rift_documents"]) {
      const mine = await as(c, A_USER, async () => (await c.query(`select count(*)::int n from ${t}`)).rows[0].n);
      const theirs = await as(c, B_USER, async () => (await c.query(`select count(*)::int n from ${t}`)).rows[0].n);
      expect(mine, t).toBeGreaterThan(0);
      expect(theirs, t).toBe(0);
    }
  });
});

describe("contract dates (W09; AT26, AT27 in the record)", () => {
  const T9 = "a9999999-0000-4000-8000-000000000009";
  const H9 = "a6666666-0000-4000-8000-000000000009";
  const D1 = "acccccc1-0000-4000-8000-000000000001";
  const D2 = "acccccc1-0000-4000-8000-000000000002";
  const rq = (n: number) => `acccccc1-1111-4000-8000-${String(n).padStart(12, "0")}`;
  const cols = "agent_id, journey_id, deadline_id, seq, state, due_date, due_time, timezone, due_at, rule, trigger_label, trigger_date, days, source_term, amendment, verified, note, actor_label, request_id";
  type R = { d?: string; seq: number; state?: string; date?: string; time?: string | null; at?: string | null; rule?: string; trig?: string | null; tdate?: string | null; days?: number | null; amend?: string | null; verified?: boolean; note?: string | null; n: number };
  const row = (r: R) => [A, J1, r.d ?? D1, r.seq, r.state ?? "active", r.date ?? "2026-10-03", r.time ?? null, "America/New_York", r.at ?? null,
    r.rule ?? "as-written", r.trig ?? null, r.tdate ?? null, r.days ?? null, "Paragraph 12", r.amend ?? null, r.verified ?? true, r.note ?? null, "Agent A", rq(r.n)];
  const ins = (...rs: R[]): [string, unknown[]] => {
    const vals = rs.map((_, i) => `(${Array.from({ length: 19 }, (_, k) => `$${i * 19 + k + 1}`).join(",")})`).join(",");
    return [`insert into rift_deadline_revisions (${cols}) values ${vals}`, rs.flatMap(row)];
  };
  const run = (c: Client, [sql, params]: [string, unknown[]]) => c.query(sql, params as never[]);

  test("fixtures", async (c) => {
    await c.query(`insert into rift_shortlist_homes (id, agent_id, journey_id, address, facts_source, facts_as_of, added_by_kind, added_by_label)
       values ($1,$2,$3,'9 Pine Rd, Tucker','Matrix listing','2026-09-21','agent','Agent A')`, [H9, A, J1]);
    await c.query(`insert into rift_transactions (id, agent_id, journey_id, home_id, financing, evidence, actor_label, request_id)
       values ($1,$2,$3,$4,'financed','Executed purchase agreement','Agent A',$5)`, [T9, A, J1, H9, rq(900)]);
    await c.query(`insert into rift_deadlines (id, agent_id, journey_id, transaction_id, label, kind, actor_label, request_id) values
       ($1,$3,$4,$5,'Due diligence ends','contractual','Agent A',$6), ($2,$3,$4,$5,'Closing','contractual','Agent A',$7)`, [D1, D2, A, J1, T9, rq(901), rq(902)]);
    await run(c, ins({ seq: 1, n: 1 }, { d: D2, seq: 1, date: "2026-10-30", n: 2 }));
  });

  test("a date without a time has no instant, and a time never comes without one (AT26)", async (c) => {
    await refused(c, ...ins({ seq: 2, at: "2026-10-03T04:00:00Z", n: 10 }), /time_is_whole/);
    await refused(c, ...ins({ seq: 2, time: "17:00", n: 11 }), /time_is_whole/);
  });

  test("a counted date says what it counted from; a written one does not", async (c) => {
    await refused(c, ...ins({ seq: 2, rule: "calendar-days-v1", n: 12 }), /counted_has_trigger/);
    await refused(c, ...ins({ seq: 2, trig: "Binding", tdate: "2026-09-23", days: 10, n: 13 }), /counted_has_trigger/);
    await refused(c, ...ins({ seq: 2, rule: "whatever-the-form-says", trig: "Binding", tdate: "2026-09-23", days: 10, n: 14 }), /rule/);
  });

  test("met or removed says how, and an amendment's dates were checked", async (c) => {
    await refused(c, ...ins({ seq: 2, state: "met", n: 15 }), /closing_says_how/);
    await refused(c, ...ins({ seq: 2, amend: "Amendment 1", verified: false, n: 16 }), /amendment_checked/);
  });

  test("an amendment lands whole or not at all (AT27)", async (c) => {
    /* The second row collides with a revision somebody else made: the first must not survive. */
    await c.query(`insert into rift_deadline_revisions (${cols}) values ${"(" + Array.from({ length: 19 }, (_, k) => `$${k + 1}`).join(",") + ")"}`, row({ d: D2, seq: 2, date: "2026-11-02", n: 20 }));
    await refused(c, ...ins({ seq: 2, date: "2026-10-06", amend: "Amendment 1", n: 21 }, { d: D2, seq: 2, date: "2026-11-06", amend: "Amendment 1", n: 22 }), /rift_deadline_revisions_seq/);
    const { rows } = await c.query("select count(*)::int n from rift_deadline_revisions where deadline_id = $1", [D1]);
    expect(rows[0].n).toBe(1);
    await run(c, ins({ seq: 2, date: "2026-10-06", amend: "Amendment 1", n: 23 }, { d: D2, seq: 3, date: "2026-11-06", amend: "Amendment 1", n: 24 }));
  });

  test("dates are history, and another agent sees none", async (c) => {
    await refused(c, "update rift_deadline_revisions set due_date = '2026-12-01' where deadline_id = $1", [D1], /is history/);
    await refused(c, "update rift_deadlines set label = 'x' where id = $1", [D1], /is history/);
    const theirs = await as(c, B_USER, async () => (await c.query("select count(*)::int n from rift_deadline_revisions")).rows[0].n);
    expect(theirs).toBe(0);
  });

  test("job runs are the server's alone", async (c) => {
    await c.query("insert into rift_job_runs (job, ok, finished_at) values ('nurture-run', true, now())");
    const n = await as(c, A_USER, async () => (await c.query("select count(*)::int n from rift_job_runs")).rows[0].n);
    expect(n).toBe(0);
    expect((await c.query("select count(*)::int n from rift_job_runs")).rows[0].n).toBeGreaterThan(0);
    await refused(c, "insert into rift_job_runs (job, ok) values ('mine-bitcoin', true)", [], /job/);
  });
});

describe("deletion (first-migration-proposal §deletion compatibility)", () => {
  test("removing the journeys first lets the relationship go, and takes everything under them", async (c) => {
    await c.query("begin");
    await c.query("delete from rift_journeys where origin_lead_id = $1 and agent_id = $2", [A_LEAD, A]);
    await c.query("delete from rift_leads where id = $1", [A_LEAD]);
    for (const t of ["rift_journey_members", "rift_search_revisions", "rift_search_packages", "rift_shortlist_homes", "rift_home_reactions", "rift_search_responses", "rift_tour_stops", "rift_tour_steps", "rift_tour_feedback",
      "rift_journey_events", "rift_transactions", "rift_transaction_outcomes", "rift_workstream_updates",
      "rift_bids", "rift_bid_steps", "rift_bid_responses", "rift_documents", "rift_deadlines", "rift_deadline_revisions"]) {
      const { rows } = await c.query(`select count(*)::int n from ${t} where agent_id = $1`, [A]);
      expect(rows[0].n, t).toBe(0);
    }
    await c.query("rollback");
  });
});
