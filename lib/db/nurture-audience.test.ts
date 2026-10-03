import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The follow-up a seller, and a buyer abroad, are owed.
 *
 * Sequences are chosen by band, so a seller in the "soon" band was sent the
 * buyer's "What actually moves your closing date". The queue was well formed
 * and the words were about somebody else's purchase; nothing failed.
 *
 * What is asserted: the audience is read from what the person saved (a plan's
 * side, falling back to the lead's), it decides the copy the queue carries,
 * and a step with no honest version for them comes out of the queue marked
 * with its reason rather than carrying the buyer's words.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { due, skipStep } = await import("./nurture");
const { SEQUENCES } = await import("@/lib/core/nurture");

const NOW = new Date("2026-09-24T12:00:00Z");
const step = (id: string) => SEQUENCES.flatMap((s) => s.steps).find((s) => s.id === id)!;

const PLAN = (side: "buy" | "sell" | "abroad") => ({
  mode: "save", side, savedOn: "2026-09-01",
  values: [{ tool: side === "sell" ? "proceeds" : "cash", label: "x", figure: "$1", href: side === "sell" ? "/sell/proceeds" : "/buy/cash-to-close" }],
  answers: { county: "Cobb" },
});

/* Entered `days` ago, with the steps in `sent` already out. */
const enrolment = (id: string, o: { side: "buy" | "sell"; plan?: unknown; band?: string; days: number; sent?: string[] }) => ({
  id: `e-${id}`, lead_id: id, band: o.band ?? "soon",
  entered_at: new Date(NOW.getTime() - o.days * 86_400_000).toISOString(), phone_consent: false,
  rift_leads: {
    name: id, email: `${id}@example.com`, assessment_id: null, side: o.side,
    plan: o.plan ?? null, plan_token: o.plan ? `tok-${id}` : null, plan_saved_at: o.plan ? "2026-09-01T12:00:00Z" : null,
  },
  rift_touches: (o.sent ?? []).map((s) => ({ step_id: s })),
});

const queue = async (rows: unknown[]) => {
  build({
    "select rift_enrolments": { data: rows, error: null },
    "select rift_journeys": { data: [], error: null },
  });
  const q = await due(NOW);
  expect(q.ok, !q.ok ? q.error : "").toBe(true);
  return new Map((q.ok && "data" in q ? q.data : []).map((t) => [t.leadId, t]));
};

beforeEach(() => vi.clearAllMocks());

describe("the queue writes to who it is for", () => {
  it("gives a seller who saved a plan the seller's words, not the closing-date email", async () => {
    const t = (await queue([enrolment("seller", { side: "sell", plan: PLAN("sell"), days: 3, sent: ["s1"] })])).get("seller")!;
    const sell = step("s2").sell!;
    expect(t.stepId).toBe("s2");
    expect(t.audience).toBe("sell");
    expect(t.skip).toBeNull();
    expect("says" in sell && t.says).toBe("says" in sell ? sell.says : "");
    expect(t.says).not.toMatch(/closing date/i);
  });

  it("reads the audience from the plan's side before the lead's", async () => {
    /* The save route files a buyer from abroad as a buyer: the plan is where
       the difference is kept. */
    const t = (await queue([enrolment("far", { side: "buy", plan: PLAN("abroad"), days: 3, sent: ["s1"] })])).get("far")!;
    expect(t.audience).toBe("abroad");
    expect(t.says).not.toBe(step("s2").says);
  });

  it("falls back to the lead's side when there is no plan to say otherwise", async () => {
    const t = (await queue([enrolment("noplan", { side: "sell", days: 3, sent: ["s1"] })])).get("noplan")!;
    expect(t.audience).toBe("sell");
    expect(t.kind).toBe("resume");
    expect(t.says).not.toMatch(/closing date/i);
  });

  it("marks a step with no seller version as skipped for them, with its reason", async () => {
    /* s3 is the rates text: day 9, after s1 and s2. */
    const t = (await queue([enrolment("seller", { side: "sell", plan: PLAN("sell"), days: 10, sent: ["s1", "s2"] })])).get("seller")!;
    expect(t.stepId).toBe("s3");
    expect(t.skip).toMatch(/^Not sent: .*mortgage rates/);
  });

  it("does not send a buyer from abroad the programs email, and says why", async () => {
    const t = (await queue([enrolment("far", { side: "buy", plan: PLAN("abroad"), band: "now", days: 7, sent: ["n1", "n2", "n3"] })])).get("far")!;
    expect(t.stepId).toBe("n4");
    expect(t.skip).toMatch(/live in the home/);
  });

  it("leaves a buyer's queue exactly as it was", async () => {
    const t = (await queue([enrolment("buyer", { side: "buy", plan: PLAN("buy"), days: 3, sent: ["s1"] })])).get("buyer")!;
    expect(t.audience).toBe("buy");
    expect(t.skip).toBeNull();
    expect(t.says).toBe(step("s2").says);
    expect(t.body).toBe(step("s2").body);
  });

  it("records a skipped step with its reason, once, so it is not owed again", async () => {
    const t = (await queue([enrolment("seller", { side: "sell", plan: PLAN("sell"), days: 10, sent: ["s1", "s2"] })])).get("seller")!;
    build({ "insert rift_touches": { data: [], error: null }, "update rift_touches": { data: [], error: null } });
    const r = await skipStep(t, t.skip!);
    expect(r.ok && "data" in r && r.data).toEqual({ recorded: true });
    expect(db.to("insert rift_touches")[0]!.payload).toMatchObject({ enrolment_id: "e-seller", step_id: "s3" });
    expect(db.to("update rift_touches")[0]!.payload).toMatchObject({ outcome: "skipped", detail: t.skip });
  });

  it("writes nothing when another worker already holds the step", async () => {
    build({ "insert rift_touches": { error: { message: "duplicate key value", code: "23505" } } });
    const r = await skipStep({ enrolmentId: "e1", stepId: "s3", channel: "text", downgraded: null }, "Not sent: x");
    expect(r.ok && "data" in r && r.data).toEqual({ recorded: false });
    expect(db.to("update rift_touches")).toHaveLength(0);
  });

  it("does not mistake a plan with no side for a buyer's when the lead is selling", async () => {
    const odd = { ...PLAN("sell"), side: undefined };
    const t = (await queue([enrolment("odd", { side: "sell", plan: odd, days: 3, sent: ["s1"] })])).get("odd")!;
    expect(t.audience).toBe("sell");
  });
});
