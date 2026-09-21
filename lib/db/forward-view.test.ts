import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The two reads behind the forward view.
 *
 * `lib/core/pipeline.ts` had a complete, tested forecast that nothing outside
 * the prototype rendered, and the prototype fed it forty-one invented closings.
 * These are the queries that replace the fixture with the agent's own record,
 * so what matters here is what they must never do: read somebody else's book,
 * count a terminal stage as evidence, or turn "nobody has priced this" into a
 * deal worth zero dollars.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { finishedRelationships, liveRelationships } = await import("./clients");

beforeEach(() => { vi.clearAllMocks(); });

describe("scoping", () => {
  it("never reads another agent's closed history", async () => {
    build({ "select rift_leads": { data: [] } });
    await finishedRelationships();
    expect(db.calls[0]!.filters).toContain("eq:agent_id=agent-1");
  });

  it("never reads another agent's live relationships", async () => {
    build({ "select rift_leads": { data: [] } });
    await liveRelationships();
    expect(db.calls[0]!.filters).toContain("eq:agent_id=agent-1");
  });

  it("scopes the stage-history read as well as the lead read", async () => {
    /* The second query takes a list of ids from the first. Scoping only the
       first would still be wrong: an id from anywhere would return its notes. */
    build({
      "select rift_leads": { data: [{ id: "l1", stage: "Closed" }] },
      "select rift_lead_notes": { data: [] },
    });
    await finishedRelationships();
    const notes = db.to("select rift_lead_notes")[0]!;
    expect(notes.filters).toContain("eq:agent_id=agent-1");
  });
});

describe("finishedRelationships", () => {
  it("asks only for the terminal stages", async () => {
    build({ "select rift_leads": { data: [] } });
    await finishedRelationships();
    const f = db.calls[0]!.filters.join(" ");
    expect(f).toMatch(/in:stage=/);
    expect(f).toContain("Closed");
    expect(f).toContain("Lost");
  });

  it("does not ask for stage history when nobody has finished", async () => {
    /* A new book of business should cost one query, not two. */
    build({ "select rift_leads": { data: [] } });
    const r = await finishedRelationships();
    expect(r.ok && "data" in r && r.data).toEqual([]);
    expect(db.to("select rift_lead_notes")).toHaveLength(0);
  });

  it("reads the whole stage history in one query, not one per person", async () => {
    build({
      "select rift_leads": {
        data: Array.from({ length: 30 }, (_, i) => ({ id: `l${i}`, stage: "Closed" })),
      },
      "select rift_lead_notes": { data: [] },
    });
    await finishedRelationships();
    expect(db.to("select rift_lead_notes")).toHaveLength(1);
  });

  it("builds the stage history from both ends of every move", async () => {
    build({
      "select rift_leads": { data: [{ id: "l1", stage: "Closed" }] },
      "select rift_lead_notes": {
        data: [
          { lead_id: "l1", from_stage: "Exploring", to_stage: "Searching" },
          { lead_id: "l1", from_stage: "Searching", to_stage: "Under contract" },
        ],
      },
    });
    const r = await finishedRelationships();
    const [one] = r.ok && "data" in r ? r.data : [];
    expect(one.final).toBe("Closed");
    expect(new Set(one.through)).toEqual(new Set(["Exploring", "Searching", "Under contract"]));
  });

  it("reads only stage notes, not every note ever written", async () => {
    build({
      "select rift_leads": { data: [{ id: "l1", stage: "Closed" }] },
      "select rift_lead_notes": { data: [] },
    });
    await finishedRelationships();
    expect(db.to("select rift_lead_notes")[0]!.filters).toContain("eq:kind=stage");
  });

  it("keeps a relationship whose history could not be read", async () => {
    /* Somebody added straight into Under contract and closed a fortnight later
       has no recorded moves. Dropping them would quietly bias the forecast
       toward people who took the long route through the funnel. */
    build({
      "select rift_leads": { data: [{ id: "l1", stage: "Closed" }] },
      "select rift_lead_notes": { error: { message: "timeout" } },
    });
    const r = await finishedRelationships();
    expect(r.ok && "data" in r && r.data).toEqual([{ final: "Closed", through: ["Closed"] }]);
  });

  it("reports a failed lead read rather than an empty history", async () => {
    /* [] means "every stage is an assumption", which is a true statement about
       a new agent and a false one about a broken query. */
    build({ "select rift_leads": { error: { message: "nope" } } });
    const r = await finishedRelationships();
    expect(r.ok).toBe(false);
  });
});

describe("liveRelationships", () => {
  it("excludes the terminal stages and the archived", async () => {
    build({ "select rift_leads": { data: [] } });
    await liveRelationships();
    const f = db.calls[0]!.filters.join(" ");
    expect(f).toMatch(/is:archived_at=null/);
    expect(f).toMatch(/not.*stage/);
    expect(f).toContain("Closed");
  });

  it("marks a priced deal as known", async () => {
    build({
      "select rift_leads": {
        data: [{ name: "Maya", stage: "Searching", lead_input: { value: 340_000 } }],
      },
    });
    const r = await liveRelationships();
    expect(r.ok && "data" in r && r.data[0]).toEqual({
      name: "Maya", stage: "Searching", value: 340_000, valueKnown: true,
    });
  });

  it("does not turn a missing price into a deal worth nothing", async () => {
    /* `Number(null)` is 0, and a $0 deal sums identically to an unpriced one.
       The distinction is the only thing that lets the screen say how many
       relationships are missing from the money rather than from the count. */
    for (const value of [null, undefined, "340000", NaN, 0, -5]) {
      build({
        "select rift_leads": { data: [{ name: "X", stage: "Searching", lead_input: { value } }] },
      });
      const r = await liveRelationships();
      const row = r.ok && "data" in r ? r.data[0] : null;
      expect(row?.valueKnown, `value ${String(value)}`).toBe(false);
      expect(row?.value).toBe(0);
    }
  });

  it("survives a lead_input that is null rather than an object", async () => {
    build({
      "select rift_leads": { data: [{ name: "X", stage: "Searching", lead_input: null }] },
    });
    const r = await liveRelationships();
    expect(r.ok && "data" in r && r.data[0]!.valueKnown).toBe(false);
  });

  it("names somebody with no name rather than rendering a blank row", async () => {
    build({
      "select rift_leads": { data: [{ name: null, stage: "Searching", lead_input: {} }] },
    });
    const r = await liveRelationships();
    expect(r.ok && "data" in r && r.data[0]!.name).toBe("Unnamed");
  });
});

describe("with no database", () => {
  it("both skip rather than claim an empty pipeline", async () => {
    vi.resetModules();
    vi.doMock("./service", () => ({ serviceClient: () => null, currentAgentId: async () => null }));
    const mod = await import("./clients");
    for (const r of [await mod.finishedRelationships(), await mod.liveRelationships()]) {
      expect(r.ok).toBe(true);
      expect("skipped" in r).toBe(true);
    }
    vi.doUnmock("./service");
    vi.resetModules();
  });
});
