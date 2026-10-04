import { describe, expect, it } from "vitest";
import { EMPTY_TERMS, type BidStep, type BidResponse, type Terms } from "./bid";
import { financingLabel } from "./offers";
import {
  answered, bidItem, countItems, inboundItem, orderItems, sellerItem, streetOf, termChips, type BidInput, type OfferItem, type SellerInput,
} from "./offer-board";

const NOW = new Date("2026-09-30T16:00:00Z");

const terms = (over: Partial<Terms> = {}): Terms => ({ ...EMPTY_TERMS, price: 430_000, financing: "fha", closingDate: "2026-11-01", ...over });
const step = (seq: number, kind: BidStep["kind"], over: Partial<BidStep> = {}): BidStep => ({
  seq, kind, version: 1, terms: null, origin: null, required: [], documentIds: [], note: null, by: "Kaleb", at: `2026-09-2${seq}T15:00:00Z`, ...over,
});
const bid = (steps: BidStep[], over: Partial<BidInput> = {}, responses: BidResponse[] = []): BidInput => ({
  journeyId: "j1", leadId: "l1", person: "Rachel Kim", address: "2240 Pebblebrook Dr SE, Smyrna, GA", steps, responses,
  agentFirst: "Kaleb", hasContract: false, createdAt: "2026-09-20T15:00:00Z", ...over,
});

describe("a buyer's offer on the board", () => {
  const sent = [step(1, "terms", { terms: terms({ respondBy: "2026-10-01T03:22:00Z", respondBySource: "Offer paragraph 14" }), origin: "ours" })];

  it("says the terms in words, never the financing code", () => {
    const i = bidItem(bid(sent))!;
    expect(i.terms).toContain("FHA loan");
    expect(i.terms).not.toMatch(/\bfha\b/);
    expect(i.terms).toContain("$430,000");
  });

  it("is the agent's to move while it is a draft, and waits on the other side once submitted", () => {
    expect(bidItem(bid(sent))!.waitingOn).toBe("you");
    const submitted = [...sent, step(2, "ask"), step(3, "prepared"), step(4, "signed"), step(5, "submitted")];
    const i = bidItem(bid(submitted))!;
    expect(i.waitingOn).toBe("other side");
    expect(i.stands.word).toBe("Submitted");
  });

  it("names the household when it is waiting on them", () => {
    const asked = [...sent, step(2, "ask", { required: [{ memberId: "m1", name: "Rachel Kim" }] })];
    const i = bidItem(bid(asked))!;
    expect(i.waitingOn).toBe("client");
    expect(i.needs).toContain("Rachel Kim");
  });

  it("takes the deadline from the terms, as the Georgia day, with where it comes from", () => {
    /* 03:22 UTC on 1 October is the evening of 30 September in Georgia. */
    expect(bidItem(bid(sent))!.by).toEqual({ day: "2026-09-30", basis: "Offer paragraph 14" });
  });

  it("drops an offer that has ended, and keeps an accepted one until its contract is recorded", () => {
    const rejected = [...sent, step(2, "ask"), step(3, "prepared"), step(4, "signed"), step(5, "submitted"), step(6, "rejected", { note: "No" })];
    expect(bidItem(bid(rejected))).toBeNull();
    const accepted = [...rejected.slice(0, 5), step(6, "accepted", { note: "Seller signed" })];
    const open = bidItem(bid(accepted))!;
    expect(open.waitingOn).toBe("you");
    expect(open.stands.tone).toBe("pos");
    expect(bidItem(bid(accepted, { hasContract: true }))).toBeNull();
  });
});

describe("a seller's offers on the board", () => {
  const offer = (id: string, price: number, released: boolean) => ({ id, from: `Buyer ${id}`, price, releasedAt: released ? "2026-09-25T12:00:00Z" : null, createdAt: "2026-09-24T12:00:00Z" });
  const base = (over: Partial<SellerInput> = {}): SellerInput => ({
    leadId: "s1", journeyId: "j9", person: "Patricia Moore", address: "5120 Lost Mountain Rd", offers: [offer("a", 478_000, true), offer("b", 482_000, true)], room: null, ...over,
  });

  it("asks the agent to release before anything else", () => {
    const i = sellerItem(base({ offers: [offer("a", 478_000, true), offer("b", 455_000, false)] }))!;
    expect(i.waitingOn).toBe("you");
    expect(i.stands.word).toBe("Some not shown yet");
    expect(i.needs).toContain("1 of 2");
  });

  it("asks for the agent's take once everything released has been seen, and again when the set changes", () => {
    expect(sellerItem(base())!.stands.word).toBe("Needs your take");
    const stale = base({ room: { approvedAt: "2026-09-26T12:00:00Z", approvedFor: ["a"], chosenOfferId: null, chosenAt: null } });
    expect(sellerItem(stale)!.needs).toMatch(/changed since you wrote your take/);
    const current = base({ room: { approvedAt: "2026-09-26T12:00:00Z", approvedFor: ["b", "a"], chosenOfferId: null, chosenAt: null } });
    const i = sellerItem(current)!;
    expect(i.waitingOn).toBe("seller");
    expect(i.stands.word).toBe("With the seller");
  });

  it("makes a choice the agent's to answer, and says it is not an acceptance", () => {
    const chosen = base({ room: { approvedAt: "2026-09-26T12:00:00Z", approvedFor: ["a", "b"], chosenOfferId: "b", chosenAt: "2026-09-28T12:00:00Z" } });
    const i = sellerItem(chosen)!;
    expect(i.waitingOn).toBe("you");
    expect(i.needs).toMatch(/not an acceptance/i);
    expect(i.since).toBe("2026-09-28T12:00:00Z");
  });

  it("has no item for a seller with no offers", () => {
    expect(sellerItem(base({ offers: [] }))).toBeNull();
  });
});

