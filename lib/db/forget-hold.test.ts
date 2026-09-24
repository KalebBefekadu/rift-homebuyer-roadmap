import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * "Delete all of it" for somebody who became a client (W11, AT36).
 *
 * The privacy page promises one exception: a transaction record is kept. A
 * journey with a contract on it is held whole, with its lead, closed to
 * sign-in and its plan link revoked; a journey without one goes. Either way
 * the copies providers hold go too: the person's sign-in account, when it
 * belongs to no other live journey, and Brevo's log of the emails sent to
 * them. Which parts the broker requires kept is still owed (D06, F16).
 */

let db: Fake & { auth: { admin: { deleteUser: ReturnType<typeof vi.fn> } } };
const deleteUser = vi.fn(async () => ({ error: null as { message: string } | null }));
const build = (answers: Answers = {}) => {
  db = Object.assign(fakeDb(answers), { auth: { admin: { deleteUser } } });
  return db;
};

vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));
const removeJourneyFiles = vi.fn(async () => ({ ok: true, data: { removed: 0 } }));
vi.mock("./documents", () => ({ removeJourneyFiles: (...a: unknown[]) => removeJourneyFiles(...(a as [])) }));
const forgetAtBrevo = vi.fn(async () => ({ ok: true }));
vi.mock("./email", () => ({ forgetAtBrevo: (...a: unknown[]) => forgetAtBrevo(...(a as [])) }));
vi.mock("./recovery", () => ({ markAbandoned: vi.fn() }));

const { forget } = await import("./retention");

beforeEach(() => { vi.clearAllMocks(); });

const base: Answers = {
  "select rift_assessments": { data: [{ id: "a1" }], error: null },
  "select rift_leads": (c) => c.filters.some((f) => f.startsWith("select:email"))
    ? { data: [{ email: "sam@example.com" }], error: null }
    : { data: [{ id: "l1" }], error: null },
  "select rift_journeys": { data: [{ id: "j-bought", origin_lead_id: "l1" }, { id: "j-other", origin_lead_id: "l1" }], error: null },
  "select rift_journey_members": (c) => c.filters.some((f) => f.startsWith("in:journey_id"))
    ? { data: [{ id: "m1", journey_id: "j-bought", auth_user_id: "u1" }], error: null }
    : { data: [], error: null },
};

describe("a person with a contract on file", () => {
  it("holds the journey with the contract, and deletes the one without", async () => {
    build({ ...base, "select rift_transactions": { data: [{ journey_id: "j-bought" }], error: null } });
    const r = await forget("session-1");
    expect(r.ok && "data" in r && r.data.held).toBe(1);

    const del = db.to("delete rift_journeys");
    expect(del).toHaveLength(1);
    expect(del[0]!.filters).toContain("in:id=[j-other]");
    expect(removeJourneyFiles).toHaveBeenCalledWith("agent-1", ["j-other"]);
  });

  it("keeps the held record's lead, closes it to sign-in and revokes its plan link", async () => {
    build({ ...base, "select rift_transactions": { data: [{ journey_id: "j-bought" }], error: null } });
    await forget("session-1");

    expect(db.to("delete rift_leads")).toHaveLength(0);
    const revoke = db.to("update rift_journey_members")[0];
    expect(revoke!.filters).toEqual(expect.arrayContaining(["in:journey_id=[j-bought]", "is:revoked_at=null"]));
    expect(db.to("update rift_leads")[0]!.payload).toEqual({ client_token: null });
    expect(db.to("update rift_enrolments")[0]!.payload).toMatchObject({ stop_reason: "unsubscribed" });
    /* The held record keeps its address with it; nothing to remove at Brevo. */
    expect(forgetAtBrevo).not.toHaveBeenCalled();
  });

  it("removes their sign-in account when it belongs to no other live journey", async () => {
    build({ ...base, "select rift_transactions": { data: [{ journey_id: "j-bought" }], error: null } });
    await forget("session-1");
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("keeps a sign-in account that another live journey still uses", async () => {
    build({
      ...base,
      "select rift_transactions": { data: [], error: null },
      "select rift_journey_members": (c) => c.filters.some((f) => f.startsWith("in:journey_id"))
        ? { data: [{ id: "m1", journey_id: "j-other", auth_user_id: "u1" }], error: null }
        : { data: [{ id: "m9" }], error: null },
    });
    await forget("session-1");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("stops, so it can be retried, when a sign-in account cannot be removed", async () => {
    deleteUser.mockResolvedValueOnce({ error: { message: "network error" } });
    build({ ...base, "select rift_transactions": { data: [], error: null } });
    const r = await forget("session-1");
    expect(r.ok).toBe(false);
    expect(db.to("delete rift_journeys")).toHaveLength(0);
  });
});

describe("a person with no contract", () => {
  it("deletes every journey and the lead, and removes Brevo's log of their emails", async () => {
    build({ ...base, "select rift_transactions": { data: [], error: null } });
    const r = await forget("session-1");
    expect(r.ok && "data" in r && r.data).toMatchObject({ held: 0 });
    expect(db.to("delete rift_journeys")[0]!.filters).toContain("in:id=[j-bought,j-other]");
    expect(db.to("delete rift_leads")).toHaveLength(1);
    expect(forgetAtBrevo).toHaveBeenCalledWith("sam@example.com");
  });

  it("still deletes them when Brevo cannot be reached", async () => {
    forgetAtBrevo.mockResolvedValueOnce({ ok: false, error: "Brevo 503" } as never);
    build({ ...base, "select rift_transactions": { data: [], error: null } });
    const r = await forget("session-1");
    expect(r.ok).toBe(true);
    expect(db.to("delete rift_leads")).toHaveLength(1);
  });
});
