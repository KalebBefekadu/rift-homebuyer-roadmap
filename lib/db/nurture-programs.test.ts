import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The programs email (n4) and the saved plan page must agree.
 *
 * n4 matched on county and first-time status alone, through the older
 * matcher. The saved plan page matches the full profile (income, household
 * size, price, work) through `matchAssistance`. So a person whose income is
 * over every limit was emailed "the programs that look like they fit your
 * answers" on a day their own plan page listed none. Nothing failed: both
 * were well formed, and they contradicted each other in front of the person.
 *
 * What is asserted: the email's profile is the page's (one function), its
 * matcher is the page's, the answer for a person the page says fits nothing
 * is nothing, and a plan without the answers the page needs is skipped with
 * the reason instead of guessed at.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));
const currentPrograms = vi.fn();
vi.mock("./program-checks", () => ({ currentPrograms: () => currentPrograms() }));
vi.mock("./settings", () => ({ rulesOrDefaults: async () => ({ rules: { registryDays: { value: 90 } } }) }));

const { due, matchedPrograms, programBook } = await import("./nurture");
const { GEORGIA_PROGRAMS, matchAssistance } = await import("@/lib/core/assistance");
const { assistanceProfile } = await import("@/lib/core/saved-plan");
const { matchPrograms } = await import("@/lib/core/registry");

/* The registry's records were read on 24 Sep 2026. */
const NOW = new Date("2026-09-28T12:00:00Z");

const FULL = { county: "Fulton", ownership: "none", price: 300_000, income: 60_000, household: "2", occupation: "other" };
const plan = (answers: Record<string, unknown>, side = "buy") => ({
  mode: "save", side, savedOn: "2026-09-20", values: [{ tool: "assistance", label: "Assistance", figure: "$1", href: "/buy/assistance" }], answers,
});

const enrolment = (id: string, lead: Record<string, unknown>) => ({
  id: `e-${id}`, lead_id: id, band: "now", entered_at: "2026-09-17T00:00:00Z", phone_consent: false,
  rift_leads: { name: id, email: `${id}@example.com`, assessment_id: null, side: "buy", ...lead },
  rift_touches: ["n1", "n2", "n3"].map((s) => ({ step_id: s })),
});

const queue = async (rows: unknown[], extra: Answers = {}) => {
  build({ "select rift_enrolments": { data: rows, error: null }, "select rift_journeys": { data: [], error: null }, ...extra });
  const q = await due(NOW);
  expect(q.ok, !q.ok ? q.error : "").toBe(true);
  return new Map((q.ok && "data" in q ? q.data : []).map((t) => [t.leadId, t]));
};

beforeEach(() => { vi.clearAllMocks(); currentPrograms.mockResolvedValue(GEORGIA_PROGRAMS); });

describe("the profile n4 matches on", () => {
  it("is the saved plan page's, built by the same function", async () => {
    const t = (await queue([enrolment("saver", { plan: plan(FULL), plan_token: "tok", plan_saved_at: "2026-09-20T12:00:00Z" })])).get("saver")!;
    expect(t.stepId).toBe("n4");
    expect(t.profile).toEqual(assistanceProfile(FULL).profile);
    expect(t.profileGap).toBeNull();
  });

  it("is no profile, with the reason, when the plan lacks answers the page needs", async () => {
    /* They ran cash to close and never the programs check: the page shows no
       assistance plan, so there is nothing for an email to agree with. */
    const partial = { county: "Fulton", ownership: "none", price: 300_000 };
    const t = (await queue([enrolment("partial", { plan: plan(partial), plan_token: "tok", plan_saved_at: "2026-09-20T12:00:00Z" })])).get("partial")!;
    expect(t.profile).toBeNull();
    expect(t.profileGap).toMatch(/saved plan.*missing: income, household, occupation/);
  });

  it("is built from the readout's own inputs for a v4 lead, and gaps without a price", async () => {
    const readout = (inputs: Record<string, unknown>) => ({
      assessment_id: "a1", figures: { cashToClose: 1 }, inputs, share_token: "t1", rift_assessments: { county: "DeKalb" },
    });
    const withPrice = (await queue(
      [enrolment("old", { assessment_id: "a1" })],
      { "select rift_answers": { data: [], error: null }, "select rift_readouts": { data: [readout({ ownership: "primary", price: 280_000 })], error: null } },
    )).get("old")!;
    expect(withPrice.kind).toBe("readout");
    expect(withPrice.profile).toEqual({ county: "DeKalb", firstTime: false, price: 280_000 });

    const noPrice = (await queue(
      [enrolment("old", { assessment_id: "a1" })],
      { "select rift_answers": { data: [], error: null }, "select rift_readouts": { data: [readout({ ownership: "none" })], error: null } },
    )).get("old")!;
    expect(noPrice.profile).toBeNull();
    expect(noPrice.profileGap).toMatch(/no price on their readout/);
  });

  it("is nothing for somebody with neither a readout nor a plan", async () => {
    const t = (await queue([enrolment("nobody", {})])).get("nobody")!;
    expect(t.profile).toBeNull();
    expect(t.profileGap).toMatch(/nothing on record/);
  });
});

describe("the programs n4 lists", () => {
  const book = async () => programBook();

  it("are exactly what the saved plan page lists for the same answers", async () => {
    const { profile } = assistanceProfile(FULL);
    const page = matchAssistance(profile!, { today: NOW, windowDays: 90, programs: GEORGIA_PROGRAMS }).matches.map((m) => m.program.name);
    expect(page.length).toBeGreaterThan(0);
    expect(matchedPrograms({ profile }, await book(), NOW).map((l) => l.name)).toEqual(page);
  });

  it("is nothing for somebody the page says fits none, in a county the old matcher would list", async () => {
    /* The contradiction itself. Fulton, first-time, and an income over every
       limit: the county-and-status matcher lists programs; the page lists
       none. */
    const rich = { ...FULL, income: 450_000 };
    const { profile } = assistanceProfile(rich);
    expect(matchAssistance(profile!, { today: NOW, windowDays: 90, programs: GEORGIA_PROGRAMS }).matches).toEqual([]);
    expect(matchPrograms({ county: "Fulton", firstTimeBuyer: true, today: NOW, windowDays: 90 }).matched.length).toBeGreaterThan(0);
    expect(matchedPrograms({ profile }, await book(), NOW)).toEqual([]);
  });

  it("is nothing without a profile, and asks the registry nothing", async () => {
    expect(matchedPrograms({ profile: null }, await book(), NOW)).toEqual([]);
  });

  it("names each program with its funding state and what it asks, as before", async () => {
    const { profile } = assistanceProfile(FULL);
    const [first] = matchedPrograms({ profile }, await book(), NOW);
    expect(first).toMatchObject({ name: expect.any(String), needs: expect.any(Array) });
    expect(first!.state === null || typeof first!.state === "string").toBe(true);
  });

  it("reads the registry once for the run, through the same checks the page uses", async () => {
    await programBook();
    expect(currentPrograms).toHaveBeenCalledTimes(1);
  });

  it("does not list a program the registry's review has withheld", async () => {
    const { profile } = assistanceProfile(FULL);
    const withheld = GEORGIA_PROGRAMS.map((p) => ({ ...p, status: "unverified" as const, withheldReason: "re-checking" }));
    currentPrograms.mockResolvedValue(withheld);
    expect(matchedPrograms({ profile }, await programBook(), NOW)).toEqual([]);
  });
});
