import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";
import { MOMENTS } from "@/lib/core/referral";

/**
 * The gate, at the layer that actually talks to the database.
 *
 * `lib/core/referral-moments.test.ts` proves the rule holds in the arithmetic.
 * This proves the arithmetic is what the database layer runs: that a mood
 * column arriving as NULL, or missing entirely, does not quietly become
 * permission to ask somebody for a public review.
 *
 * The unasked case is the one worth the trouble. It is the most common state
 * in the table by a wide margin, and it is the one a truthy check gets wrong.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { momentsForLead, referralQueue, recordMood, recordMoment, LIFECYCLE_COLUMNS } =
  await import("./referral");

const NOW = new Date("2026-09-21T12:00:00Z");

/** Closed long enough ago that every post-closing moment has triggered. */
const closedLead = (over: Record<string, unknown> = {}) => ({
  id: "l1", name: "A Client", email: "a@example.com", side: "buy",
  stage: "Closed", closed_on: "2024-01-01", mood: null,
  client_token: "tok", assessment_id: "assess-1", referred_by: null,
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe("the private check decides follow-ups, not reviews (decision D12)", () => {
  it("reads the same moments from the database whatever the answer was", async () => {
    const seen: string[] = [];
    for (const mood of [null, "good", "mixed", "bad"] as const) {
      build({
        rift_leads: { data: [closedLead({ mood })] },
        rift_referral_moments: { data: [] },
      });
      const r = await momentsForLead("l1", NOW);
      const rel = ("data" in r ? r.data : null)!;
      const review = rel!.statuses.filter((s) => s.moment.review);
      expect(review.length).toBeGreaterThan(0);
      seen.push(JSON.stringify(rel!.statuses.map((s) => [s.moment.id, s.state, s.blockedBecause])));
    }
    expect(new Set(seen).size).toBe(1);
  });

  it("keeps somebody owed a follow-up in the queue with nothing else due", async () => {
    const decided = MOMENTS.map((m) => ({ lead_id: "l1", moment_id: m.id, occurrence: m.id === "anniversary" ? 2 : 0, state: "acted" }));
    build({
      rift_leads: { data: [closedLead({ mood: "bad" })] },
      rift_referral_moments: { data: decided },
    });
    const r = await referralQueue(NOW);
    const people = ("data" in r ? r.data : null)!;
    expect(people.map((p) => p.leadId)).toContain("l1");
  });

  it("refuses to write anything the check does not understand", async () => {
    build({ rift_leads: { data: [closedLead()] } });
    const r = await recordMood("l1", "fine" as never);
    expect(r.ok).toBe(false);
    /* And it must not have reached the database to find that out. */
    expect(db.calls.filter((c) => c.verb === "update")).toHaveLength(0);
  });

  it("clears the date when the check is un-asked, rather than leaving a stale one", async () => {
    build({ rift_leads: { data: [closedLead()] } });
    await recordMood("l1", null);
    const write = db.calls.find((c) => c.verb === "update")!;
    expect((write.payload as Record<string, unknown>).mood).toBeNull();
    expect((write.payload as Record<string, unknown>).mood_at).toBeNull();
  });
});

describe("what the read asks for", () => {
  it("does not select everything from a lead row", () => {
    expect(LIFECYCLE_COLUMNS).not.toBe("*");
  });

  it("scopes every read to the signed-in agent", async () => {
    build({ rift_leads: { data: [closedLead()] }, rift_referral_moments: { data: [] } });
    await momentsForLead("l1", NOW);
    const read = db.calls.find((c) => c.table === "rift_leads")!;
    expect(read.filters).toContain("eq:agent_id=agent-1");
  });

  it("returns nothing at all rather than guessing when there is no database", async () => {
    db = null as unknown as Fake;
    const r = await momentsForLead("l1", NOW);
    expect("skipped" in r || !r.ok).toBe(true);
  });
});

describe("the queue", () => {
  it("leaves out relationships with nothing to decide", async () => {
    build({
      rift_leads: { data: [
        closedLead({ id: "l1", mood: "good" }),
        /* Brand new: no readout, no plan, not closed. Nothing is due. */
        { id: "l2", name: "New", email: null, side: "buy", stage: "Exploring",
          closed_on: null, mood: null, client_token: null, assessment_id: null, referred_by: null },
      ] },
      rift_referral_moments: { data: [] },
    });
    const r = await referralQueue(NOW);
    const list = ("data" in r ? r.data : [])!;
    expect(list.map((x) => x.leadId)).toEqual(["l1"]);
  });

  it("excludes people who have been archived", async () => {
    build({ rift_leads: { data: [closedLead({ mood: "good" })] }, rift_referral_moments: { data: [] } });
    await referralQueue(NOW);
    const read = db.calls.find((c) => c.table === "rift_leads")!;
    expect(read.filters.some((f) => f.includes("archived_at"))).toBe(true);
  });
});

describe("recording a decision", () => {
  it("upserts on the moment and its occurrence, so a retry cannot double-record", async () => {
    build({ rift_referral_moments: { data: [] } });
    await recordMoment({ leadId: "l1", momentId: "anniversary", occurrence: 2, state: "sent" });
    const write = db.calls.find((c) => c.verb === "upsert")!;
    expect(write.options).toMatchObject({ onConflict: "lead_id,moment_id,occurrence" });
    expect(write.payload).toMatchObject({ moment_id: "anniversary", occurrence: 2, state: "sent" });
  });

  it("refuses a moment or a state the model does not define, without asking the database", async () => {
    build({ rift_referral_moments: { data: [] } });
    expect((await recordMoment({ leadId: "l1", momentId: "made_up" as never, occurrence: 0, state: "sent" })).ok).toBe(false);
    expect((await recordMoment({ leadId: "l1", momentId: "day_30", occurrence: 0, state: "vibes" as never })).ok).toBe(false);
    expect((await recordMoment({ leadId: "l1", momentId: "day_30", occurrence: -1, state: "sent" })).ok).toBe(false);
    expect(db.calls.filter((c) => c.verb === "upsert")).toHaveLength(0);
  });
});
