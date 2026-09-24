import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Starting a journey makes a lead a client, and a client does not receive the
 * lead cadence's marketing touches (AT37). The stop is recorded as
 * "converted", scoped to the agent, and a stop that misses does not undo the
 * journey: the nurture run skips anyone with a journey regardless.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
const capture = vi.fn();
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: (...a: unknown[]) => capture(...a) }));

const { createJourney } = await import("./journeys");

beforeEach(() => { vi.clearAllMocks(); });

const ok = {
  "select rift_leads": { data: { id: "l1" }, error: null },
  "insert rift_journeys": { data: { id: "j1" }, error: null },
};

describe("starting a journey", () => {
  it("stops the lead's follow-up sequence as 'they became a client'", async () => {
    build(ok);
    const r = await createJourney("l1", "buy", "Buying a first home");
    expect(r.ok && "data" in r && r.data.id).toBe("j1");

    const stop = db.to("update rift_enrolments")[0];
    expect(stop, "the sequence was not stopped").toBeTruthy();
    expect(stop!.payload).toMatchObject({ stop_reason: "converted" });
    expect(stop!.filters).toEqual(expect.arrayContaining(["eq:lead_id=l1", "eq:agent_id=agent-1", "is:stopped_at=null"]));
  });

  it("stops it only after the journey exists", async () => {
    build(ok);
    await createJourney("l1", "buy", "Buying a first home");
    const order = db.calls.map((c) => `${c.verb} ${c.table}`);
    expect(order.indexOf("update rift_enrolments")).toBeGreaterThan(order.indexOf("insert rift_journeys"));
  });

  it("keeps the journey when the stop fails, and reports the failure", async () => {
    build({ ...ok, "update rift_enrolments": { error: { message: "permission denied" } } });
    const r = await createJourney("l1", "buy", "Buying a first home");
    expect(r.ok).toBe(true);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("does not touch the sequence when the journey was not created", async () => {
    build({ ...ok, "insert rift_journeys": { error: { message: "duplicate" } } });
    const r = await createJourney("l1", "buy", "Buying a first home");
    expect(r.ok).toBe(false);
    expect(db.to("update rift_enrolments")).toHaveLength(0);
  });
});
