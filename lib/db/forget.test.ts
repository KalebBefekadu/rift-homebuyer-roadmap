import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * "Delete all of it", against a real database.
 *
 * This suite exists because the button lied for the life of a migration.
 *
 * `forget()` was written when rift_leads.assessment_id cascaded on delete: it
 * removed the assessment and the lead went with it. 20260908000000 changed the
 * cascade to SET NULL: correctly, because the retention SWEEP was destroying
 * relationships the agent was still working, and updated the sweep to delete
 * leads explicitly. `forget()` shares the mechanism and was not updated, so
 * from that day a person who asked to be erased had their assessment removed
 * and their name, email, phone and consent record left in place, under a page
 * reading "Nothing about this visit is left on this device or on our side."
 *
 * Nothing threw. The endpoint returned `ok`. The docblock described the
 * behaviour the code had lost.
 *
 * So the first test here asserts the fact that made it possible: that a
 * deleted assessment leaves its lead behind: rather than trusting anyone to
 * remember it. If somebody restores the cascade, the sweep's bug comes back
 * and this fails. If somebody removes the explicit lead deletion, the erasure
 * bug comes back and the tests below fail.
 *
 * Skips when no Postgres is reachable. See lib/db/schema.test.ts.
 */

const URL_ = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:pw@localhost:55432/rift_test";
let db: Client | null = null;

