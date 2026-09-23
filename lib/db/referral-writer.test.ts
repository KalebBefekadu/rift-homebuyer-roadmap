import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Resolving a `?r=` handle to the person who handed it out.
 *
 * The back half of the writer that `rift_leads.referred_by` never had. What
 * matters here is what it must refuse: another agent's client, somebody
 * crediting themselves, and a handle that does not resolve: the last of which
 * must not cost the capture it arrived with, because losing a lead over an
 * unrecorded referral would be an absurd trade.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { resolveReferrer, firstRefFor } = await import("./attribution");

beforeEach(() => { vi.clearAllMocks(); });

describe("resolveReferrer", () => {
  it("finds a client by their referral token", async () => {
    build({ "select rift_leads": { data: { id: "lead-9", session_id: "other" } } });
    expect(await resolveReferrer("abc123")).toBe("lead-9");
  });

  it("scopes the lookup to this agent", async () => {
    /* The service client bypasses RLS, so this filter is the only thing
       stopping one agent's client from crediting another agent's pipeline. */
    build({ "select rift_leads": { data: null } });
    await resolveReferrer("abc123");
    expect(db.calls[0]!.filters).toContain("eq:agent_id=agent-1");
  });

  it("falls through to a shared readout when the handle is not a client token", async () => {
    /* product.md: a friend who runs their own assessment off a shared readout
       is credited to the sharer "exactly like a referral". */
    let nth = 0;
    build({
      "select rift_leads": () => (++nth === 1
        ? { data: null }                                    // not a referral token
        : { data: { id: "sharer-1", session_id: "theirs" } }), // the lead behind the readout
      "select rift_readouts": { data: { assessment_id: "assess-1" } },
    });
    expect(await resolveReferrer("sharetoken")).toBe("sharer-1");
    expect(db.to("select rift_readouts")[0]!.filters).toContain("eq:share_token=sharetoken");
  });

  it("returns nothing for a handle that matches neither", async () => {
    build({
      "select rift_leads": { data: null },
      "select rift_readouts": { data: null },
    });
    expect(await resolveReferrer("nonsense")).toBeNull();
  });

  it("refuses a handle that is not token-shaped without asking the database", async () => {
    build();
    expect(await resolveReferrer("<script>")).toBeNull();
    expect(db.calls).toHaveLength(0);
  });

  it("refuses an empty handle", async () => {
    build();
    for (const bad of [null, undefined, ""]) {
      expect(await resolveReferrer(bad)).toBeNull();
    }
    expect(db.calls).toHaveLength(0);
  });

  it("never credits somebody for referring themselves", async () => {
    /* The common innocent case: a buyer opens the readout they were sent,
       changes a number and fills the form again. Without this the advocacy
       figure quietly fills with people who referred themselves. */
    build({ "select rift_leads": { data: { id: "lead-9", session_id: "same-browser" } } });
    expect(await resolveReferrer("abc123", { excludeSessionId: "same-browser" })).toBeNull();
  });

  it("still credits when the sessions genuinely differ", async () => {
    build({ "select rift_leads": { data: { id: "lead-9", session_id: "hers" } } });
    expect(await resolveReferrer("abc123", { excludeSessionId: "his" })).toBe("lead-9");
  });

  it("does not treat two missing sessions as the same person", async () => {
    /* Both null is not a match. Every lead captured before session ids existed
       has a null session, and matching on that would make one of them the
       referrer of everybody. */
    build({ "select rift_leads": { data: { id: "lead-9", session_id: null } } });
    expect(await resolveReferrer("abc123", { excludeSessionId: undefined })).toBe("lead-9");
    build({ "select rift_leads": { data: { id: "lead-9", session_id: null } } });
    expect(await resolveReferrer("abc123", { excludeSessionId: "" })).toBe("lead-9");
  });

  it("survives a failed lookup rather than throwing into the capture", async () => {
    build({
      "select rift_leads": { error: { message: "timeout" } },
      "select rift_readouts": { error: { message: "timeout" } },
    });
    expect(await resolveReferrer("abc123")).toBeNull();
  });
});

describe("firstRefFor", () => {
  it("reads the handle off the session's first touch", async () => {
    build({ "select rift_attributions": { data: { first_ref: "abc123" } } });
    expect(await firstRefFor("sess-1")).toBe("abc123");
    expect(db.calls[0]!.filters).toContain("eq:session_id=sess-1");
  });

  it("returns nothing for a session with no referral on it", async () => {
    build({ "select rift_attributions": { data: { first_ref: null } } });
    expect(await firstRefFor("sess-1")).toBeNull();
  });

  it("returns nothing for a session that was never recorded", async () => {
    build({ "select rift_attributions": { data: null } });
    expect(await firstRefFor("sess-1")).toBeNull();
  });

  it("does not ask without a session", async () => {
    build();
    expect(await firstRefFor("")).toBeNull();
    expect(db.calls).toHaveLength(0);
  });
});

describe("with no database", () => {
  it("resolves to nothing rather than throwing", async () => {
    vi.resetModules();
    vi.doMock("./service", () => ({ serviceClient: () => null, currentAgentId: async () => null }));
    const mod = await import("./attribution");
    expect(await mod.resolveReferrer("abc123")).toBeNull();
    expect(await mod.firstRefFor("sess-1")).toBeNull();
    vi.doUnmock("./service");
    vi.resetModules();
  });
});
