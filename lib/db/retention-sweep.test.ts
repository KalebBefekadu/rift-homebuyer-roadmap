import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * What the nightly sweep actually deletes.
 *
 * This is the one job in the product that destroys data on a timer, with
 * nobody watching, against a promise printed at the bottom of every readout.
 * It has never been tested beyond "it does not throw when there is no
 * database" — and the last time a foreign key changed underneath this family
 * of code, `forget()` went on reporting success while leaving the person's
 * name, email and phone in place for the life of the migration.
 *
 * Every assertion below is about a row that must SURVIVE, or an order of
 * operations that must hold. A sweep that deletes too little is a bug; a sweep
 * that deletes too much is not recoverable.
 */

const AGENT = "agent-1";

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => AGENT,
}));
vi.mock("./recovery", () => ({ markAbandoned: vi.fn(async () => ({ ok: true, data: {} })) }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { sweep, WINDOWS } = await import("./retention");

const NOW = new Date("2026-09-20T03:00:00Z");
/** The ISO string the job will compute for a window, so filters can be matched. */
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

beforeEach(() => { vi.clearAllMocks(); });

describe("what the sweep refuses to delete", () => {
  it("leaves an abandoned assessment alone when somebody's details are attached to it", async () => {
    /* The window that deletes at thirty days is for a stranger's finances with
       no way to ask them about it. The moment a name and an email are on the
       record it is a lead, not an orphan, and it lives by the lead's clock. */
    build({
      "select rift_assessments": (call) => ({
        data: call.filters.some((f) => f.startsWith("select:id,rift_leads"))
          ? [{ id: "a-with-lead", rift_leads: [{ id: "l1" }] }, { id: "a-orphan", rift_leads: [] }]
          : [],
      }),
    });

    const r = await sweep(NOW);
    expect(r.ok).toBe(true);

    const deletes = db.to("delete rift_assessments");
    expect(deletes, "no assessment was deleted at all").toHaveLength(1);
    expect(deletes[0]!.filters.join(" ")).toContain("a-orphan");
    expect(deletes[0]!.filters.join(" "), "an assessment with a lead on it was deleted")
      .not.toContain("a-with-lead");
  });

  it("never deletes a lead the agent has replied to", async () => {
    /* Asserted on the FILTER, not on the rows handed back. The rows are the
       fake's opinion; `is human_replied_at null` is the product's. */
    build();
    await sweep(NOW);

    const read = db.to("select rift_leads")[0];
    expect(read, "the sweep did not look at leads").toBeTruthy();
    expect(read!.filters).toContain("is:human_replied_at=null");
  });

  it("never deletes a lead with a sequence still running", async () => {
    build({
      "select rift_leads": {
        data: [
          { id: "still-running", rift_enrolments: [{ stopped_at: null }] },
          { id: "stopped", rift_enrolments: [{ stopped_at: "2026-01-01" }] },
          { id: "never-enrolled", rift_enrolments: [] },
        ],
      },
    });

    const r = await sweep(NOW);
    expect(r.ok && "data" in r && r.data.leads).toBe(2);

    const gone = db.to("delete rift_leads")[0]!.filters.join(" ");
    expect(gone, "a lead with a live sequence was deleted").not.toContain("still-running");
    expect(gone).toContain("stopped");
    expect(gone).toContain("never-enrolled");
  });

  it("does not touch clients or consents, and says why", async () => {
    /* The client record has a legal floor set by Georgia licence law, and the
       consent record is what proves the contact was lawful — it has to outlive
       the relationship it documents. Both are stated in the result so the
       refusal is visible rather than an absence. */
    build();
    const r = await sweep(NOW);

    expect(db.calls.map((c) => c.table)).not.toContain("rift_clients");
    expect(db.calls.map((c) => c.table)).not.toContain("rift_consents");

    expect(r.ok && "data" in r && r.data.held.join(" ")).toMatch(/client records are untouched/i);
    expect(r.ok && "data" in r && r.data.held.join(" ")).toMatch(/consent records are untouched/i);
  });

  it("scopes every delete to this agent, or to ids it has already chosen", async () => {
    /* The service client bypasses RLS entirely, so an unscoped delete here is
       not caught by the database. Nothing else stands between this job and
       every row in the table. */
    build({
      "select rift_assessments": (call) => ({
        data: call.filters.some((f) => f.startsWith("select:id,rift_leads")) ? [{ id: "a1", rift_leads: [] }] : [{ id: "c1" }],
      }),
      "select rift_leads": { data: [{ id: "l1", rift_enrolments: [] }] },
    });
    await sweep(NOW);

    const deletes = db.calls.filter((c) => c.verb === "delete");
    expect(deletes.length).toBeGreaterThan(0);
    for (const d of deletes) {
      const scoped = d.filters.some((f) => f === `eq:agent_id=${AGENT}` || f.startsWith("in:id="));
      expect(scoped, `an unscoped delete on ${d.table}: ${d.filters.join(" ")}`).toBe(true);
    }
  });
});

describe("the windows it applies", () => {
  it("uses the documented periods, against the column each one is about", async () => {
    /* WINDOWS is rendered to the visitor in lib/core/privacy.ts. If the job
       and the promise drift, the page is a lie and nothing fails. */
    build();
    await sweep(NOW);

    const filters = db.calls.flatMap((c) => c.filters);

    /* Thirty days, on an assessment nobody finished. */
    expect(filters).toContain(`lte:started_at=${ago(WINDOWS.abandoned.days)}`);
    /* Eighteen months, on one they did. */
    expect(filters).toContain(`lte:started_at=${ago(WINDOWS.unconverted.days)}`);
    /* Twenty-four months of telemetry, on its own clock. */
    expect(filters).toContain(`lte:at=${ago(WINDOWS.analytics.days)}`);
    /* Attribution follows telemetry, and is dated from the FIRST visit. */
    expect(filters).toContain(`lte:first_at=${ago(WINDOWS.analytics.days)}`);
    /* A lead lives by the unconverted window, not the abandoned one. */
    expect(filters).toContain(`lte:created_at=${ago(WINDOWS.unconverted.days)}`);
  });

  it("keeps the unconverted window well past a stated eighteen-month timeline", async () => {
    /* A buyer who answered "9 to 18 months" is inside their own plan. Deleting
       at ninety days would throw away the person the product exists for. */
    expect(WINDOWS.unconverted.days).toBeGreaterThanOrEqual(18 * 30);
    expect(WINDOWS.abandoned.days).toBeLessThan(WINDOWS.unconverted.days);
  });
});

describe("when something goes wrong halfway", () => {
  it("stops rather than reporting a sweep it did not finish", async () => {
    /* A job that carries on after a failed delete reports counts for work that
       did not happen, and the next night's run believes those rows are gone. */
    build({
      "select rift_assessments": (call) => ({
        data: call.filters.some((f) => f.startsWith("select:id,rift_leads")) ? [{ id: "a1", rift_leads: [] }] : [],
      }),
      "delete rift_assessments": { error: { message: "permission denied" } },
    });

    const r = await sweep(NOW);
    expect(r.ok, "a failed delete was reported as a successful sweep").toBe(false);
    expect(!r.ok && r.error).toContain("permission denied");

    /* And nothing after it ran. */
    expect(db.to("delete rift_events")).toHaveLength(0);
    expect(db.to("delete rift_leads")).toHaveLength(0);
  });

  it("counts before it deletes, so the report is of rows that existed", async () => {
    build({ "select rift_events": { data: [], count: 41 } });
    const r = await sweep(NOW);

    const events = db.to("rift_events");
    expect(events[0]!.verb, "the sweep deleted events before counting them").toBe("select");
    expect(events[0]!.filters.join(" ")).toContain("count:exact head");
    expect(r.ok && "data" in r && r.data.events).toBe(41);
  });

  it("marks quiet assessments as abandoned without deleting them", async () => {
    /* Marking is not deletion and must not become it. An abandonment deleted
       immediately destroys the recovery the product is built on. */
    const { markAbandoned } = await import("./recovery");
    build({
      "select rift_assessments": (call, nth) => ({ data: nth === 1 ? [{ id: "quiet-1" }, { id: "quiet-2" }] : [] }),
    });

    const r = await sweep(NOW);
    expect(markAbandoned).toHaveBeenCalledTimes(2);
    expect(r.ok && "data" in r && r.data.marked).toBe(2);
    expect(db.to("delete rift_assessments")).toHaveLength(0);
  });
});
