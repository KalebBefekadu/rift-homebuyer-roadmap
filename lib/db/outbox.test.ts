import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";
import { canonical, type Draft } from "@/lib/core/outbox";

/**
 * The outbox sends a message once (Blueprint v5 §10.2; AUTO-02, AT13).
 *
 * Send read the history, decided the message was approved, asked Brevo for
 * its block list and only then wrote "running". Two presses both read
 * "approved" and both sent. Each step now names its place in the history, and
 * the database refuses a second step claiming the same place
 * (20260929200000); what is asserted here is that the code asks for the right
 * place and stops when it is refused.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));
const sendApproved = vi.fn(async () => ({ ok: true as const, messageId: "m1" }));
vi.mock("./email", () => ({
  blockedContacts: async () => ({ ok: true, codes: new Map() }),
  sendApproved: (...a: unknown[]) => sendApproved(...(a as [])),
}));

const { approveAndSend, edit, outbox } = await import("./outbox");

beforeEach(() => { vi.clearAllMocks(); });

const ID = "11111111-1111-4111-8111-111111111111";
const draft: Draft = { channel: "email", purpose: "program-alert", to: "sam@example.com", name: "Sam", subject: "Georgia Dream has changed", body: "Hi Sam" };
const HASH = createHash("sha256").update(canonical(draft)).digest("hex");
const row = {
  id: ID, lead_id: null, channel: "email", purpose: "program-alert", to_address: draft.to, to_name: draft.name,
  subject: draft.subject, body: draft.body, content_hash: HASH, replaces: null, created_at: "2026-09-28T10:00:00Z",
};
const step = (state: string, seq: number | null, at: string, hash: string | null = null) =>
  ({ outbox_id: ID, state, at, by_name: "Kaleb", hash, detail: null, seq });

const prepared = [step("prepared", 1, "2026-09-28T10:00:00Z")];
const approved = [...prepared, step("approved", 2, "2026-09-28T10:01:00Z", HASH)];

const inserts = () => db.to("insert rift_outbox_events").map((c) => c.payload as { state: string; seq?: number });

describe("sending once", () => {
  it("writes each step at the next place in the history it read", async () => {
    build({ "select rift_outbox": { data: [row] }, "select rift_outbox_events": { data: prepared } });
    const r = await approveAndSend("agent-1", ID, "Kaleb");
    expect(r.ok && "data" in r && r.data.state).toBe("succeeded");
    expect(inserts().map((p) => [p.state, p.seq])).toEqual([["approved", 2], ["running", 3], ["succeeded", 4]]);
    expect(sendApproved).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when another press took the running step first", async () => {
    build({
      "select rift_outbox": { data: [row] },
      "select rift_outbox_events": { data: approved },
      "insert rift_outbox_events": { error: { message: 'duplicate key value violates unique constraint "rift_outbox_events_seq_key"' } },
    });
    const r = await approveAndSend("agent-1", ID, "Kaleb");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/changed a moment ago/);
    expect(inserts()[0]).toMatchObject({ state: "running", seq: 3 });
    expect(sendApproved).not.toHaveBeenCalled();
  });

  it("sends nothing when another press approved it first", async () => {
    build({
      "select rift_outbox": { data: [row] },
      "select rift_outbox_events": { data: prepared },
      "insert rift_outbox_events": { error: { message: 'duplicate key value violates unique constraint "rift_outbox_events_seq_key"' } },
    });
    const r = await approveAndSend("agent-1", ID, "Kaleb");
    expect(r.ok).toBe(false);
    expect(sendApproved).not.toHaveBeenCalled();
  });

  it("reads the one message by its id, and only its own history", async () => {
    build({ "select rift_outbox": { data: [row] }, "select rift_outbox_events": { data: approved } });
    await approveAndSend("agent-1", ID, "Kaleb");
    expect(db.to("select rift_outbox")[0]!.filters).toEqual(expect.arrayContaining([`eq:id=${ID}`, "eq:agent_id=agent-1"]));
    expect(db.to("select rift_outbox_events")[0]!.filters).toEqual(expect.arrayContaining([`in:outbox_id=[${ID}]`, "eq:agent_id=agent-1"]));
  });
});

describe("the list", () => {
  it("reads the history of the messages it shows, not the oldest steps of all of them", async () => {
    build({ "select rift_outbox": { data: [row] }, "select rift_outbox_events": { data: approved } });
    const r = await outbox("agent-1");
    expect(r.ok && "data" in r && r.data?.[0]?.state).toBe("approved");
    expect(db.to("select rift_outbox_events")[0]!.filters).toContain(`in:outbox_id=[${ID}]`);
  });
});

describe("editing", () => {
  it("prepares no second copy when the old one could not be withdrawn", async () => {
    /* It was sent a moment ago in another tab: the cancel is refused, and a
       fresh draft of a message already on its way must not be left waiting. */
    build({
      "select rift_outbox": { data: [row] },
      "select rift_outbox_events": { data: approved },
      "insert rift_outbox_events": { error: { message: 'duplicate key value violates unique constraint "rift_outbox_events_seq_key"' } },
    });
    const r = await edit("agent-1", ID, "Kaleb", "New subject", "New body");
    expect(r.ok).toBe(false);
    expect(db.to("insert rift_outbox")).toHaveLength(0);
  });
});

describe("before migration 20260929200000", () => {
  /* Last in the file: it teaches the module the column is missing. */
  it("reads and writes the steps without their place, rather than failing", async () => {
    build({
      "select rift_outbox": { data: [row] },
      "select rift_outbox_events": (call) => call.filters.some((f) => f.includes(",seq"))
        ? { error: { message: "column rift_outbox_events.seq does not exist" } }
        : { data: approved.map((e) => ({ ...e, seq: undefined })) },
    });
    const r = await approveAndSend("agent-1", ID, "Kaleb");
    expect(r.ok && "data" in r && r.data.state).toBe("succeeded");
    expect(inserts().every((p) => !("seq" in p))).toBe(true);
  });
});
