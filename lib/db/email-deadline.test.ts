import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * Every call to Brevo carries a deadline.
 *
 * The transactional send had none. It sits behind a visitor's Save button,
 * after their lead is stored, and inside the nurture run, so a hung
 * connection meant a visitor who retried was stored twice and a run that
 * stopped partway with the rest of the queue never attempted.
 */

vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

/* FROM_EMAIL is read when the module loads, so the environment comes first. */
vi.stubEnv("BREVO_API_KEY", "test-key");
vi.stubEnv("BREVO_FROM_EMAIL", "agent@example.com");
const { sendSavedPlan, sendDailySummary, SEND_DEADLINE_MS } = await import("./email");

const calls: RequestInit[] = [];
beforeEach(() => { calls.length = 0; });
afterAll(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("the transactional send", () => {
  it("is given a deadline", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(JSON.stringify({ messageId: "m1" }), { status: 201 });
    }));
    const r = await sendDailySummary("agent@example.com", { subject: "Today", html: "<p>Today</p>" });
    expect(r).toEqual({ ok: true, messageId: "m1" });
    expect(calls[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(SEND_DEADLINE_MS).toBeLessThanOrEqual(15_000);
  });

  it("reports a timeout as a failure, never as sent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }));
    const r = await sendSavedPlan({ to: "sam@example.com", name: "Sam", planUrl: "https://example.com/saved/x", review: false, values: [] });
    expect(r.ok).toBe(false);
  });
});