function riftMigrations(): string[] {
  const dir = "supabase/migrations";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f.includes("_rift_"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

const AGENT = "aaaa1111-0000-4000-8000-000000000003";
const USER = "bbbb2222-0000-4000-8000-000000000003";

beforeAll(async () => {
  const c = new Client({ connectionString: URL_, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    await c.query(readFileSync("supabase/test/shim.sql", "utf8"));
    for (const f of riftMigrations()) await c.query(readFileSync(f, "utf8"));
    await c.query("insert into auth.users (id) values ($1) on conflict do nothing", [USER]);
    await c.query(
      "insert into rift_agents (id, auth_user_id, name, email) values ($1,$2,'Kaleb','k3@example.com')",
      [AGENT, USER]);
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

/** One visitor: an assessment, a lead, a consent record, an event, a touch. */
async function seed(c: Client, session: string, opts: { withAssessment: boolean }) {
  let assessmentId: string | null = null;
  if (opts.withAssessment) {
    const { rows: [a] } = await c.query(
      "insert into rift_assessments (agent_id, session_id, side, county) values ($1,$2,'buy','DeKalb') returning id",
      [AGENT, session]);
    assessmentId = a.id as string;
  }

  const { rows: [l] } = await c.query(
    `insert into rift_leads (agent_id, assessment_id, session_id, side, name, email, score, band)
     values ($1,$2,$3,'buy','A Person','person@example.com',70,'soon') returning id`,
    [AGENT, assessmentId, session]);

  await c.query(
    `insert into rift_consents (agent_id, assessment_id, session_id, kind, wording, version, granted)
     values ($1,$2,$3,'email','We email you your readout.','2026-09-01',true)`,
    [AGENT, assessmentId, session]);

  await c.query(
    "insert into rift_events (agent_id, session_id, name, side) values ($1,$2,'readout_view','buy')",
    [AGENT, session]);

  await c.query(
    "insert into rift_enrolments (agent_id, lead_id, band, phone_consent) values ($1,$2,'soon',false)",
    [AGENT, l.id]);

  return { assessmentId, leadId: l.id as string };
}

/** Exactly what lib/db/retention.ts forget() does, in the same order. */
async function forget(c: Client, session: string) {
  const { rows: aRows } = await c.query(
    "select id from rift_assessments where agent_id=$1 and session_id=$2", [AGENT, session]);
  const ids = aRows.map((r) => r.id as string);

  /* Leads first. After the assessments go, assessment_id is set to null and
     this join no longer exists. */
  const { rows: byA } = ids.length
    ? await c.query("select id from rift_leads where agent_id=$1 and assessment_id = any($2)", [AGENT, ids])
    : { rows: [] as { id: string }[] };
  const { rows: byS } = await c.query(
    "select id from rift_leads where agent_id=$1 and session_id=$2", [AGENT, session]);
  const leadIds = [...new Set([...byA, ...byS].map((r) => r.id as string))];

  if (leadIds.length) {
    /* Journeys first: origin_lead_id is RESTRICT, so the lead cannot go while one exists. */
    await c.query("delete from rift_journeys where agent_id=$1 and origin_lead_id = any($2)", [AGENT, leadIds]);
    await c.query("delete from rift_leads where id = any($1)", [leadIds]);
  }
  if (ids.length) await c.query("delete from rift_assessments where id = any($1)", [ids]);
  if (ids.length) {
    await c.query("delete from rift_consents where agent_id=$1 and assessment_id = any($2)", [AGENT, ids]);
  }
  await c.query("delete from rift_consents where agent_id=$1 and session_id=$2", [AGENT, session]);
  await c.query("delete from rift_events where agent_id=$1 and session_id=$2", [AGENT, session]);
  await c.query("delete from rift_attributions where session_id=$1", [session]);

  return ids.length + leadIds.length;
}

const count = async (c: Client, table: string, where: string, args: unknown[]) =>
  Number((await c.query(`select count(*)::int as n from ${table} where ${where}`, args)).rows[0].n);

describe("the fact the bug rested on", () => {
  test("deleting an assessment leaves its lead and its consent record behind", async (c) => {
    const { assessmentId, leadId } = await seed(c, "keep-1", { withAssessment: true });
    await c.query("delete from rift_assessments where id=$1", [assessmentId]);

    /* This is correct and deliberate: see 20260908000000. The retention sweep
       must not destroy a relationship just because the assessment aged out.
       It is also exactly why erasure has to delete the lead itself. */
    expect(await count(c, "rift_leads", "id=$1", [leadId])).toBe(1);
    const { rows } = await c.query("select assessment_id from rift_leads where id=$1", [leadId]);
    expect(rows[0].assessment_id).toBeNull();
    expect(await count(c, "rift_consents", "session_id=$1", ["keep-1"])).toBe(1);
  });
});

describe("erasure, from a readout", () => {
  test("removes the person, not just their answers", async (c) => {
    await seed(c, "gone-1", { withAssessment: true });
    const n = await forget(c, "gone-1");

    expect(n).toBeGreaterThan(0);
    expect(await count(c, "rift_assessments", "session_id=$1", ["gone-1"])).toBe(0);
    /* The four that used to survive. */
    expect(await count(c, "rift_leads", "session_id=$1", ["gone-1"])).toBe(0);
    expect(await count(c, "rift_consents", "session_id=$1", ["gone-1"])).toBe(0);
    expect(await count(c, "rift_events", "session_id=$1", ["gone-1"])).toBe(0);
  });

  test("stops the sequence by removing the lead it hangs off", async (c) => {
    const { leadId } = await seed(c, "gone-2", { withAssessment: true });
    expect(await count(c, "rift_enrolments", "lead_id=$1", [leadId])).toBe(1);

    await forget(c, "gone-2");

    /* Cascade, so a follow-up cannot outlive the person by being forgotten
       about in application code. */
    expect(await count(c, "rift_enrolments", "lead_id=$1", [leadId])).toBe(0);
  });

  test("reaches a lead that never had an assessment", async (c) => {
    /* The abroad readout and /book on a landing page both capture without
       one. Before rift_leads.session_id existed there was no column joining
       these rows to anything a delete request could key on, so erasure
       reported success and could not have found them. */
    const { leadId } = await seed(c, "gone-3", { withAssessment: false });
    expect(await count(c, "rift_leads", "id=$1", [leadId])).toBe(1);

    const n = await forget(c, "gone-3");

    expect(n).toBe(1);
    expect(await count(c, "rift_leads", "id=$1", [leadId])).toBe(0);
    expect(await count(c, "rift_consents", "session_id=$1", ["gone-3"])).toBe(0);
  });

  test("touches nobody else", async (c) => {
    const mine = await seed(c, "gone-4", { withAssessment: true });
    const theirs = await seed(c, "stays-4", { withAssessment: true });

    await forget(c, "gone-4");

    expect(await count(c, "rift_leads", "id=$1", [mine.leadId])).toBe(0);
    expect(await count(c, "rift_leads", "id=$1", [theirs.leadId])).toBe(1);
    expect(await count(c, "rift_consents", "session_id=$1", ["stays-4"])).toBe(1);
  });

  test("reaches a person with a buying journey, and everything under it", async (c) => {
    /* A journey refuses to let its lead be deleted, so an erasure that did
       not remove journeys first would fail on exactly the people the agent
       has started working with. */
    const { leadId } = await seed(c, "gone-6", { withAssessment: true });
    const { rows: [j] } = await c.query(
      "insert into rift_journeys (agent_id, origin_lead_id, side, label) values ($1,$2,'buy','First home') returning id",
      [AGENT, leadId]);
    await c.query(
      `insert into rift_search_revisions (agent_id, journey_id, revision, schema_version, criteria, author_kind, author_label)
       values ($1,$2,1,1,'[]','agent','Kaleb')`, [AGENT, j.id]);
    await c.query(
      `insert into rift_journey_members (agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
       values ($1,$2,'person@example.com','buyer','{search}',$3, now() + interval '1 day')`, [AGENT, j.id, "f".repeat(64)]);

    await forget(c, "gone-6");

    expect(await count(c, "rift_leads", "id=$1", [leadId])).toBe(0);
    expect(await count(c, "rift_journeys", "id=$1", [j.id])).toBe(0);
    expect(await count(c, "rift_search_revisions", "journey_id=$1", [j.id])).toBe(0);
    expect(await count(c, "rift_journey_members", "journey_id=$1", [j.id])).toBe(0);
  });

  test("counts the person, not only the paperwork", async (c) => {
    /* A session with a lead and no assessment used to return `deleted: 0`,
       which the route turns into "nothing was stored on our side to remove":
       said to somebody whose email address had just been found and deleted. */
    await seed(c, "gone-5", { withAssessment: false });
    expect(await forget(c, "gone-5")).toBe(1);
  });
});

describe("the erasure code still does all of that", () => {
  /* The tests above prove the SQL is right. This proves the module still
     issues it: the bug was never in a query, it was in a function that had
     quietly stopped containing one. */
  const src = readFileSync("lib/db/retention.ts", "utf8");
  const forgetBody = src.slice(src.indexOf("export async function forget"));

  it("deletes the lead", () => {
    expect(forgetBody).toContain('from("rift_leads").delete()');
  });

  it("deletes the consent record", () => {
    expect(forgetBody).toContain('from("rift_consents").delete()');
  });

  it("collects the leads before deleting the assessments", () => {
    const leadLookup = forgetBody.indexOf('from("rift_leads").select');
    const assessmentDelete = forgetBody.indexOf('from("rift_assessments").delete()');
    expect(leadLookup).toBeGreaterThan(-1);
    expect(assessmentDelete).toBeGreaterThan(-1);
    /* SET NULL severs the link. Deleting first makes the lead unfindable and
       the erasure silently partial: the exact shape of the original bug. */
    expect(leadLookup).toBeLessThan(assessmentDelete);
  });

  it("removes journeys before the lead they would otherwise hold in place", () => {
    const journeys = forgetBody.indexOf('from("rift_journeys").delete()');
    const leads = forgetBody.indexOf('from("rift_leads").delete()');
    expect(journeys).toBeGreaterThan(-1);
    expect(journeys).toBeLessThan(leads);
  });

  it("looks leads up by session as well as by assessment", () => {
    expect(forgetBody).toContain('.eq("session_id", sessionId)');
  });
});

describe("every capture surface hands over a session", () => {
  /* The erasure fix is worth exactly as much as this. A lead reaches
     rift_leads.session_id only if the page that captured it sent one, and a
     capture form added later that forgets is invisible: it stores the person
     perfectly and quietly makes them impossible to delete. Nothing about that
     looks wrong from any direction, which is why it is a test rather than a
     convention. */
  function tsxFiles(dir: string): string[] {
    let out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out = out.concat(tsxFiles(full));
      else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(full);
    }
    return out;
  }

  /* Both endpoints that turn a visitor into a lead. Save my plan was added
     with the values and makes a lead too, so it is held to the same rule. */
  const ENDPOINTS = ['"/api/capture"', '"/api/plan/save"'];
  const endpointIn = (src: string) => ENDPOINTS.find((e) => src.includes(e));
  const callers = ["app/(rift)", "components/rift"]
    .flatMap(tsxFiles)
    .filter((f) => endpointIn(readFileSync(f, "utf8")));

  it("finds the capture forms", () => {
    /* Four today: the buyer readout, /book, the abroad readout, and Save my
       plan. The seller readout went with the seller values. If this drops, a
       form was removed or renamed and the assertion below has stopped
       covering it. */
    expect(callers.length).toBeGreaterThanOrEqual(4);
  });

  it("sends sessionId from each of them", () => {
    const silent = callers.filter((f) => {
      const src = readFileSync(f, "utf8");
      const at = src.indexOf(endpointIn(src)!);
      /* The body follows the URL closely; a generous window rather than a
         parse, because the shape of these calls varies. */
      return !/sessionId:\s*sessionId\(\)/.test(src.slice(at, at + 1600));
    });
    expect(
      silent,
      "a lead captured without a session id cannot be found by \"delete all of it\"",
    ).toEqual([]);
  });
});

/* Blueprint v5 §5.5: a saved plan is opened from an email, usually on another
   device, where the browser session that saved it does not exist. */
describe("a saved plan can be deleted from any device", () => {
  const retention = readFileSync("lib/db/retention.ts", "utf8");
  const body = retention.slice(retention.indexOf("export async function forget"));

  it("finds the lead by the plan's link token", () => {
    expect(body).toMatch(/\.eq\("plan_token", opts\.planToken\)/);
    expect(body).toMatch(/\.\.\.planLeadIds\]/);
  });

  it("never runs a session-keyed delete without a session", () => {
    for (const table of ["rift_consents", "rift_events", "rift_attributions"]) {
      const at = body.indexOf(`db.from("${table}").delete().eq("agent_id", agent_id).eq("session_id"`) >= 0
        ? body.indexOf(`db.from("${table}").delete().eq("agent_id", agent_id).eq("session_id"`)
        : body.indexOf(`db.from("${table}").delete().eq("session_id"`);
      expect(at, table).toBeGreaterThan(-1);
      expect(body.slice(Math.max(0, at - 400), at), `${table} is behind hasSession`).toContain("if (hasSession)");
    }
  });

  it("is reachable: the route takes the token and the plan page sends it", () => {
    expect(readFileSync("app/api/forget/route.ts", "utf8")).toContain("planToken");
    expect(readFileSync("app/(rift)/saved/[token]/page.tsx", "utf8")).toMatch(/<ForgetMe[\s\S]*?planToken=\{token\}/);
  });

  it("is at the bottom of every answer, as /privacy promises, and resets the device", () => {
    expect(readFileSync("components/rift/value/AfterAnswer.tsx", "utf8")).toContain("<ForgetMe");
    const btn = readFileSync("components/rift/Forget.tsx", "utf8");
    expect(btn).toContain('"rift.answers.v1"');
    expect(btn).toContain('"rift.plan.v1"');
  });
});
