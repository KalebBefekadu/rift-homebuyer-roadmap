import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";
import { RECOMMENDATION_MARKER } from "@/lib/core/offer-room";

/**
 * The offer room's data layer: what it asks for, and what it refuses to trust.
 *
 * The constraints themselves are proven against real Postgres in
 * schema.test.ts. This proves the reasoning above them — that the seller's
 * read never carries Rift's draft, that the draft and the snapshot are built
 * here rather than accepted from a form, and that two taps make one choice.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const mod = await import("./offer-room");

const OFFER_ID = "11111111-1111-4111-8111-111111111111";
const released = {
  id: OFFER_ID, offered_by: "Whitfield", price_cents: 40_000_000, concessions_cents: 0,
  repair_credit_cents: 0, earnest_cents: 500_000, financing: "conventional", close_on: "2026-10-17",
  contingencies: [], preapproval: true, proof_of_funds: false, note: null,
  released_at: "2026-09-20T10:00:00Z", created_at: "2026-09-20T09:00:00Z",
};

beforeEach(() => { vi.clearAllMocks(); });

describe("the seller's read", () => {
  it("never selects Rift's draft", async () => {
    /* The draft is an internal document. A page that "just does not render
       it" is one component change from rendering it. */
    build({ "select rift_offer_rooms": { data: null } });
    await mod.clientRoomFor("l1");
    const select = db.to("select rift_offer_rooms")[0]!.filters.find((f) => f.startsWith("select:"))!;
    expect(select).not.toMatch(/prepared/);
    expect(select).not.toMatch(/client_note/);
  });

  it("renders an empty room, not a broken page, before the migration lands", async () => {
    build({ "select rift_offer_rooms": { error: { message: 'relation "rift_offer_rooms" does not exist' } } });
    const r = await mod.clientRoomFor("l1");
    expect(r.ok && "data" in r && r.data.take).toBeNull();
  });

  it("does not paper over any other failure", async () => {
    build({ "select rift_offer_rooms": { error: { message: "fetch failed" } } });
    const r = await mod.clientRoomFor("l1");
    expect(r.ok).toBe(false);
  });
});

describe("approving a take", () => {
  const withOffer: Answers = {
    "select rift_offers": { data: [released] },
    "select rift_leads": (call) => call.filters.some((f) => f.startsWith("select:payoff"))
      ? { data: { payoff_cents: 18_000_000, commission_pct: 5 } }
      : { data: { id: "l1" } },
  };

  it("refuses while the recommendation is still the placeholder, and writes nothing", async () => {
    build(withOffer);
    const r = await mod.approveTake("l1", `Some facts.\n\n${RECOMMENDATION_MARKER}`);
    expect(r.ok).toBe(false);
    expect(db.to("upsert rift_offer_rooms")).toHaveLength(0);
  });

  it("records the draft Rift computed, not one the form sent, and the offers it covers", async () => {
    build(withOffer);
    const r = await mod.approveTake("l1", "I would take Whitfield.");
    expect(r.ok).toBe(true);
    const row = db.to("upsert rift_offer_rooms")[0]!.payload as Record<string, unknown>;
    expect(row.prepared).toMatch(/one offer in front of you: Whitfield/);
    expect(row.take).toBe("I would take Whitfield.");
    expect(row.approved_for).toEqual([OFFER_ID]);
    expect(row.agent_id).toBe("agent-1");
  });

  it("will not create a room on a seller who is not his", async () => {
    build({ ...withOffer, "select rift_leads": { data: null } });
    const r = await mod.approveTake("l1", "I would take Whitfield.");
    expect(r.ok).toBe(false);
    expect(db.to("upsert rift_offer_rooms")).toHaveLength(0);
  });
});

describe("the seller choosing", () => {
  const base: Answers = {
    "select rift_leads": { data: { agent_id: "agent-1", name: "Nadia Okafor", side: "sell", payoff_cents: 18_000_000, commission_pct: 5 } },
    "select rift_offers": { data: [released] },
    "select rift_offer_rooms": { data: null },
  };

  it("claims the choice only where nobody has chosen yet", async () => {
    /* Two taps on a slow phone must make one choice. The guard is in the
       WHERE clause, because a read-then-write lets both through. */
    build({ ...base, "update rift_offer_rooms": { data: [{ lead_id: "l1" }] } });
    const r = await mod.chooseOffer("l1", OFFER_ID, "Go ahead");
    expect(r.ok).toBe(true);
    const upd = db.to("update rift_offer_rooms")[0]!;
    expect(upd.filters).toContain("is:chosen_offer_id=null");
    expect(db.to("insert rift_offer_rooms")).toHaveLength(0);
  });

  it("builds the snapshot itself", async () => {
    build({ ...base, "update rift_offer_rooms": { data: [{ lead_id: "l1" }] } });
    await mod.chooseOffer("l1", OFFER_ID, null);
    const seen = (db.to("update rift_offer_rooms")[0]!.payload as { chosen_seen: { from: string; net: number } }).chosen_seen;
    expect(seen.from).toBe("Whitfield");
    expect(typeof seen.net).toBe("number");
  });

  it("inserts when there is no room yet, and reads a lost race as already chosen", async () => {
    build({
      ...base,
      "update rift_offer_rooms": { data: [] },
      "insert rift_offer_rooms": { error: { message: "duplicate key value violates unique constraint", code: "23505" } },
    });
    const r = await mod.chooseOffer("l1", OFFER_ID, null);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/already told your agent/);
  });

  it("refuses an offer that is not released on this seller", async () => {
    build(base);
    const r = await mod.chooseOffer("l1", "22222222-2222-4222-8222-222222222222", null);
    expect(r.ok).toBe(false);
    expect(db.to("update rift_offer_rooms")).toHaveLength(0);
  });

  it("refuses on a buyer", async () => {
    build({ ...base, "select rift_leads": { data: { agent_id: "agent-1", name: "B", side: "buy", payoff_cents: null, commission_pct: null } } });
    const r = await mod.chooseOffer("l1", OFFER_ID, null);
    expect(r.ok).toBe(false);
  });
});
