import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";
import { readSubmission, type Submission } from "@/lib/core/offer-intake";

/**
 * Delivering an offer somebody submitted.
 *
 * The failure that would make this feature worse than not having it: telling a
 * stranger their offer was delivered when it was not. It is a document with a
 * deadline attached, sent by somebody who then stops chasing it.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

let leadResult: unknown = { ok: true, data: { id: "lead-9", score: { score: 1, band: "now", signals: [] } } };
vi.mock("./leads", () => ({ captureLead: async () => leadResult }));

const { submitOffer, inboundOffers } = await import("./offer-intake");

const SUB: Submission = (() => {
  const r = readSubmission({
    address: "119 Peachtree Way, Atlanta, GA 30309",
    price: 410_000, concessions: 8_000, repairCredit: 0, earnest: 5_000,
    financing: "conventional", closeOn: "2026-11-14",
    contingencies: ["Inspection"], preapproval: true, proofOfFunds: false,
    from: "Dana Whitfield", email: "dana@example.com", phone: "404-555-0199",
    firm: "Whitfield & Co", note: "Flexible.", representing: "buyer",
  });
  if (!r.ok) throw new Error("fixture is invalid");
  return r.value;
})();

beforeEach(() => {
  vi.clearAllMocks();
  leadResult = { ok: true, data: { id: "lead-9", score: { score: 1, band: "now", signals: [] } } };
});

describe("writing the offer", () => {
  it("stores money in cents, because the rest of the table does", async () => {
    build({ rift_offers: { data: [{ id: "o1" }] } });
    await submitOffer(SUB);
    const write = db.calls.find((c) => c.verb === "insert")!;
    const row = write.payload as Record<string, unknown>;
    expect(row.price_cents).toBe(41_000_000);
    expect(row.concessions_cents).toBe(800_000);
    expect(row.earnest_cents).toBe(500_000);
  });

  it("marks it as having come from outside, so Studio can tell them apart", async () => {
    build({ rift_offers: { data: [{ id: "o1" }] } });
    await submitOffer(SUB);
    const row = db.calls.find((c) => c.verb === "insert")!.payload as Record<string, unknown>;
    expect(row.source).toBe("inbound");
    expect(row.property_address).toBe(SUB.address);
    /* No seller lead: the form takes any Georgia address on purpose. */
    expect(row.lead_id).toBeNull();
  });

  it("reports delivered only when the offer row actually landed", async () => {
    build({ rift_offers: { data: [{ id: "o1" }] } });
    const good = await submitOffer(SUB);
    expect("data" in good && good.data.delivered).toBe(true);
  });

  it("does not claim delivery when there is no database", async () => {
    db = null as unknown as Fake;
    const r = await submitOffer(SUB);
    expect("skipped" in r).toBe(true);
    /* And the reason says what a person can do about it. */
    if ("skipped" in r) expect(r.reason).toMatch(/nothing was passed on/i);
  });

  it("does not claim delivery when the write fails", async () => {
    build({ rift_offers: { error: { message: "nope" } } });
    const r = await submitOffer(SUB);
    expect(r.ok).toBe(false);
  });
});

describe("the relationship it produces", () => {
  it("still delivers the offer when the lead write does not land", async () => {
    /* The offer is what the sender came to deliver. Losing the lead costs the
       business something; losing the offer costs a stranger a deadline. */
    leadResult = { ok: false, error: "lead write failed" };
    build({ rift_offers: { data: [{ id: "o1" }] } });
    const r = await submitOffer(SUB);
    expect("data" in r && r.data.delivered).toBe(true);
    expect("data" in r && r.data.leadId).toBeNull();
  });

  it("links the offer back to the person who sent it when both landed", async () => {
    build({ rift_offers: { data: [{ id: "o1" }] } });
    await submitOffer(SUB);
    const link = db.calls.find((c) => c.verb === "update")!;
    expect((link.payload as Record<string, unknown>).submitter_lead_id).toBe("lead-9");
  });
});

describe("reading them back", () => {
  it("asks only for offers that came through the form", async () => {
    build({ rift_offers: { data: [] } });
    await inboundOffers();
    const read = db.calls.find((c) => c.verb === "select")!;
    expect(read.filters).toContain("eq:source=inbound");
    expect(read.filters).toContain("eq:agent_id=agent-1");
  });

  it("turns cents back into money exactly once", async () => {
    build({ rift_offers: { data: [{
      id: "o1", property_address: "1 Main St", offered_by: "Dana",
      submitted_email: "d@e.com", submitted_phone: null, submitted_firm: null,
      representing: "buyer", price_cents: 41_000_000, concessions_cents: 800_000,
      repair_credit_cents: 0, earnest_cents: 500_000, financing: "conventional",
      close_on: null, contingencies: [], preapproval: true, proof_of_funds: false,
      note: null, submitter_lead_id: "lead-9", created_at: "2026-09-21T00:00:00Z",
    }] } });
    const r = await inboundOffers();
    const list = ("data" in r ? r.data : [])!;
    expect(list[0]!.price).toBe(410_000);
    expect(list[0]!.concessions).toBe(8_000);
  });

  it("says nothing rather than an empty list when it cannot read", async () => {
    db = null as unknown as Fake;
    const r = await inboundOffers();
    expect("skipped" in r).toBe(true);
  });
});
