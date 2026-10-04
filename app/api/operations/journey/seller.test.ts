import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The sale's offer and step writes from the journey page: only known fields,
 * each as its own type, reach the op; anything else is refused before it.
 */
const sellerOp = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
vi.mock("@/app/(operations)/operations/journey/ops", () => ({
  sellerOp,
  startJourney: vi.fn(),
  relabelJourney: vi.fn(),
  saveBrief: vi.fn(),
  approveSearch: vi.fn(),
  confirmSearchSetUp: vi.fn(),
  pauseSearch: vi.fn(),
  inviteMember: vi.fn(),
  newInviteLink: vi.fn(),
  withdrawAccess: vi.fn(),
  addShortlistHome: vi.fn(),
  takeHomeOff: vi.fn(),
  requestShowing: vi.fn(),
  recordShowingStep: vi.fn(),
  recordShowingAnswer: vi.fn(),
  moveStage: vi.fn(),
  setJourneyStatus: vi.fn(),
  openContract: vi.fn(),
  closeContract: vi.fn(),
  updateWork: vi.fn(),
  documentSlot: vi.fn(),
  documentFinish: vi.fn(),
  openBid: vi.fn(),
  bidStep: vi.fn(),
  bidAnswerForThem: vi.fn(),
  addDate: vi.fn(),
  reviseDate: vi.fn(),
  amendDates: vi.fn(),
  reconcile: vi.fn(),
  recordMoney: vi.fn(),
  linkJourneys: vi.fn(),
  dependencyHappened: vi.fn(),
  recordPricing: vi.fn(),
  recordProceeds: vi.fn(),
  listingHappened: vi.fn(),
  showingStep: vi.fn(),
  weeklyReview: vi.fn(),
}));
vi.mock("@/lib/db/guard", () => ({
  limited: () => null,
  readJson: async (req: Request) => ({ ok: true, body: await req.json() }),
}));

const { POST } = await import("./route");
const call = (body: object) => POST(new Request("http://rift.test/api/operations/journey", {
  method: "POST", headers: { host: "rift.test", origin: "http://rift.test", "content-type": "application/json" },
  body: JSON.stringify({ op: "seller", journeyId: "j1", ...body }),
}));

beforeEach(() => sellerOp.mockClear());

describe("the seller op", () => {
  it("passes an offer through with only its known terms, as numbers and booleans", async () => {
    await call({ kind: "offer-record", offer: { from: "A buyer", price: 400000, financing: "fha", preapproval: true, sneaky: "x", agent_id: "other" } });
    expect(sellerOp).toHaveBeenCalledWith("j1", { kind: "offer-record", offer: {
      from: "A buyer", price: 400000, concessions: 0, repairCredit: 0, earnest: 0, financing: "fha",
      closeOn: null, preapproval: true, proofOfFunds: false, contingencies: [], note: null,
    } });
  });

  it("refuses a financing or an owner it does not know, without calling the op", async () => {
    expect((await call({ kind: "offer-record", offer: { from: "A", price: 1, financing: "crypto" } })).status).toBe(400);
    expect((await call({ kind: "step-add", title: "Photos", owner: "nobody" })).status).toBe(400);
    expect((await call({ kind: "drop-table" })).status).toBe(400);
    expect(sellerOp).not.toHaveBeenCalled();
  });

  it("never takes whose offers they are from the page: only the journey", async () => {
    await call({ kind: "take-withdraw", leadId: "someone-else" });
    expect(sellerOp).toHaveBeenCalledWith("j1", { kind: "take-withdraw" });
  });
});
