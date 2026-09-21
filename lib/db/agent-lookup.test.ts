import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The lookup every write in the product gates on.
 *
 * It used to remember a TIMEOUT as "no agent exists" for ten seconds. The
 * first query on a fresh serverless instance pays for the connection and
 * routinely overran the two-second deadline, so every cold start opened with a
 * window in which leads, offers and bookings were skipped — and the booking
 * form rendered "done" over a request that reached nobody. Found on
 * production by a health check returning 503 once and then 200 eight times.
 */

type Reply = "ok" | "empty" | "error" | "hang";
let replies: Reply[] = [];
let calls = 0;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => {
          calls++;
          const r = replies.shift() ?? "ok";
          if (r === "hang") return new Promise(() => {});
          if (r === "error") return Promise.resolve({ data: null, error: { message: "fetch failed" } });
          if (r === "empty") return Promise.resolve({ data: [], error: null });
          return Promise.resolve({ data: [{ id: "agent-1" }], error: null });
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));
vi.mock("@/lib/core/timeout", async (orig) => ({
  ...(await orig<typeof import("@/lib/core/timeout")>()),
  READ_DEADLINE_MS: 20,
}));

async function fresh() {
  vi.resetModules();
  process.env.SUPABASE_URL = "http://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://db.test";
  return import("./service");
}

beforeEach(() => { replies = []; calls = 0; });

describe("currentAgentId on a cold instance", () => {
  it("retries a first query that overruns, instead of giving up", async () => {
    const svc = await fresh();
    replies = ["hang", "ok"];
    expect(await svc.currentAgentId()).toBe("agent-1");
    expect(calls).toBe(2);
  });

  it("never remembers a timeout as absence", async () => {
    /* THE BUG. Both attempts time out; the very next call must ask again
       rather than answer "no agent" from memory for ten seconds. */
    const svc = await fresh();
    replies = ["hang", "hang"];
    // The second attempt has a longer deadline; cap the test's patience.
    const first = await Promise.race([
      svc.currentAgentId(),
      new Promise<string | null>((r) => setTimeout(() => r("still waiting"), 4500)),
    ]);
    expect(first === null || first === "still waiting").toBe(true);

    replies = ["ok"];
    const before = calls;
    expect(await svc.currentAgentId()).toBe("agent-1");
    expect(calls).toBeGreaterThan(before);
  }, 12_000);

  it("never remembers a transport error as absence", async () => {
    const svc = await fresh();
    replies = ["error"];
    expect(await svc.currentAgentId()).toBeNull();
    replies = ["ok"];
    expect(await svc.currentAgentId()).toBe("agent-1");
  });

  it("does remember a genuinely empty table, because that is a fact", async () => {
    const svc = await fresh();
    replies = ["empty"];
    expect(await svc.currentAgentId()).toBeNull();
    const before = calls;
    replies = ["ok"];
    expect(await svc.currentAgentId()).toBeNull();
    expect(calls).toBe(before);
  });
});
