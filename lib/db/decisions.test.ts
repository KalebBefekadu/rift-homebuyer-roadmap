import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Decision Rooms at the data layer.
 *
 * The property that matters most is the one about the CLIENT read: a room the
 * agent is half way through assembling must never be fetched by the query that
 * feeds their page. Filtering after the fetch would work today and stop
 * working the first time somebody refactors the component, which is precisely
 * the shape of every silent failure this product has had.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const {
  decisionsFor, releasedFor, createDecision, addOption,
  release, recordOutcome, clearOutcome,
} = await import("./decisions");

const room = (over: Record<string, unknown> = {}) => ({
  id: "d1", kind: "offers", question: "Which offer?", context: null,
  decide_by: null, released_at: null, decided_at: null,
  chosen_option_id: null, outcome_note: null, ...over,
});

const option = (over: Record<string, unknown> = {}) => ({
  decision_id: "d1", id: "o1", label: "A", detail: null,
  amount_cents: null, amount_label: null, upside: null, downside: null, sort: 0, ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe("the client's read", () => {
  it("asks the database for released rooms only", async () => {
    /* In the QUERY, not in the component. A draft is never fetched, so there
       is no later filter that can fail to be applied. */
    build({ "select rift_decisions": { data: [] } });
    await releasedFor("lead-1", "agent-1");
    expect(db.calls[0]!.filters.join(" ")).toMatch(/not.*released_at.*null/);
  });

  it("is scoped to the lead and the agent", async () => {
    build({ "select rift_decisions": { data: [] } });
    await releasedFor("lead-1", "agent-1");
    const f = db.calls[0]!.filters;
    expect(f).toContain("eq:lead_id=lead-1");
    expect(f).toContain("eq:agent_id=agent-1");
  });

  it("does not ask for options when there are no rooms", async () => {
    build({ "select rift_decisions": { data: [] } });
    await releasedFor("lead-1", "agent-1");
    expect(db.to("select rift_decision_options")).toHaveLength(0);
  });

  it("reads every room's options in one query", async () => {
    build({
      "select rift_decisions": { data: [room({ id: "d1" }), room({ id: "d2" })] },
      "select rift_decision_options": { data: [] },
    });
    await releasedFor("lead-1", "agent-1");
    expect(db.to("select rift_decision_options")).toHaveLength(1);
  });

  it("attaches each option to its own room", async () => {
    build({
      "select rift_decisions": { data: [room({ id: "d1" }), room({ id: "d2" })] },
      "select rift_decision_options": { data: [
        option({ decision_id: "d1", id: "a" }),
        option({ decision_id: "d2", id: "b" }),
        option({ decision_id: "d1", id: "c" }),
      ] },
    });
    const r = await releasedFor("lead-1", "agent-1");
    const rooms = r.ok && "data" in r ? r.data : [];
    expect(rooms.find((d) => d.id === "d1")!.options.map((o) => o.id)).toEqual(["a", "c"]);
    expect(rooms.find((d) => d.id === "d2")!.options.map((o) => o.id)).toEqual(["b"]);
  });

  it("renders a room whose options could not be read, rather than nothing", async () => {
    build({
      "select rift_decisions": { data: [room()] },
      "select rift_decision_options": { error: { message: "timeout" } },
    });
    const r = await releasedFor("lead-1", "agent-1");
    expect(r.ok && "data" in r && r.data[0]!.options).toEqual([]);
  });
});

describe("the agent's read", () => {
  it("does not filter on released, because drafts are his to see", async () => {
    build({ "select rift_decisions": { data: [] } });
    await decisionsFor("lead-1");
    /* The column is selected — he needs to know which rooms are out. What
       must not be here is a FILTER on it. Asserting on the whole string
       matched the select list and failed for the wrong reason. */
    const filters = db.calls[0]!.filters.filter((f) => !f.startsWith("select:"));
    expect(filters.join(" ")).not.toMatch(/released_at/);
    expect(db.calls[0]!.filters.join(" ")).toContain("released_at");
  });
});

describe("amounts", () => {
  it("reads a bigint that arrived as a string", async () => {
    /* PostgREST returns bigint as a string often enough that coercing at four
       call sites instead of one is the difference between arithmetic and
       string concatenation. */
    build({
      "select rift_decisions": { data: [room()] },
      "select rift_decision_options": { data: [option({ amount_cents: "41230000", amount_label: "net" })] },
    });
    const r = await decisionsFor("lead-1");
    expect(r.ok && "data" in r && r.data[0]!.options[0]!.amountCents).toBe(41_230_000);
  });

  it("keeps a missing amount as null rather than zero", async () => {
    /* Number(null) is 0, and "this option has no figure" is not "this option
       is free". */
    build({
      "select rift_decisions": { data: [room()] },
      "select rift_decision_options": { data: [option({ amount_cents: null })] },
    });
    const r = await decisionsFor("lead-1");
    expect(r.ok && "data" in r && r.data[0]!.options[0]!.amountCents).toBeNull();
  });
});

describe("addOption", () => {
  it("refuses a figure with nothing saying what it is", async () => {
    /* A bare number in a comparison column is the reader's guess about what
       they are comparing. Refused here so the caller gets the sentence rather
       than a Postgres constraint name. */
    build();
    const r = await addOption({ decisionId: "d1", label: "A", amountCents: 100 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/say what it is/);
    expect(db.to("insert rift_decision_options")).toHaveLength(0);
  });

  it("accepts a label with no figure", async () => {
    build({
      "select rift_decision_options": { data: null },
      "insert rift_decision_options": { data: { id: "o9" } },
    });
    expect((await addOption({ decisionId: "d1", label: "Sell first" })).ok).toBe(true);
  });

  it("appends after the highest sort rather than counting rows", async () => {
    /* A deleted option leaves a gap. Counting would reuse a sort value and
       make the displayed order depend on insertion time. */
    build({
      "select rift_decision_options": { data: { sort: 7 } },
      "insert rift_decision_options": { data: { id: "o9" } },
    });
    await addOption({ decisionId: "d1", label: "C" });
    const payload = db.to("insert rift_decision_options")[0]!.payload as Record<string, unknown>;
    expect(payload.sort).toBe(8);
  });

  it("starts at zero for the first option", async () => {
    build({
      "select rift_decision_options": { data: null },
      "insert rift_decision_options": { data: { id: "o9" } },
    });
    await addOption({ decisionId: "d1", label: "A" });
    expect((db.to("insert rift_decision_options")[0]!.payload as Record<string, unknown>).sort).toBe(0);
  });

  it("refuses an empty label", async () => {
    build();
    expect((await addOption({ decisionId: "d1", label: "   " })).ok).toBe(false);
  });
});

describe("release", () => {
  it("refuses a room with one option and says why", async () => {
    /* Re-checked against the STORED room. A check the caller can skip by
       posting different data is not a check. */
    build({
      "select rift_decisions": { data: { id: "d1", question: "Which?" } },
      "select rift_decision_options": { data: [option()] },
    });
    const r = await release("d1");
    expect(r.ok && "data" in r && r.data.blocks.length).toBeGreaterThan(0);
    expect(db.to("update rift_decisions")).toHaveLength(0);
  });

  it("releases a room that passes", async () => {
    build({
      "select rift_decisions": { data: { id: "d1", question: "Which?" } },
      "select rift_decision_options": { data: [option({ id: "a" }), option({ id: "b", label: "B" })] },
      "update rift_decisions": { data: {} },
    });
    const r = await release("d1");
    expect(r.ok && "data" in r && r.data.blocks).toEqual([]);
    const patch = db.to("update rift_decisions")[0]!.payload as Record<string, unknown>;
    expect(patch.released_at).toBeTruthy();
  });

  it("carries the warnings through on a room that passes", async () => {
    build({
      "select rift_decisions": { data: { id: "d1", question: "Which?" } },
      "select rift_decision_options": { data: [
        option({ id: "a", upside: "Fast" }),
        option({ id: "b", label: "B", upside: "More", downside: "Slow" }),
      ] },
      "update rift_decisions": { data: {} },
    });
    const r = await release("d1");
    expect(r.ok && "data" in r && r.data.warns.length).toBeGreaterThan(0);
  });

  it("fails on a room that is not this agent's", async () => {
    build({ "select rift_decisions": { data: null } });
    expect((await release("d1")).ok).toBe(false);
  });
});

describe("recordOutcome", () => {
  it("refuses an option belonging to another room", async () => {
    /* A decision recorded against an option from a different room renders as
       a perfectly ordinary outcome naming something the reader cannot see. */
    build({ "select rift_decision_options": { data: null } });
    const r = await recordOutcome({ decisionId: "d1", optionId: "elsewhere" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/not part of this decision/);
    expect(db.to("update rift_decisions")).toHaveLength(0);
  });

  it("checks the option against both the room and the agent", async () => {
    build({ "select rift_decision_options": { data: { id: "o1" } }, "update rift_decisions": { data: {} } });
    await recordOutcome({ decisionId: "d1", optionId: "o1" });
    const f = db.to("select rift_decision_options")[0]!.filters;
    expect(f).toContain("eq:decision_id=d1");
    expect(f).toContain("eq:agent_id=agent-1");
  });

  it("writes the option and the time together", async () => {
    build({ "select rift_decision_options": { data: { id: "o1" } }, "update rift_decisions": { data: {} } });
    await recordOutcome({ decisionId: "d1", optionId: "o1", note: "Went with the faster close." });
    const patch = db.to("update rift_decisions")[0]!.payload as Record<string, unknown>;
    expect(patch.chosen_option_id).toBe("o1");
    expect(patch.decided_at).toBeTruthy();
    expect(patch.outcome_note).toBe("Went with the faster close.");
  });
});

describe("clearOutcome", () => {
  it("clears both halves together", async () => {
    /* The constraint requires them to travel as a pair: half an outcome is a
       room saying a decision was made without saying what it was. */
    build({ "update rift_decisions": { data: {} } });
    await clearOutcome("d1");
    const patch = db.to("update rift_decisions")[0]!.payload as Record<string, unknown>;
    expect(patch.decided_at).toBeNull();
    expect(patch.chosen_option_id).toBeNull();
  });
});

describe("createDecision", () => {
  it("refuses a question too short to answer", async () => {
    build();
    expect((await createDecision({ leadId: "l1", kind: "other", question: "Hmm" })).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("with no database", () => {
  it("skips rather than claiming there are no decisions", async () => {
    vi.resetModules();
    vi.doMock("./service", () => ({ serviceClient: () => null, currentAgentId: async () => null }));
    const mod = await import("./decisions");
    for (const r of [await mod.decisionsFor("l1"), await mod.releasedFor("l1", "agent-1")]) {
      expect(r.ok).toBe(true);
      expect("skipped" in r).toBe(true);
    }
    vi.doUnmock("./service");
    vi.resetModules();
  });
});
