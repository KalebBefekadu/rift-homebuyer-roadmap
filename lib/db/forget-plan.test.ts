import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * "Delete all of it" from a saved plan's page (LEAD-06).
 *
 * The session id dies with the tab. Somebody who saved a plan last week and
 * came back to delete it had no session handle left, so the readout's button
 * would report "nothing stored on our side" while their name, address and
 * plan stayed in rift_leads. The plan's private link is the claim instead.
 */

let db: Fake & { auth: { admin: { deleteUser: ReturnType<typeof vi.fn> } } };
const build = (answers: Answers = {}) => {
  db = Object.assign(fakeDb(answers), { auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } } });
  return db;
};

vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));
vi.mock("./documents", () => ({ removeJourneyFiles: vi.fn(async () => ({ ok: true, data: { removed: 0 } })) }));
const forgetAtBrevo = vi.fn(async () => ({ ok: true }));
vi.mock("./email", () => ({ forgetAtBrevo: (...a: unknown[]) => forgetAtBrevo(...(a as [])) }));
vi.mock("./recovery", () => ({ markAbandoned: vi.fn() }));

const { forget, forgetByPlan } = await import("./retention");

beforeEach(() => { vi.clearAllMocks(); });

const TOKEN = "Abcdefghijklmnopqrstuvwxyz012345";

const saved = (row: Record<string, unknown> | null): Answers => ({
  "select rift_leads": (c) => c.filters.some((f) => f.startsWith("eq:plan_token"))
    ? { data: row, error: null }
    : c.filters.some((f) => f.startsWith("select:email"))
      ? { data: [{ email: "sam@example.com" }], error: null }
      : { data: [], error: null },
  "select rift_assessments": { data: [], error: null },
  "select rift_journeys": { data: [], error: null },
});

describe("deleting from the saved plan's link", () => {
  it("finds the lead by its plan link, not by a session the visitor no longer has", async () => {
    build(saved({ id: "l1", session_id: null, assessment_id: null }));
    const r = await forgetByPlan(TOKEN);
    expect(r.ok && "data" in r && r.data).toEqual({ deleted: 1, held: 0 });
    expect(db.to("select rift_leads")[0]!.filters).toEqual(expect.arrayContaining([`eq:plan_token=${TOKEN}`, "eq:agent_id=agent-1"]));
    expect(db.to("delete rift_leads")[0]!.filters).toContain("in:id=[l1]");
    expect(forgetAtBrevo).toHaveBeenCalledWith("sam@example.com");
  });

  it("erases the session the lead kept, too: its events, consent and first touch", async () => {
    build(saved({ id: "l1", session_id: "s-old", assessment_id: null }));
    await forgetByPlan(TOKEN);
    expect(db.to("delete rift_events")[0]!.filters).toContain("eq:session_id=s-old");
    expect(db.to("delete rift_consents").some((c) => c.filters.includes("eq:session_id=s-old"))).toBe(true);
    expect(db.to("delete rift_attributions")[0]!.filters).toContain("eq:session_id=s-old");
  });

  it("without a session, touches nothing keyed by one", async () => {
    build(saved({ id: "l1", session_id: null, assessment_id: null }));
    await forgetByPlan(TOKEN);
    expect(db.to("delete rift_events")).toHaveLength(0);
    expect(db.to("delete rift_attributions")).toHaveLength(0);
  });

  it("says nothing was deleted for a link that matches no plan, and never queries for a malformed one", async () => {
    build(saved(null));
    const r = await forgetByPlan(TOKEN);
    expect(r.ok && "data" in r && r.data).toEqual({ deleted: 0, held: 0 });
    expect(db.to("delete rift_leads")).toHaveLength(0);

    build(saved(null));
    await forgetByPlan("short");
    expect(db.calls).toHaveLength(0);
  });
});

describe("what is checked, and in which order", () => {
  it("removes consent by assessment before the assessment, whose delete would orphan it", async () => {
    /* rift_consents.assessment_id is SET NULL on delete: once the assessment
       goes, a delete keyed on it matches nothing. */
    build(saved({ id: "l1", session_id: null, assessment_id: "a1" }));
    const r = await forgetByPlan(TOKEN);
    expect(r.ok).toBe(true);
    const consent = db.calls.findIndex((c) => c.verb === "delete" && c.table === "rift_consents" && c.filters.includes("in:assessment_id=[a1]"));
    const assessment = db.calls.findIndex((c) => c.verb === "delete" && c.table === "rift_assessments");
    expect(consent).toBeGreaterThan(-1);
    expect(consent).toBeLessThan(assessment);
  });

  it("does not answer Deleted when the consent record could not be removed", async () => {
    build({ ...saved({ id: "l1", session_id: "s-old", assessment_id: "a1" }), "delete rift_consents": { error: { message: "permission denied" } } });
    const r = await forgetByPlan(TOKEN);
    expect(r.ok).toBe(false);
    /* Stopped before the lead went, so the plan link still finds it on a retry. */
    expect(db.to("delete rift_leads")).toHaveLength(0);
  });

  it("does not answer Deleted when the events could not be removed", async () => {
    build({ ...saved({ id: "l1", session_id: "s-old", assessment_id: null }), "delete rift_events": { error: { message: "timeout" } } });
    const r = await forgetByPlan(TOKEN);
    expect(r.ok).toBe(false);
    expect(db.to("delete rift_leads")).toHaveLength(0);
  });

  it("never erases by a session every storage-blocked browser shared", async () => {
    /* The lead's own row goes; nothing keyed by "anon" does, because that
       session belongs to every visitor who ever sent it. */
    build(saved({ id: "l1", session_id: "anon", assessment_id: null }));
    const r = await forgetByPlan(TOKEN);
    expect(r.ok && "data" in r && r.data.deleted).toBe(1);
    expect(db.to("delete rift_leads")[0]!.filters).toContain("in:id=[l1]");
    expect(db.calls.some((c) => c.filters.includes("eq:session_id=anon"))).toBe(false);
  });

  it("refuses a delete request keyed by a shared session, instead of deleting everyone under it", async () => {
    build(saved(null));
    const r = await forget("anon");
    expect(r.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });

  it("scopes the first-touch delete to this agent", async () => {
    build(saved({ id: "l1", session_id: "s-old", assessment_id: null }));
    await forgetByPlan(TOKEN);
    expect(db.to("delete rift_attributions")[0]!.filters).toEqual(expect.arrayContaining(["eq:agent_id=agent-1", "eq:session_id=s-old"]));
  });
});
