import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The crossing from a free readout to a published plan.
 *
 * The failure this guards is not a wrong number — it is a number that changed
 * without anybody saying so. Somebody shown "you need $27,875" has repeated it
 * to their partner and organised their saving around it. A plan opening at
 * $29,400 with no explanation leaves them unable to tell which figure was
 * wrong, on day one of the relationship.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

/* The rate and the registry are the two things that genuinely move underneath
   a stored snapshot, so they are what the tests vary. */
let ratePct = 6.5;
let matched: { id: string; name: string; min: number; max: number }[] = [];

vi.mock("./rates", () => ({
  currentRate: async () => ({ pct: ratePct, source: "test", asOf: null, freshness: "fresh" }),
}));
vi.mock("./match", () => ({
  matchForVisitor: async () => ({
    match: { matched, openMin: 0, openMax: 0, usableMin: 0, usableMax: 0 },
    source: "test", windowDays: 30,
  }),
}));

const { compareToSnapshot } = await import("./seam");

/* Deliberately partial, and one test depends on it staying that way: a real
   snapshot is whatever the build that wrote it happened to store, and the
   comparison has to survive the fields that did not exist yet. */
const INPUTS = {
  county: "Fulton", price: 350_000, savings: 15_000,
  ratePct: 6.5, assistance: 0, ownership: "none",
};

const seed = (over: { figures?: Record<string, unknown>[]; matchedThen?: { id: string; name: string }[]; inputs?: Record<string, unknown> } = {}) =>
  build({
    rift_leads: { data: [{ id: "l1", assessment_id: "a1", side: "buy" }] },
    rift_readouts: { data: [{
      id: "r1", side: "buy", inputs: { ...INPUTS, ...(over.inputs ?? {}) },
      matched: over.matchedThen ?? [], created_at: "2026-06-01T00:00:00Z",
    }] },
    rift_figures: { data: over.figures ?? [] },
  });

const got = async () => {
  const r = await compareToSnapshot("l1");
  return ("data" in r ? r.data : null)!;
};

beforeEach(() => { vi.clearAllMocks(); ratePct = 6.5; matched = []; });

describe("a lead with nothing to be honest about", () => {
  it("reports no snapshot rather than an empty comparison that reads like agreement", async () => {
    build({ rift_leads: { data: [{ id: "l1", assessment_id: null, side: "buy" }] } });
    const c = await got();
    expect(c.hasSnapshot).toBe(false);
    expect(c.drifts).toEqual([]);
  });

  it("says so when the assessment exists but no readout was ever stored", async () => {
    build({
      rift_leads: { data: [{ id: "l1", assessment_id: "a1", side: "buy" }] },
      rift_readouts: { data: [] },
    });
    expect((await got()).hasSnapshot).toBe(false);
  });
});

