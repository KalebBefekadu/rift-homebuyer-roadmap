import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * What the morning summary reports as buyer activity (W12, D07). Only what a
 * household member did: an answer the agent recorded for them is his own
 * work, and a showing request is reported once, not also as a reaction.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));
vi.mock("./deadlines", () => ({ datesNeedingAttention: async () => ({ ok: true, data: [{ journeyId: "j1", person: "Devon Drill", label: "Closing", when: "Oct 23", why: "soon", days: 2 }] }) }));
vi.mock("./jobs", () => ({ jobsHealth: async () => ({ ok: true, data: [{ problem: null }, { problem: "Follow-up emails failed." }] }) }));

const { summaryParts } = await import("./summary");

beforeEach(() => { vi.clearAllMocks(); });

const SINCE = new Date("2026-09-23T13:00:00Z");
const at = "2026-09-24T10:00:00Z";
const world: Answers = {
  "select rift_journeys": { data: [{ id: "j1", label: "First home", origin_lead_id: "l1" }], error: null },
  "select rift_leads": (c) => c.filters.some((f) => f.startsWith("in:id=")) ? { data: [{ id: "l1", name: "Devon Drill" }], error: null } : { data: [{ name: "Sam", side: "buy", band: "now" }], error: null },
  "select rift_journey_members": { data: [{ id: "m1", journey_id: "j1", display_name: "Devon", email: "d@example.com", accepted_at: "2026-09-01T00:00:00Z" }], error: null },
  "select rift_home_reactions": { data: [
    { journey_id: "j1", home_id: "h1", member_id: "m1", reaction: "interested", reason: null, created_at: at },
    { journey_id: "j1", home_id: "h1", member_id: "m1", reaction: "tour-requested", reason: null, created_at: at },
    { journey_id: "j1", home_id: "h1", member_id: null, reaction: "pass", reason: null, created_at: at },
  ], error: null },
  "select rift_shortlist_homes": (c) => c.filters.some((f) => f.startsWith("gte:")) ? { data: [], error: null } : { data: [{ id: "h1", address: "412 Maple Ridge Dr" }], error: null },
  "select rift_tour_stops": (c) => c.filters.some((f) => f.startsWith("gte:"))
    ? { data: [{ journey_id: "j1", home_id: "h1", requested_by_member: "m1", created_at: at }], error: null }
    : { data: [{ id: "s1", home_id: "h1" }], error: null },
  "select rift_bids": { data: [{ id: "b1", home_id: "h1" }], error: null },
  "select rift_bid_responses": { data: [
    { journey_id: "j1", bid_id: "b1", member_id: "m1", version: 2, instruction: "proceed", told_agent: null, created_at: at },
    { journey_id: "j1", bid_id: "b1", member_id: "m1", version: 2, instruction: "stop", told_agent: "Told Kaleb on the phone", created_at: at },
  ], error: null },
};

describe("the summary's buyer activity", () => {
  it("reports what members did, once each, and nothing the agent recorded for them", async () => {
    build(world);
    const r = await summaryParts(SINCE, new Date("2026-09-24T13:00:00Z"));
    expect(r.ok && "data" in r).toBe(true);
    if (!r.ok || !("data" in r)) return;
    expect(r.data.activity.map((a) => a.kind).sort()).toEqual(["offer-answer", "reaction", "tour-request"]);
    const offer = r.data.activity.find((a) => a.kind === "offer-answer");
    expect(offer).toMatchObject({ who: "Devon", person: "Devon Drill", home: "412 Maple Ridge Dr", instruction: "proceed" });
    expect(r.data.leads).toEqual([{ name: "Sam", side: "buy", band: "now" }]);
    expect(r.data.jobs).toEqual(["Follow-up emails failed."]);
    expect(r.data.dates).toHaveLength(1);
  });

  it("does not report an invitation accepted before the window", async () => {
    build(world);
    const r = await summaryParts(SINCE);
    expect(r.ok && "data" in r && r.data.activity.some((a) => a.kind === "joined")).toBe(false);
  });

  it("reads only this agent's rows, from the start of the window", async () => {
    build(world);
    await summaryParts(SINCE);
    for (const c of db.calls) expect(c.filters, `${c.table}`).toContain("eq:agent_id=agent-1");
    expect(db.to("select rift_home_reactions")[0]!.filters).toContain(`gte:created_at=${SINCE.toISOString()}`);
  });

  it("fails rather than sending an empty summary when a read fails", async () => {
    build({ ...world, "select rift_bid_responses": { error: { message: "connection reset" } } });
    const r = await summaryParts(SINCE);
    expect(r.ok).toBe(false);
  });
});
