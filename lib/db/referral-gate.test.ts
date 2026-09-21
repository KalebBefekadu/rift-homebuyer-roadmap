import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The gate, at the layer that actually talks to the database.
 *
 * `lib/core/referral-moments.test.ts` proves the rule holds in the arithmetic.
 * This proves the arithmetic is what the database layer runs — that a mood
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
  client_token: "tok", figure_id: "fig", referred_by: null,
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe("nothing public before the private check", () => {
  it("does not treat an unanswered check as a good one", async () => {
    build({
      rift_leads: { data: [closedLead({ mood: null })] },
      rift_referral_moments: { data: [] },
    });
    const r = await momentsForLead("l1", NOW);
    const rel = ("data" in r ? r.data : null)!;
    const gated = rel!.statuses.filter((s) => s.moment.gated);
    expect(gated.length).toBeGreaterThan(0);
    for (const g of gated) {
      expect(g.needsCheck, `${g.moment.id} should be asking the private question`).toBe(true);
    }
  });

  it("holds every gated moment when the answer was not good", async () => {
    for (const mood of ["mixed", "bad"] as const) {
      build({
        rift_leads: { data: [closedLead({ mood })] },
        rift_referral_moments: { data: [] },
      });
      const r = await momentsForLead("l1", NOW);
      const rel = ("data" in r ? r.data : null)!;
      for (const g of rel!.statuses.filter((s) => s.moment.gated)) {
        expect(g.state, `${g.moment.id} with mood=${mood}`).toBe("held");
      }
    }
  });

  it("refuses to write anything the gate does not understand", async () => {
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
          closed_on: null, mood: null, client_token: null, figure_id: null, referred_by: null },
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