describe("an offer that came in through the form", () => {
  const inbound = (over = {}) => ({
    id: "o1", address: "88 Wren Ct, Tucker, GA", from: "Tony Alvarez, Keller Williams", firm: "Keller Williams Realty", price: 380_000,
    financing: "va", financingOther: null, at: "2026-09-27T12:00:00Z", submitterLeadId: "l5", repliedAt: null, listing: null, ...over,
  });

  it("takes a recorded answer over the lead's reply, either way", () => {
    /* Answered by phone: the lead has no reply on record. */
    expect(inboundItem(inbound({ answer: { answered: true, respondBy: null } })).stands.word).toBe("Replied");
    /* An unrelated reply to the lead does not answer the offer once the agent says it does not. */
    expect(inboundItem(inbound({ repliedAt: "2026-09-28T12:00:00Z", answer: { answered: false, respondBy: null } })).stands.word).toBe("Needs a reply");
    expect(inboundItem(inbound({ repliedAt: "2026-09-28T12:00:00Z" })).stands.word).toBe("Replied");
  });

  it("carries the sender's deadline while it is unanswered, and drops it once answered", () => {
    expect(inboundItem(inbound({ answer: { answered: false, respondBy: "2026-09-30" } })).by).toEqual({ day: "2026-09-30", basis: "the sender's deadline, as you recorded it" });
    expect(inboundItem(inbound({ answer: { answered: true, respondBy: "2026-09-30" } })).by).toBeNull();
  });

  it("is labelled with the loan, not the code", () => {
    expect(inboundItem(inbound()).terms).toBe("$380,000 · VA");
    expect(inboundItem(inbound({ financing: "other", financingOther: "Seller financing" })).terms).toContain("Other: Seller financing");
  });

  it("needs a reply until the person behind it has been answered since it arrived", () => {
    expect(inboundItem(inbound()).waitingOn).toBe("you");
    expect(inboundItem(inbound({ repliedAt: "2026-09-26T12:00:00Z" })).waitingOn).toBe("you");
    expect(inboundItem(inbound({ repliedAt: "2026-09-28T12:00:00Z" })).waitingOn).toBe("other side");
    expect(answered("2026-09-27T12:00:00Z", null)).toBe(false);
  });
});

describe("the order and the counts", () => {
  const item = (key: string, waitingOn: OfferItem["waitingOn"], by: string | null, side: OfferItem["side"] = "buying"): OfferItem => ({
    key, side, person: key, personHref: null, href: "", address: "", terms: "", stands: { word: "x", tone: "none" }, needs: "",
    waitingOn, by: by ? { day: by, basis: null } : null, since: null, onListing: null,
  });

  it("puts what is waiting on the agent first, then the soonest date, undated last", () => {
    const order = orderItems([
      item("client-soon", "client", "2026-10-01"), item("me-undated", "you", null), item("me-soon", "you", "2026-10-02"), item("me-sooner", "you", "2026-10-01"),
    ]).map((i) => i.key);
    expect(order).toEqual(["me-sooner", "me-soon", "me-undated", "client-soon"]);
  });

  it("counts what is waiting on whom and what is due within three days, counting a passed date", () => {
    const c = countItems([
      item("a", "you", "2026-09-29"), item("b", "client", "2026-10-02"), item("c", "other side", "2026-11-01"), item("d", "you", null, "inbound"),
    ], NOW);
    expect(c).toMatchObject({ all: 4, waitingOnYou: 2, waitingOnOthers: 2, dueSoon: 2, buying: 3, inbound: 1 });
  });
});

describe("what a person reads", () => {
  it("does not print a financing code", () => {
    for (const code of ["cash", "conventional", "fha", "va", "usda", "other"]) {
      expect(financingLabel(code)).not.toBe(code);
    }
  });

  it("says the due diligence period once, and the closing date as a date", () => {
    const chips = termChips({
      financing: "fha", financingOther: null, closeOn: "2026-11-13", dueDiligenceDays: 14, earnest: 5000,
      contingencies: ["Due diligence 14 days", "Financing", "Appraisal"],
    }, NOW);
    expect(chips).toEqual(["FHA", "Closes Nov 13, 2026 (in 44 days)", "14 days due diligence", "$5,000 earnest", "Financing", "Appraisal"]);
  });

  it("matches a listing by its street, whatever follows it", () => {
    expect(streetOf("1402 Briarcliff Rd NE, Atlanta, GA 30306")).toBe(streetOf("1402 Briarcliff Rd. NE"));
  });
});
