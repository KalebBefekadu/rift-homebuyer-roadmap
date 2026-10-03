import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Which follow-up a person is owed, now that leads save plans.
 *
 * Since D31 retired the questionnaire, no production path writes a readout,
 * an assessment or an answer. `due()` read only those, so every real lead,
 * each of whom had finished and saved a plan (Blueprint v5 §5.5), came out
 * with no figures and was sent "pick up where you left off, you answered 0",
 * and the programs email was skipped for all of them as "no county on
 * record". Nothing failed: the queue was well formed and wrong.
 *
 * What is asserted: a saved plan is read on the same query, it decides the
 * kind and the copy, its county feeds the programs step, and the two older
 * kinds are exactly as they were.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));
vi.mock("./program-checks", () => ({ currentPrograms: async () => [] }));
vi.mock("./settings", () => ({ rulesOrDefaults: async () => ({ rules: { registryDays: { value: 90 } } }) }));

const { due } = await import("./nurture");
const { SEQUENCES } = await import("@/lib/core/nurture");

const NOW = new Date("2026-09-24T12:00:00Z");

/* A plan as `cleanPlan` stores it, with a figure that must never be quoted. */
const PLAN = {
  mode: "save", side: "buy", savedOn: "2026-09-17",
  values: [{ tool: "cash", label: "Cash to close", figure: "$24,788", href: "/buy/cash-to-close?c=Cobb&s=9000" }],
  answers: { county: "Cobb", ownership: "none", savings: 9000 },
};

const enrolment = (id: string, lead: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  id: `e-${id}`, lead_id: id, band: "now", entered_at: "2026-09-17T00:00:00Z", phone_consent: false,
  rift_leads: { name: id, email: `${id}@example.com`, assessment_id: null, side: "buy", ...lead },
  rift_touches: [], ...over,
});

const queue = async () => {
  const q = await due(NOW);
  expect(q.ok, !q.ok ? q.error : "").toBe(true);
  return new Map((q.ok && "data" in q ? q.data : []).map((t) => [t.leadId, t]));
};

beforeEach(() => { vi.clearAllMocks(); });

describe("the queue reads the saved plan", () => {
  it("asks for the plan on the same query as the lead, not in a second round trip", async () => {
    build({ "select rift_enrolments": { data: [], error: null }, "select rift_journeys": { data: [], error: null } });
    await due(NOW);
    const select = db.to("select rift_enrolments")[0]!.filters.find((f) => f.startsWith("select:"))!;
    expect(select).toMatch(/rift_leads\([^)]*plan,plan_token,plan_saved_at/);
    expect(db.to("select rift_leads")).toHaveLength(0);
  });

  it("gives somebody who saved a plan the plan touch, not the resume touch", async () => {
    build({
      "select rift_enrolments": { data: [enrolment("saver", { plan: PLAN, plan_token: "tok-1", plan_saved_at: "2026-09-17T23:30:00Z" })], error: null },
      "select rift_journeys": { data: [], error: null },
    });
    const t = (await queue()).get("saver")!;
    expect(t.kind).toBe("plan");
    expect(t.planToken).toBe("tok-1");
    /* Georgia's day: 23:30 UTC on the 17th is still the 17th in Atlanta. */
    expect(t.planSavedOn).toBe("2026-09-17");
    expect(t.againPath).toBe("/buy/cash-to-close");
    expect(t.county).toBe("Cobb");
    expect(t.firstTimeBuyer).toBe(true);
    /* They finished; the resume email's "you answered 0 of N" is not theirs. */
    expect(t.answered).toBe(t.of);
    /* No figure travels: the plan's are the browser's text. */
    expect(t.figures).toBeNull();
    expect(JSON.stringify(t)).not.toContain("24,788");
    /* The day-zero step's plan copy, not "Your readout". */
    const n1 = SEQUENCES[0].steps[0];
    expect(t.says).toBe(n1.plan!.says);
    expect(t.body).toBe(n1.plan!.body);
    /* No v4 table is read for a lead with no assessment. */
    expect(db.to("select rift_readouts")).toHaveLength(0);
    expect(db.to("select rift_answers")).toHaveLength(0);
  });

  it("does not tell a plan saver in the dormant band that they were most of the way through", async () => {
    build({
      "select rift_enrolments": { data: [enrolment("quiet", { plan: PLAN, plan_token: "tok-2", plan_saved_at: "2026-09-17T12:00:00Z" }, { band: "nurture" })], error: null },
      "select rift_journeys": { data: [], error: null },
    });
    const t = (await queue()).get("quiet")!;
    expect(t.stepId).toBe("d1");
    expect(t.kind).toBe("plan");
    expect(t.says).not.toMatch(/most of the way/i);
  });

  it("reads the plan's county and ownership for the programs step (n4), and no profile when the rest is missing", async () => {
    build({
      "select rift_enrolments": {
        data: [enrolment("owner", {
          plan: { ...PLAN, answers: { county: "Gwinnett", ownership: "primary" } }, plan_token: "tok-3", plan_saved_at: "2026-09-10T12:00:00Z",
        }, { entered_at: "2026-09-10T00:00:00Z", rift_touches: [{ step_id: "n1" }, { step_id: "n2" }, { step_id: "n3" }] })],
        error: null,
      },
      "select rift_journeys": { data: [], error: null },
    });
    const t = (await queue()).get("owner")!;
    expect(t.stepId).toBe("n4");
    expect(t.kind).toBe("plan");

    expect(t.county).toBe("Gwinnett");
    expect(t.firstTimeBuyer).toBe(false);
    /* The page needs income, household and work as well and this plan has
       none, so it shows no assistance plan and the email has nothing to agree
       with (nurture-programs.test.ts covers the full profile). */
    expect(t.profile).toBeNull();
    expect(t.profileGap).toMatch(/missing: price, income, household, occupation/);
  });

  it("counts a plan without its link as nothing to point at", async () => {
    /* The token is the only way back to the plan. Without one there is no
       page to send them to, and the resume touch is the honest fallback. */
    build({
      "select rift_enrolments": { data: [enrolment("tokenless", { plan: PLAN, plan_token: null })], error: null },
      "select rift_journeys": { data: [], error: null },
    });
    expect((await queue()).get("tokenless")!.kind).toBe("resume");
  });
});

