import { describe, it, expect, vi } from "vitest";
import { fakeDb, type Fake } from "./test/fake-db";
import type { Membership } from "./portal";

/**
 * A seller's answer to the pricing (S04) needs the same access that shows
 * the pricing: "Price and fees". Without it the page never shows the
 * opinion, and the write must not accept an answer to something unseen.
 */

let db: Fake;
vi.mock("./service", () => ({ serviceClient: () => db, currentAgentId: async () => "agent-1" }));

const { respondToPricing } = await import("./seller");

const OPINION = "00000000-0000-4000-8000-0000000000a1";
const seller = (over: Partial<Membership> = {}): Membership => ({
  memberId: "m1", journeyId: "j1", agentId: "agent-1", role: "buyer", scopes: ["search", "homes", "money"],
  name: "Sam", journeyLabel: "Sale of 12 Oak St", side: "sell", agentName: "Kaleb", agentEmail: null, ...over,
});

describe("a seller answering the pricing", () => {
  const answers = () => fakeDb({
    "select rift_pricing_opinions": { data: [{ id: OPINION, version: 2, journey_id: "j1" }], error: null },
    "insert rift_pricing_responses": { data: { id: "r1" }, error: null },
  });

  it("is recorded with price and fees", async () => {
    db = answers();
    expect((await respondToPricing(seller(), OPINION, "agree", null)).ok).toBe(true);
    expect(db.to("insert rift_pricing_responses")).toHaveLength(1);
  });

  it("is refused without price and fees, and writes nothing", async () => {
    db = answers();
    const r = await respondToPricing(seller({ scopes: ["search", "homes"] }), OPINION, "agree", null);
    expect(r.ok).toBe(false);
    expect(db.to("insert rift_pricing_responses")).toHaveLength(0);
  });

  it("is refused for somebody who can only look", async () => {
    db = answers();
    expect((await respondToPricing(seller({ role: "viewer" }), OPINION, "discuss", "Too low")).ok).toBe(false);
  });
});
