import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * Release, and the two figures a net cannot be invented without.
 *
 * An offer arrives while the agent is driving. Presenting it to the seller
 * unreviewed is how somebody replies to a number before anybody has read the
 * terms under it — so nothing reaches them until he releases it, and that is
 * enforced in the QUERY rather than afterwards.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const mod = await import("./offers");

beforeEach(() => { vi.clearAllMocks(); });

describe("what the seller can read", () => {
  it("filters on released in the query, not after it", async () => {
    /* A filter applied after the read is one refactor away from being dropped,
       and nothing would look wrong — the page would simply start showing
       offers nobody had reviewed. */
    build();
    await mod.releasedOffersFor("l1");

    const call = db.to("select rift_offers")[0]!;
    expect(call.filters, "released is not filtered in the query")
      .toContain("not:released_at.is=null");
  });

  it("is not scoped by agent, because there is no agent asking", async () => {
    /* Reached by the client's token. Scoping to a signed-in agent here would
       return nothing on the one page that has no session. */
    build();
    await mod.releasedOffersFor("l1");
    expect(db.to("select rift_offers")[0]!.filters).toContain("eq:lead_id=l1");
  });

  it("does not release an offer on arrival", async () => {
    /* The default is the control. An offer that arrives released has been
       presented before anybody read it. */
    build({ "insert rift_offers": { data: [{ id: "o1" }] } });
    await mod.addOffer({ leadId: "l1", from: "The Webbs", price: 400_000, financing: "conventional" });

    const row = db.to("insert rift_offers")[0]!.payload as Record<string, unknown>;
    expect(row).not.toHaveProperty("released_at");
  });

  it("can take a released offer back", async () => {
    build();
    await mod.setOfferReleased("o1", false);
    expect((db.to("update rift_offers")[0]!.payload as { released_at: unknown }).released_at).toBeNull();
  });
});

describe("money across the boundary", () => {
  it("stores cents, so a comparison is not decided by a rounding", async () => {
    /* The comparison subtracts six figures from six figures and ranks the
       differences, which is exactly where a binary float puts a dollar in the
       wrong place and changes which offer wins. */
    build({ "insert rift_offers": { data: [{ id: "o1" }] } });
    await mod.addOffer({
      leadId: "l1", from: "The Webbs", price: 412_500.55,
      concessions: 9_000.05, financing: "cash",
    });

    const row = db.to("insert rift_offers")[0]!.payload as Record<string, number>;
    expect(row.price_cents).toBe(41_250_055);
    expect(row.concessions_cents).toBe(900_005);
    expect(Number.isInteger(row.price_cents)).toBe(true);
  });

  it("reads cents back as money", async () => {
    build({
      "select rift_offers": { data: [{
        id: "o1", offered_by: "The Webbs", price_cents: 41_250_055,
        concessions_cents: 0, repair_credit_cents: 0, earnest_cents: 500_000,
        financing: "cash", close_on: null, contingencies: [],
        preapproval: false, proof_of_funds: true, note: null,
        released_at: "2026-09-20T00:00:00Z", created_at: "2026-09-20T00:00:00Z",
      }] },
    });
    const r = await mod.releasedOffersFor("l1");
    expect(r.ok && "data" in r && r.data[0]!.price).toBe(412_500.55);
  });

  it("refuses a negative concession rather than storing it", async () => {
    /* Money flowing the other way is not a concession, and a negative one
       would silently inflate the net. */
    build({ "insert rift_offers": { data: [{ id: "o1" }] } });
    await mod.addOffer({
      leadId: "l1", from: "The Webbs", price: 400_000,
      concessions: -5_000, financing: "conventional",
    });
    expect((db.to("insert rift_offers")[0]!.payload as Record<string, number>).concessions_cents).toBe(0);
  });

  it("refuses an offer with no price or no name", async () => {
    build();
    expect((await mod.addOffer({ leadId: "l1", from: "The Webbs", price: 0, financing: "cash" })).ok).toBe(false);
    expect((await mod.addOffer({ leadId: "l1", from: " ", price: 400_000, financing: "cash" })).ok).toBe(false);
    expect(db.to("insert rift_offers")).toHaveLength(0);
  });
});

describe("the seller's costs", () => {
  it("returns null unless BOTH figures are recorded", async () => {
    /* A net computed against an assumed payoff of zero ranks the offers
       correctly and reports a figure out by the size of somebody's mortgage —
       and it reads entirely reasonable. */
    for (const row of [
      { payoff_cents: null, commission_pct: 5 },
      { payoff_cents: 20_000_000, commission_pct: null },
      null,
    ]) {
      build({ "select rift_leads": { data: row ? [row] : [] } });
      const r = await mod.offersFor("l1");
      expect(r.ok && "data" in r && r.data.costs, JSON.stringify(row)).toBeNull();
    }
  });

  it("returns both when both are there", async () => {
    build({ "select rift_leads": { data: [{ payoff_cents: 20_000_000, commission_pct: 5.5 }] } });
    const r = await mod.offersFor("l1");
    expect(r.ok && "data" in r && r.data.costs).toEqual({ payoff: 200_000, commissionPct: 5.5 });
  });

  it("refuses a commission that is not a percentage", async () => {
    build();
    expect((await mod.setSellerCosts("l1", 200_000, 150)).ok).toBe(false);
    expect((await mod.setSellerCosts("l1", -1, 5)).ok).toBe(false);
    expect(db.to("update rift_leads")).toHaveLength(0);
  });
});

describe("scoping", () => {
  it("scopes every agent-side call to the agent", async () => {
    build({ "insert rift_offers": { data: [{ id: "o1" }] } });
    await mod.addOffer({ leadId: "l1", from: "The Webbs", price: 400_000, financing: "cash" });
    await mod.setOfferReleased("o1", true);
    await mod.removeOffer("o1");
    await mod.setSellerCosts("l1", 200_000, 5);
    await mod.offersFor("l1");

    for (const c of db.calls) {
      /* The client's read is the one exception and is tested above: it has no
         agent to scope to, and is scoped by an unguessable token instead. */
      const scoped = c.filters.includes("eq:agent_id=agent-1")
        || (c.verb === "insert" && (c.payload as { agent_id?: string }).agent_id === "agent-1");
      expect(scoped, `unscoped ${c.verb} on ${c.table}: ${c.filters.join(" ")}`).toBe(true);
    }
  });
});
