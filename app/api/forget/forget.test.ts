import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Delete all of it", from the outside.
 *
 * The endpoint takes a session id from anybody, which is safe only while a
 * session id names one browser. The placeholder a browser without storage
 * sends names all of them.
 */

const calls: { forget: string[]; byPlan: string[] } = { forget: [], byPlan: [] };

vi.mock("@/lib/db/retention", () => ({
  forget: async (s: string) => { calls.forget.push(s); return { ok: true, data: { deleted: 1, held: 0 } }; },
  forgetByPlan: async (t: string) => { calls.byPlan.push(t); return { ok: true, data: { deleted: 1, held: 0 } }; },
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: () => {} }));

const { POST } = await import("./route");
const { reset } = await import("@/lib/core/ratelimit");

const post = (body: unknown) =>
  POST(new Request("https://rift.test/api/forget", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  }));

beforeEach(() => { calls.forget = []; calls.byPlan = []; reset(); });

describe("POST /api/forget", () => {
  it("erases a session a browser minted for itself", async () => {
    const res = await post({ sessionId: "s-mfx1k2ab-4fzyo82m" });
    expect(await res.json()).toMatchObject({ ok: true, deleted: 1 });
    expect(calls.forget).toEqual(["s-mfx1k2ab-4fzyo82m"]);
  });

  it("never erases by the placeholder every storage-less browser shares", async () => {
    for (const sessionId of ["anon", "ssr"]) {
      const res = await post({ sessionId });
      expect(res.status).toBe(400);
      expect((await res.json()).ok).toBe(false);
    }
    expect(calls.forget).toEqual([]);
  });

  it("still erases by a saved plan's link", async () => {
    const res = await post({ planToken: "abcdefghijklmnopqrstuv", sessionId: "anon" });
    expect((await res.json()).ok).toBe(true);
    expect(calls.byPlan).toEqual(["abcdefghijklmnopqrstuv"]);
    expect(calls.forget).toEqual([]);
  });
});
