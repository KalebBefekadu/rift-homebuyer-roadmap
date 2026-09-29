import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * An agent row is not enough to be the agent: it must be the row every write
 * is filed under. Until 20260929100000 any login could insert its own row
 * through PostgREST; this is the second lock behind that policy.
 */

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T,>(f: T) => f }));

const state = { row: { id: "agent-kaleb", name: "Kaleb", email: "k@example.com" } as Record<string, string> | null, theAgent: "agent-kaleb" as string | null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "u@example.com" } }, error: null }) } }),
}));

vi.mock("./service", () => ({
  currentAgentId: async () => state.theAgent,
  serviceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) }) }),
  }),
}));

const { agentSession } = await import("./session");

beforeEach(() => {
  state.row = { id: "agent-kaleb", name: "Kaleb", email: "k@example.com" };
  state.theAgent = "agent-kaleb";
});

describe("the agent session", () => {
  it("is signed in when the login's row is the agent", async () => {
    const s = await agentSession();
    expect(s.state).toBe("signed-in");
  });

  it("refuses a login whose own row is not the agent every write is filed under", async () => {
    state.row = { id: "agent-stranger", name: "Stranger", email: "s@example.com" };
    const s = await agentSession();
    expect(s).toEqual({ state: "signed-out", reason: "signed in, but not the agent on this account" });
  });

  it("does not send anybody to sign-in when the agent cannot be confirmed", async () => {
    state.theAgent = null;
    const s = await agentSession();
    expect(s.state).toBe("unknown");
  });
});
