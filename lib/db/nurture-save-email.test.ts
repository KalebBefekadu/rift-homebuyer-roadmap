import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The save email and the day-zero touch.
 *
 * "Your Rift plan" goes out the moment somebody saves, carrying the link to
 * it. The first follow-up (n1, s1 or l1) is day zero, so it went out within
 * the day with the same link and a different subject: two emails about the
 * one thing they had just done, which is how a product shows it has no memory.
 *
 * The skip must rest on a FACT, not an assumption that the save email always
 * goes. It can fail, or email can be switched off, and then the follow-up is
 * the only email that carries the link. So the save email's outcome is
 * recorded, and only a recorded success skips the day-zero touch.
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

const { due, recordSaveEmail } = await import("./nurture");
const { SAVE_EMAIL_STEP } = await import("@/lib/core/nurture");

const NOW = new Date("2026-09-24T12:00:00Z");

const PLAN = {
  mode: "save", side: "buy", savedOn: "2026-09-23",
  values: [{ tool: "cash", label: "Cash to close", figure: "$1", href: "/buy/cash-to-close" }],
  answers: { county: "Cobb" },
};

const enrolment = (id: string, o: { band?: string; plan?: unknown; assessment?: string; entered?: string; touches?: Record<string, unknown>[] }) => ({
  id: `e-${id}`, lead_id: id, band: o.band ?? "now", entered_at: o.entered ?? "2026-09-23T20:00:00Z", phone_consent: false,
  rift_leads: {
    name: id, email: `${id}@example.com`, assessment_id: o.assessment ?? null, side: "buy",
    plan: o.plan === undefined ? PLAN : o.plan, plan_token: o.plan === null ? null : "tok", plan_saved_at: "2026-09-23T20:00:00Z",
  },
  rift_touches: o.touches ?? [],
});

const save = (outcome: string, at = "2026-09-23T20:00:05Z") => ({ step_id: SAVE_EMAIL_STEP, outcome, sent_at: at });

const first = async (rows: unknown[], extra: Answers = {}) => {
  build({ "select rift_enrolments": { data: rows, error: null }, "select rift_journeys": { data: [], error: null }, ...extra });
  const q = await due(NOW);
  expect(q.ok, !q.ok ? q.error : "").toBe(true);
  return new Map((q.ok && "data" in q ? q.data : []).map((t) => [t.leadId, t]));
};

beforeEach(() => vi.clearAllMocks());

describe("the day-zero step, after a recorded save email", () => {
  it.each([["now", "n1"], ["soon", "s1"], ["later", "l1"]])("skips %s's %s, with the day the save email went", async (band, stepId) => {
    const t = (await first([enrolment("saver", { band, touches: [save("sent")] })])).get("saver")!;
    expect(t.stepId).toBe(stepId);
    expect(t.kind).toBe("plan");
    expect(t.skip).toBe("Not sent: the plan's save email already went out on September 23 with the same link");
  });

  it("does not skip when the save email failed: the follow-up is the only mail with the link", async () => {
    const t = (await first([enrolment("saver", { touches: [save("failed")] })])).get("saver")!;
    expect(t.stepId).toBe("n1");
    expect(t.skip).toBeNull();
  });

  it("does not skip when email was off at the time of the save", async () => {
    expect((await first([enrolment("saver", { touches: [save("skipped")] })])).get("saver")!.skip).toBeNull();
  });

  it("does not skip when nothing was recorded: no fact, no skip", async () => {
    /* Every plan saved before this was recorded, and any whose recording
       failed. Better one duplicate than a person who never got the link. */
    expect((await first([enrolment("saver", {})])).get("saver")!.skip).toBeNull();
  });

  it("does not skip a readout lead's day-zero: their save email did not carry their readout", async () => {
    const rows = [enrolment("old", { assessment: "a1", touches: [save("sent")] })];
    const t = (await first(rows, {
      "select rift_answers": { data: [], error: null },
      "select rift_readouts": { data: [{ assessment_id: "a1", figures: { cashToClose: 1 }, inputs: {}, share_token: "t", rift_assessments: { county: "Cobb" } }], error: null },
    })).get("old")!;
    expect(t.kind).toBe("readout");
    expect(t.skip).toBeNull();
  });

  it("does not skip the step after day zero: the text that follows is not the link again", async () => {
    const t = (await first([enrolment("saver", {
      entered: "2026-09-22T00:00:00Z",
      touches: [save("sent"), { step_id: "n1", outcome: "skipped" }],
    })])).get("saver")!;
    expect(t.stepId).toBe("n2");
    expect(t.skip).toBeNull();
  });

  it("counts the save record as sent without letting it stand in for a step", async () => {
    /* "save" is not in any sequence, so it can never be mistaken for a step
       already done. */
    const t = (await first([enrolment("saver", { touches: [save("sent")] })])).get("saver")!;
    expect(t.stepId).toBe("n1");
  });
});

describe("recording the save email", () => {
  const lead = { "select rift_enrolments": { data: [{ id: "e-1" }], error: null } };

  it("records a send as a touch on the lead's enrolment, under a step no sequence has", async () => {
    build({ ...lead, "insert rift_touches": { data: [], error: null } });
    const r = await recordSaveEmail("lead-1", "sent");
    expect(r.ok && "data" in r && r.data).toEqual({ recorded: true });
    expect(db.to("select rift_enrolments")[0]!.filters).toContain("eq:lead_id=lead-1");
    expect(db.to("insert rift_touches")[0]!.payload).toMatchObject({
      enrolment_id: "e-1", step_id: SAVE_EMAIL_STEP, channel: "email", outcome: "sent", detail: null,
    });
  });

  it("records a failure and a switched-off sender with why, so neither reads as sent", async () => {
    build({ ...lead, "insert rift_touches": { data: [], error: null } });
    await recordSaveEmail("lead-1", "failed", "Brevo said 400");
    expect(db.to("insert rift_touches")[0]!.payload).toMatchObject({ outcome: "failed", detail: "Brevo said 400" });
    build({ ...lead, "insert rift_touches": { data: [], error: null } });
    await recordSaveEmail("lead-1", "skipped", "BREVO_API_KEY not set");
    expect(db.to("insert rift_touches")[0]!.payload).toMatchObject({ outcome: "skipped", detail: "BREVO_API_KEY not set" });
  });

  it("says so, and writes nothing, when the lead has no sequence", async () => {
    build({ "select rift_enrolments": { data: [], error: null } });
    const r = await recordSaveEmail("lead-1", "sent");
    expect(r.ok && "skipped" in r).toBe(true);
    expect(db.to("insert rift_touches")).toHaveLength(0);
  });

  it("treats a second record for the same enrolment as already recorded, not as an incident", async () => {
    build({ ...lead, "insert rift_touches": { error: { message: "duplicate key value", code: "23505" } } });
    const r = await recordSaveEmail("lead-1", "sent");
    expect(r.ok && "data" in r && r.data).toEqual({ recorded: false });
  });

  it("is a failure, not a quiet success, when the write fails", async () => {
    build({ ...lead, "insert rift_touches": { error: { message: "permission denied", code: "42501" } } });
    expect((await recordSaveEmail("lead-1", "sent")).ok).toBe(false);
  });
});