describe("what moved", () => {
  it("finds nothing when nothing changed", async () => {
    seed({ figures: [
      { label: "All-in monthly", value_cents: 283_400, trust_state: "preliminary" },
    ] });
    /* The stored figure is whatever today's engine produces from these inputs,
       so this asserts the comparison is stable rather than asserting a
       constant that would have to be updated whenever the engine improves. */
    const first = await got();
    const monthly = first.drifts.find((d) => d.field === "All-in monthly")!;
    seed({ figures: [
      { label: "All-in monthly", value_cents: Math.round(monthly.now * 100), trust_state: "preliminary" },
    ] });
    const second = await got();
    expect(second.drifts[0]!.deltaPct).toBe(0);
    expect(second.material).toEqual([]);
  });

  it("names the rate when the rate is what moved", async () => {
    seed({ figures: [{ label: "All-in monthly", value_cents: 283_400, trust_state: "preliminary" }] });
    const before = (await got()).drifts[0]!;

    ratePct = 7.4;
    seed({ figures: [{ label: "All-in monthly", value_cents: Math.round(before.now * 100), trust_state: "preliminary" }] });
    const after = (await got()).drifts[0]!;

    expect(after.cause).toContain("6.50%");
    expect(after.cause).toContain("7.40%");
    expect(after.now).toBeGreaterThan(after.was);
    expect(after.material).toBe(true);
  });

  it("names the programmes that stopped matching", async () => {
    matched = [];
    seed({
      matchedThen: [{ id: "p1", name: "Georgia Dream" }, { id: "p2", name: "Atlanta HOME" }],
      figures: [{ label: "Still to find", value_cents: 1_287_500, trust_state: "preliminary" }],
    });
    const c = await got();
    expect(c.lostProgrammes).toEqual(["Georgia Dream", "Atlanta HOME"]);
    expect(c.drifts[0]!.cause).toContain("Georgia Dream");
  });

  /**
   * The one nobody would think to look for. Cash to close depends on neither
   * the rate nor the registry, so if it moves on identical inputs the engine
   * itself changed between the readout and the plan.
   */
  it("catches the arithmetic changing under a figure nothing else explains", async () => {
    seed({ figures: [{ label: "Cash to close", value_cents: 100_000, trust_state: "preliminary" }] });
    const d = (await got()).drifts.find((x) => x.field === "Cash to close")!;
    expect(d.material).toBe(true);
    expect(d.cause).toContain("the arithmetic itself changed");
  });

  it("ignores a stored figure the engine has no counterpart for", async () => {
    seed({ figures: [{ label: "Something retired", value_cents: 500, trust_state: "preliminary" }] });
    expect((await got()).drifts).toEqual([]);
  });
});

describe("a snapshot from an older build", () => {
  it("fills the missing fields from the documented defaults rather than throwing", async () => {
    /* `downPct` did not exist when this snapshot was written. cashToClose
       formats it, so without a default this throws inside a server action at
       the moment the agent presses publish. */
    seed({
      /* null, not undefined: a jsonb column returns null for a field written
         as absent, and null is what a plain spread lets through. */
      inputs: { downPct: null },
      figures: [{ label: "Cash to close", value_cents: 2_787_500, trust_state: "preliminary" }],
    });
    const c = await got();
    expect(c.hasSnapshot).toBe(true);
    expect(c.drifts.length).toBe(1);
    expect(Number.isFinite(c.drifts[0]!.now)).toBe(true);
  });

  it("refuses to compare at all rather than invent a price", async () => {
    seed({ inputs: { price: null }, figures: [{ label: "Cash to close", value_cents: 1, trust_state: "preliminary" }] });
    const c = await got();
    expect(c.hasSnapshot).toBe(true);
    expect(c.drifts).toEqual([]);
  });
});

describe("the seller side", () => {
  it("keeps the snapshot but does not invent a comparison it cannot make", async () => {
    build({
      rift_leads: { data: [{ id: "l1", assessment_id: "a1", side: "sell" }] },
      rift_readouts: { data: [{ id: "r1", side: "sell", inputs: { value: 400_000 }, matched: [], created_at: "2026-06-01T00:00:00Z" }] },
      rift_figures: { data: [{ label: "Net proceeds", value_cents: 100_000, trust_state: "preliminary" }] },
    });
    const c = await got();
    expect(c.hasSnapshot).toBe(true);
    expect(c.drifts).toEqual([]);
  });
});

describe("it fails towards refusing to publish", () => {
  it("does not report a clean comparison when there is no database", async () => {
    db = null as unknown as Fake;
    const r = await compareToSnapshot("l1");
    /* Not `ok` with an empty drift list, which canPublish would wave through. */
    expect("skipped" in r || !r.ok).toBe(true);
  });

  it("scopes the lead read to the signed-in agent", async () => {
    seed();
    await compareToSnapshot("l1");
    expect(db.calls.find((c) => c.table === "rift_leads")!.filters).toContain("eq:agent_id=agent-1");
  });

  it("compares against the newest readout, not whichever came back first", async () => {
    seed();
    await compareToSnapshot("l1");
    const read = db.calls.find((c) => c.table === "rift_readouts")!;
    expect(read.filters).toContain("order:created_at desc");
  });
});
