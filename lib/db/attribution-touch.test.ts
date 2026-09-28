import { describe, it, expect, vi } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Recording a visit's first and last touch.
 *
 * Two requests from one session can both find no row: two tabs opened at
 * once, or a page and its prefetch. The second insert then hits the primary
 * key, and it used to come back as a failed write, captured as an incident,
 * with the visit's last touch never recorded.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { captureTouch } = await import("./attribution");

const touch = { source: "google", medium: "cpc", campaign: null, referrer: "google.com", landing: "/buy", ref: null };

describe("a first visit that lost the race", () => {
  it("is recorded as a return visit, never as a failure, and never rewrites first touch", async () => {
    build({
      "select rift_attributions": { data: null },
      "insert rift_attributions": { error: { message: 'duplicate key value violates unique constraint "rift_attributions_pkey"' } },
    });
    const r = await captureTouch("s-abc-123", touch as never);
    expect(r.ok && "data" in r && r.data).toEqual({ first: false, visits: 2 });
    const update = db.to("update rift_attributions")[0]!;
    expect(update.filters).toContain("eq:session_id=s-abc-123");
    expect(Object.keys(update.payload as object).some((k) => k.startsWith("first_"))).toBe(false);
  });

  it("still fails on anything else", async () => {
    build({ "select rift_attributions": { data: null }, "insert rift_attributions": { error: { message: "permission denied" } } });
    const r = await captureTouch("s-abc-123", touch as never);
    expect(r.ok).toBe(false);
    expect(db.to("update rift_attributions")).toHaveLength(0);
  });
});

describe("a session every storage-blocked browser shared", () => {
  it("is not attributed at all", async () => {
    build();
    const r = await captureTouch("anon", touch as never);
    expect(r.ok && "skipped" in r).toBe(true);
    expect(db.calls).toHaveLength(0);
  });
});
