import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Capture, from the outside: what a stranger's request can make the server
 * store, and what it can make the server send.
 */

const seen: { captured: Record<string, unknown>[]; readouts: Record<string, unknown>[] } = { captured: [], readouts: [] };

vi.mock("@/lib/db/leads", () => ({
  captureLead: async (input: Record<string, unknown>) => {
    seen.captured.push(input);
    return { ok: true, data: { id: "lead-1", score: { band: "now", score: 80, headline: "h", action: "a", signals: [] } } };
  },
}));
vi.mock("@/lib/db/email", () => ({
  sendReadout: async (r: Record<string, unknown>) => { seen.readouts.push(r); return { ok: true }; },
  sendNewLead: async () => ({ ok: true }),
}));
vi.mock("@/lib/db/service", () => ({ currentAgentEmail: async () => "agent@example.com" }));
vi.mock("@/lib/db/calendar", () => ({ book: async () => ({ ok: true, id: "b" }) }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: () => {} }));

const { POST } = await import("./route");
const { reset } = await import("@/lib/core/ratelimit");

const post = (body: Record<string, unknown>) =>
  POST(new Request("https://rift.test/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify({ email: "person@example.com", lead: { side: "buy" }, ...body }),
  }));

beforeEach(() => { seen.captured = []; seen.readouts = []; reset(); });

describe("POST /api/capture: the session a lead is filed under", () => {
  it("keeps a session the browser minted for itself", async () => {
    await post({ sessionId: "s-mfx1k2ab-4fzyo82m" });
    expect(seen.captured[0]!.sessionId).toBe("s-mfx1k2ab-4fzyo82m");
  });

  it("stores no session rather than the placeholder every storage-less browser shares", async () => {
    /* Filed under "anon", this lead would be erased by any stranger's delete
       button, and would erase theirs. */
    const res = await post({ sessionId: "anon" });
    expect((await res.json()).stored).toBe(true);
    expect(seen.captured[0]!.sessionId).toBeUndefined();
  });
});
