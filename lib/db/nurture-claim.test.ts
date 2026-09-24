import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Claiming a step before sending it.
 *
 * This is the only thing standing between a retry and a second email to the
 * same person. The ordering is deliberate and stated in the route: claim,
 * then send, then record the outcome. A crash between sending and recording
 * would otherwise resend on the next run, and the person on the other end has
 * no way to tell a bug from a company that does not pay attention.
 *
 * The constraint that makes it work is asserted against real Postgres in
 * schema.test.ts. What is asserted here is that the code reads it correctly:
 * a unique violation is the constraint working, not an incident.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { claimStep, markTouch } = await import("./nurture");

beforeEach(() => { vi.clearAllMocks(); });

describe("claiming a step", () => {
  it("writes the claim before anything is sent", async () => {
    build();
    const r = await claimStep("e1", "s1", "email", null);

    expect(r.ok && "data" in r && r.data.claimed).toBe(true);
    const claim = db.to("insert rift_touches")[0];
    expect(claim, "nothing was written to claim the step").toBeTruthy();
    expect(claim!.payload).toMatchObject({ enrolment_id: "e1", step_id: "s1", channel: "email" });
  });

  it("treats a unique violation as somebody else having it, not as a failure", async () => {
    /* 23505 is the constraint doing its job. Reporting it as an error would
       make a second cron worker look like an incident every single night. */
    build({ "insert rift_touches": { error: { message: "duplicate key value", code: "23505" } } });

    const r = await claimStep("e1", "s1", "email", null);
    expect(r.ok, "a duplicate claim was reported as a failure").toBe(true);
    expect(r.ok && "data" in r && r.data.claimed).toBe(false);
  });

  it("reports any other database error as a failure rather than a skipped step", async () => {
    /* The dangerous confusion runs the other way: a permission error read as
       "already claimed" means the step is never sent and never reported. */
    build({ "insert rift_touches": { error: { message: "permission denied", code: "42501" } } });

    const r = await claimStep("e1", "s1", "email", null);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("permission denied");
  });

  it("records why a channel was downgraded, on the row rather than in a log", async () => {
    /* A text step sent as an email without saying why is a cadence nobody can
       explain afterwards. */
    build();
    await claimStep("e1", "s1", "email", "no phone consent");
    expect(db.to("insert rift_touches")[0]!.payload)
      .toMatchObject({ downgraded_reason: "no phone consent" });
  });

  it("claims it as sent, so a crash before the outcome is recorded does not resend", async () => {
    /* The row exists the moment the claim succeeds. If it were written as
       "pending" and only became "sent" afterwards, a crash in between would
       leave a row the next run could reasonably re-claim. */
    build();
    await claimStep("e1", "s1", "email", null);
    expect(db.to("insert rift_touches")[0]!.payload).toMatchObject({ outcome: "sent" });
  });
});

describe("recording what happened", () => {
  it("updates the claim rather than writing a second row", async () => {
    /* A second row would violate the unique constraint and be indistinguishable
       from a duplicate claim. */
    build();
    await markTouch("e1", "s1", "failed", "mailbox full");

    expect(db.to("insert rift_touches")).toHaveLength(0);
    const up = db.to("update rift_touches")[0];
    expect(up!.payload).toMatchObject({ outcome: "failed", detail: "mailbox full" });
    expect(up!.filters).toContain("eq:enrolment_id=e1");
    expect(up!.filters).toContain("eq:step_id=s1");
  });

  it("keeps a skip and a failure apart, with the reason attached", async () => {
    /* "Email is switched off" and "this person has no readout to talk about"
       need different fixes and must not collapse into one word in the table. */
    build();
    await markTouch("e1", "s1", "skipped", "email is not configured");
    expect(db.to("update rift_touches")[0]!.payload)
      .toMatchObject({ outcome: "skipped", detail: "email is not configured" });
  });

  it("writes an explicit null rather than leaving a stale detail behind", async () => {
    build();
    await markTouch("e1", "s1", "sent");
    expect(db.to("update rift_touches")[0]!.payload).toMatchObject({ detail: null });
  });
});

describe("rechecking just before the send (AT37)", async () => {
  const { stillOwed, due } = await import("./nurture");
  const touch = { enrolmentId: "e1", leadId: "l1", email: "Sam@Example.com" };
  const live = { data: { stopped_at: null, stop_reason: null, rift_leads: { email: "sam@example.com " } }, error: null };

  it("sends when nothing changed, whatever the address's case or spacing", async () => {
    build({ "select rift_enrolments": live, "select rift_journeys": { data: [], error: null } });
    const r = await stillOwed(touch);
    expect(r.ok && "data" in r && r.data).toEqual({ owed: true });
  });

  it("does not send once the sequence was stopped, and says why", async () => {
    build({ "select rift_enrolments": { data: { stopped_at: "2026-09-24T10:00:00Z", stop_reason: "replied", rift_leads: { email: "sam@example.com" } }, error: null } });
    const r = await stillOwed(touch);
    expect(r.ok && "data" in r && r.data).toEqual({ owed: false, why: "the sequence was stopped (replied)" });
  });

  it("does not send to an address that has since changed, or to a lead that was deleted", async () => {
    build({ "select rift_enrolments": { data: { stopped_at: null, stop_reason: null, rift_leads: { email: "new@example.com" } }, error: null } });
    const changed = await stillOwed(touch);
    expect(changed.ok && "data" in changed && changed.data.owed).toBe(false);

    build({ "select rift_enrolments": { data: null, error: null } });
    const gone = await stillOwed(touch);
    expect(gone.ok && "data" in gone && gone.data).toEqual({ owed: false, why: "the sequence no longer exists" });
  });

  it("does not send marketing to somebody who is now a client with a journey", async () => {
    build({ "select rift_enrolments": live, "select rift_journeys": { data: [{ id: "j1" }], error: null } });
    const r = await stillOwed(touch);
    expect(r.ok && "data" in r && r.data).toEqual({ owed: false, why: "they are now a client with a journey" });
    expect(db.to("select rift_journeys")[0]!.filters).toContain("eq:origin_lead_id=l1");
  });

  it("reports a recheck it could not read as a failure, so nothing is sent on a guess", async () => {
    build({ "select rift_enrolments": { error: { message: "connection reset" } } });
    const r = await stillOwed(touch);
    expect(r.ok).toBe(false);
  });

  it("leaves anyone with a journey out of the queue", async () => {
    const enrolment = (id: string, lead: string) => ({
      id, lead_id: lead, band: "now", entered_at: "2026-09-01T00:00:00Z", phone_consent: false,
      rift_leads: { name: lead, email: `${lead}@example.com`, assessment_id: null, side: "buy" }, rift_touches: [],
    });
    build({
      "select rift_enrolments": { data: [enrolment("e1", "client"), enrolment("e2", "lead")], error: null },
      "select rift_journeys": { data: [{ origin_lead_id: "client" }], error: null },
    });
    const q = await due(new Date("2026-09-24T12:00:00Z"));
    expect(q.ok && "data" in q && q.data.map((t) => t.leadId)).toEqual(["lead"]);
    expect(db.to("select rift_journeys")[0]!.filters).toContain("eq:agent_id=agent-1");
  });

  it("still runs before the journeys migration, with nobody treated as a client", async () => {
    build({
      "select rift_enrolments": { data: [], error: null },
      "select rift_journeys": { error: { message: 'relation "public.rift_journeys" does not exist' } },
    });
    const q = await due(new Date());
    expect(q.ok).toBe(true);
  });
});
