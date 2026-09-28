import { describe, it, expect, vi } from "vitest";
import { fakeDb, type Fake } from "./test/fake-db";

/**
 * A closing recorded on the journey starts the Advocacy moments, by setting
 * the person's closing date, which nothing wrote after the old form went.
 */

let db: Fake;
vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));

const { closedByContract } = await import("./referral");

describe("a contract recorded closed", () => {
  it("sets the person's closing date to Georgia's day, only where none is recorded", async () => {
    db = fakeDb({ "select rift_journeys": { data: { origin_lead_id: "l1" }, error: null } });
    const r = await closedByContract("j1", "agent-1");
    expect(r.ok).toBe(true);
    const w = db.to("update rift_leads")[0]!;
    expect(w.payload).toEqual({ closed_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(w.filters).toEqual(expect.arrayContaining(["eq:id=l1", "eq:agent_id=agent-1", "is:closed_on=null"]));
  });

  it("writes nothing for a journey without a person, and returns a failed read", async () => {
    db = fakeDb({ "select rift_journeys": { data: { origin_lead_id: null }, error: null } });
    await closedByContract("j1", "agent-1");
    expect(db.to("update rift_leads")).toHaveLength(0);

    db = fakeDb({ "select rift_journeys": { data: null, error: { message: "timeout" } } });
    expect((await closedByContract("j1", "agent-1")).ok).toBe(false);
  });
});