describe("the older kinds are unchanged", () => {
  it("a lead with neither a readout nor a plan gets the resume touch", async () => {
    build({
      "select rift_enrolments": { data: [enrolment("nobody", {})], error: null },
      "select rift_journeys": { data: [], error: null },
    });
    const t = (await queue()).get("nobody")!;
    expect(t.kind).toBe("resume");
    expect(t.planToken).toBeNull();
    expect(t.county).toBeNull();
    expect(t.answered).toBe(0);
    const n1 = SEQUENCES[0].steps[0];
    expect(t.says).toBe(n1.says);
  });

  it("a v4 readout lead keeps its figures, its share link, its county and its copy", async () => {
    build({
      "select rift_enrolments": { data: [enrolment("old", { assessment_id: "a1" })], error: null },
      "select rift_journeys": { data: [], error: null },
      "select rift_answers": { data: [{ assessment_id: "a1" }, { assessment_id: "a1" }], error: null },
      "select rift_readouts": {
        data: [{ assessment_id: "a1", figures: { cashToClose: 26_000, gap: 0 }, inputs: { ownership: "primary" }, share_token: "share-1", rift_assessments: { county: "DeKalb" } }],
        error: null,
      },
    });
    const t = (await queue()).get("old")!;
    expect(t.kind).toBe("readout");
    expect(t.figures).toEqual({ cashToClose: 26_000, gap: 0 });
    expect(t.shareToken).toBe("share-1");
    expect(t.county).toBe("DeKalb");
    expect(t.firstTimeBuyer).toBe(false);
    expect(t.answered).toBe(2);
    expect(t.planToken).toBeNull();
    const n1 = SEQUENCES[0].steps[0];
    expect(t.says).toBe(n1.says);
    expect(t.body).toBe(n1.body);
  });

  it("prefers a readout over a plan on the same lead: its figures are computed and stored", async () => {
    build({
      "select rift_enrolments": { data: [enrolment("both", { assessment_id: "a1", plan: PLAN, plan_token: "tok-4" })], error: null },
      "select rift_journeys": { data: [], error: null },
      "select rift_answers": { data: [], error: null },
      "select rift_readouts": {
        data: [{ assessment_id: "a1", figures: { cashToClose: 1 }, inputs: {}, share_token: "share-2", rift_assessments: { county: "DeKalb" } }],
        error: null,
      },
    });
    const t = (await queue()).get("both")!;
    expect(t.kind).toBe("readout");
    expect(t.county).toBe("DeKalb");
    expect(t.planToken).toBeNull();
  });
});
