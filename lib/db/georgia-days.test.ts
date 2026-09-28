import { describe, it, expect, vi } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * A moment stored as a timestamp is shown as the day it was in Georgia
 * (DATE-01), not the day in London.
 *
 * These were read by slicing the ISO string, so a plan saved at half past
 * nine in the evening in Atlanta said it was saved the next day, in the
 * search brief it started and on the agent's money page.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { readoutStart } = await import("./search");

/* 21:30 on 28 September in Atlanta; already the 29th in UTC. */
const EVENING = "2026-09-29T01:30:00Z";

describe("a saved plan's day", () => {
  it("is the day it was saved in Georgia", async () => {
    build({
      "select rift_leads": { data: [{ assessment_id: null, side: "buy", plan: { answers: { price: 300_000, county: "Fulton" } }, plan_saved_at: EVENING }] },
    });
    const r = await readoutStart("lead-1");
    expect(r.ok && "data" in r && r.data?.from).toBe("saved plan of 2026-09-28");
    expect(r.ok && "data" in r && r.data?.criteria[0]?.statedAt).toBe("2026-09-28");
  });
});
