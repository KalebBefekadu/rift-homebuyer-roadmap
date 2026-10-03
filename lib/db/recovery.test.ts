import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * "Started, not finished" after the questionnaire was retired (D31).
 *
 * `abandoned()` read `rift_assessments` only. Nothing writes one now, so the
 * report said nobody had started and left, while every value page was losing
 * people. The query was well formed and the answer was wrong, and nothing
 * failed. What is asserted: the v5 values' own events are counted, a person
 * who saved a plan is not, an address is attached only when one was given, a
 * failed read is a failure rather than an empty list, and v4 rows still show.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));

const { abandoned } = await import("./recovery");

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const view = (session: string, tool: string, h: number, payload: Record<string, unknown> = {}) =>
  ({ session_id: session, name: "value_view", payload: { tool, answered: 0, of: 3, ...payload }, at: hoursAgo(h) });

const list = async () => {
  const r = await abandoned();
  expect(r.ok, !r.ok ? r.error : "").toBe(true);
  return r.ok && "data" in r ? r.data : [];
};

beforeEach(() => vi.clearAllMocks());

describe("abandoned() reads the values as well as the retired assessments", () => {
  it("lists a visitor who opened a value and left, with the address they gave", async () => {
    build({
      "select rift_assessments": { data: [], error: null },
      "select rift_events": { data: [view("s1", "cash", 5), view("s2", "proceeds", 7)], error: null },
      "select rift_leads": (call) =>
        call.filters.some((f) => f.includes("plan_token"))
          ? { data: [], error: null }
          : { data: [{ session_id: "s2", email: "sell@example.com" }], error: null },
    });
    const rows = await list();
    expect(rows.map((r) => [r.sessionId, r.side, r.email, r.assessmentId])).toEqual([
      ["s1", "buy", null, null],
      ["s2", "sell", "sell@example.com", null],
    ]);
    expect(rows[0]).toMatchObject({ tool: "cash", answered: 0 });
  });

  it("does not list somebody who saved a plan, however many values they left half open", async () => {
    build({
      "select rift_assessments": { data: [], error: null },
      "select rift_events": { data: [view("s1", "cash", 5), view("s1", "monthly", 4)], error: null },
      "select rift_leads": (call) =>
        call.filters.some((f) => f.includes("plan_token"))
          ? { data: [{ session_id: "s1" }], error: null }
          : { data: [], error: null },
    });
    expect(await list()).toEqual([]);
  });

  it("asks only for events inside the window, and only the three the answer needs", async () => {
    build({ "select rift_assessments": { data: [], error: null }, "select rift_events": { data: [], error: null } });
    await abandoned(2, 30);
    const f = db.to("select rift_events")[0]!.filters;
    expect(f).toContain("eq:agent_id=agent-1");
    expect(f.find((x) => x.startsWith("in:name="))).toBe("in:name=[value_view,question_view,value_answer]");
    expect(f.some((x) => x.startsWith("gte:at="))).toBe(true);
  });

  it("keeps listing a v4 assessment, newest first among both", async () => {
    build({
      "select rift_assessments": {
        data: [{ id: "a1", session_id: "old", side: "buy", county: "Cobb", started_at: hoursAgo(50), rift_answers: [{ question_key: "price" }], rift_leads: [{ email: "v4@example.com" }] }],
        error: null,
      },
      "select rift_events": { data: [view("s1", "cash", 5)], error: null },
    });
    const rows = await list();
    expect(rows.map((r) => r.sessionId)).toEqual(["s1", "old"]);
    expect(rows[1]).toMatchObject({ assessmentId: "a1", email: "v4@example.com", answered: 1, tool: null });
  });

  it("is a failure, not an empty list, when the events cannot be read", async () => {
    build({
      "select rift_assessments": { data: [], error: null },
      "select rift_events": { data: null, error: { message: "boom" } },
    });
    const r = await abandoned();
    expect(r.ok).toBe(false);
  });

  it("still answers from the values when the retired assessments table is gone", async () => {
    /* A schema that no longer has the v4 tables must not take the v5 half of
       the report down with it. */
    build({
      "select rift_assessments": { data: null, error: { message: 'relation "rift_assessments" does not exist' } },
      "select rift_events": { data: [view("s1", "cash", 5)], error: null },
    });
    expect((await list()).map((r) => r.sessionId)).toEqual(["s1"]);
  });
});
