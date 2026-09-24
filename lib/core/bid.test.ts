import { describe, expect, it } from "vitest";
import {
  EMPTY_TERMS, NEXT, bidStepError, buyerBidLine, bidView, resolve, responseError, termsDiff, termsEffects, termsError,
  type BidContext, type BidResponse, type BidStatus, type BidStep, type Terms,
} from "./bid";

const T: Terms = { ...EMPTY_TERMS, price: 400_000, earnestMoney: 5_000, downPct: 10, concessions: 6_000, closingDate: "2026-10-30" };
const DEVON = { memberId: "m1", name: "Devon" };
const SAM = { memberId: "m2", name: "Sam" };
const OK: BidContext = { covered: true, coverageNote: "", homeWithdrawn: false, deciders: 2 };

let n = 0;
const step = (kind: BidStep["kind"], version: number, extra: Partial<BidStep> = {}): BidStep => ({
  seq: ++n, kind, version, terms: null, origin: null, required: [], documentIds: [], note: null, by: "Kaleb",
  at: `2026-09-2${Math.min(n, 9)}T12:00:00Z`, ...extra,
});
const ours = (version: number, t: Terms = T) => step("terms", version, { terms: t, origin: "ours" });
const theirs = (version: number, t: Terms) => step("terms", version, { terms: t, origin: "theirs" });
const ask = (version: number) => step("ask", version, { required: [DEVON, SAM] });
const said = (m: { memberId: string; name: string }, version: number, instruction: BidResponse["instruction"], at = "2026-09-25T00:00:00Z"): BidResponse =>
  ({ memberId: m.memberId, name: m.name, version, instruction, note: instruction === "proceed" ? null : "because", toldAgent: null, at });

describe("terms", () => {
  it("wants whole dollars and a sourced deadline", () => {
    expect(termsError(T)).toBeNull();
    expect(termsError({ ...T, price: 400_000.5 })).toMatch(/whole dollars/);
    expect(termsError({ ...T, earnestMoney: 500_000 })).toMatch(/no more than the price/);
    expect(termsError({ ...T, respondBy: "2026-09-26T21:00:00Z" })).toMatch(/where the response deadline comes from/);
    expect(termsError({ ...T, financing: "cash", financingContingency: true })).toMatch(/cash offer has no financing contingency/);
  });

  it("computes only arithmetic on the terms, never closing costs", () => {
    expect(termsEffects(T)).toEqual({
      downPayment: 40_000, loanAmount: 360_000, priceAfterConcessions: 394_000,
      cashAtContract: 5_000, cashAtClosingBeforeCosts: 29_000,
    });
    expect(termsEffects({ ...T, financing: "cash", financingContingency: false }).loanAmount).toBe(0);
  });

  it("says what a counter changed, in words", () => {
    const diff = termsDiff(T, { ...T, price: 410_000, dueDiligenceDays: 7 });
    expect(diff.map((d) => `${d.label}: ${d.before} to ${d.after}`)).toEqual([
      "Price: $400,000 to $410,000", "Due diligence period: 10 days to 7 days",
    ]);
  });
});

describe("an answer belongs to one version (AT22)", () => {
  it("stops counting old answers once a counter makes a new version, and keeps them", () => {
    const responses = [said(DEVON, 2, "proceed"), said(SAM, 2, "proceed")];
    const steps = [ours(1), ask(1), step("prepared", 1), step("signed", 1, { note: "x" }), step("submitted", 1, { note: "x" }),
      theirs(2, { ...T, price: 415_000 }), ask(2)];
    expect(bidView(steps, responses, "Kaleb").status).toBe("instructed");
    const v3 = [...steps, ours(3, { ...T, price: 410_000 }), ask(3)];
    const view = bidView(v3, responses, "Kaleb");
    expect(view.status).toBe("awaiting");
    expect(view.asked!.resolution.answers).toHaveLength(0);
    expect(responses).toHaveLength(2);
  });

  it("refuses an answer to a version that is no longer current", () => {
    const view = bidView([ours(1), ask(1), ours(2, { ...T, price: 405_000 }), ask(2)], [], "Kaleb");
    expect(responseError(view, "m1", 1, "proceed", null)).toMatch(/changed since you opened/);
    expect(responseError(view, "m1", 2, "proceed", null)).toBeNull();
  });
});

describe("nobody answers for the household (AT23)", () => {
  it("is a disagreement when one says go ahead and the other does not, whoever was first", () => {
    for (const order of [[said(DEVON, 1, "proceed", "a"), said(SAM, 1, "stop", "b")], [said(SAM, 1, "stop", "a"), said(DEVON, 1, "proceed", "b")]]) {
      expect(resolve([DEVON, SAM], order, 1).state).toBe("disagree");
    }
  });

  it("needs everyone whose say was asked for", () => {
    const r = resolve([DEVON, SAM], [said(DEVON, 1, "proceed")], 1);
    expect(r).toMatchObject({ state: "waiting", waitingOn: ["Sam"] });
    expect(resolve([DEVON, SAM], [said(DEVON, 1, "proceed"), said(SAM, 1, "proceed")], 1).state).toBe("agreed");
  });

  it("counts each person's latest answer on the version", () => {
    const r = resolve([DEVON], [said(DEVON, 1, "stop", "2026-09-25T01:00:00Z"), said(DEVON, 1, "proceed", "2026-09-25T02:00:00Z")], 1);
    expect(r.state).toBe("agreed");
  });

  it("will not let the agent prepare the forms while they disagree", () => {
    const view = bidView([ours(1), ask(1)], [said(DEVON, 1, "proceed"), said(SAM, 1, "change")], "Kaleb");
    expect(view.status).toBe("disagreement");
    expect(bidStepError(view, { kind: "prepared" }, OK)).toMatch(/cannot be marked prepared/);
  });

  it("takes answers only from the people asked", () => {
    const view = bidView([ours(1), ask(1)], [], "Kaleb");
    expect(responseError(view, "stranger", 1, "proceed", null)).toMatch(/not one this offer was waiting for/);
  });
});

describe("go ahead is an instruction, not a signature (AT24)", () => {
  it("leaves drafted, signed, submitted and accepted as separate steps, each with evidence", () => {
    const agreed = bidView([ours(1), ask(1)], [said(DEVON, 1, "proceed"), said(SAM, 1, "proceed")], "Kaleb");
    expect(agreed.status).toBe("instructed");
    expect(NEXT.instructed).not.toContain("signed");
    expect(NEXT.instructed).not.toContain("submitted");
    expect(NEXT.instructed).not.toContain("accepted");
    const prepared = bidView([ours(1), ask(1), step("prepared", 1)], [], "Kaleb");
    expect(bidStepError(prepared, { kind: "signed" }, OK)).toMatch(/what shows it was signed/);
    expect(bidStepError(prepared, { kind: "signed", note: "Both signed in Remine" }, OK)).toBeNull();
  });

  it("tells the buyer accepted is not yet a contract", () => {
    const view = bidView([ours(1), ask(1), step("prepared", 1), step("signed", 1), step("submitted", 1), step("accepted", 1)], [], "Kaleb");
    expect(buyerBidLine(view, "Kaleb")).toMatch(/becomes a contract once Kaleb confirms the signed agreement/);
    expect(buyerBidLine(bidView([ours(1), ask(1)], [said(DEVON, 1, "proceed"), said(SAM, 1, "proceed")], "Kaleb"), "Kaleb")).toMatch(/nothing is signed or sent yet/);
  });

  it("says accepted is not a contract", () => {
    const view = bidView([ours(1), ask(1), step("prepared", 1), step("signed", 1), step("submitted", 1), step("accepted", 1)], [], "Kaleb");
    expect(view.status).toBe("accepted");
    expect(view.nextStep).toMatch(/Accepted is not a contract/);
    expect(view.final).toBe(true);
  });
});

describe("the steps an offer can take", () => {
  it("checks the agreement at every step toward a contract, never when recording their answer", () => {
    const lapsed = { ...OK, covered: false, coverageNote: "The agreement expired yesterday." };
    const submitted = bidView([ours(1), ask(1), step("prepared", 1), step("signed", 1), step("submitted", 1)], [], "Kaleb");
    expect(bidStepError(bidView([ours(1)], [], "Kaleb"), { kind: "ask" }, lapsed)).toMatch(/signed buyer agreement.*expired yesterday/);
    expect(bidStepError(submitted, { kind: "rejected", note: "They took another offer" }, lapsed)).toBeNull();
    expect(bidStepError(submitted, { kind: "terms", origin: "theirs", terms: { ...T, price: 420_000 } }, lapsed)).toBeNull();
  });

  it("takes a counter only after ours went out", () => {
    const drafting = bidView([ours(1)], [], "Kaleb");
    expect(bidStepError(drafting, { kind: "terms", origin: "theirs", terms: T }, OK)).toMatch(/after our offer was submitted/);
  });

  it("will not ask a household nobody can answer for", () => {
    expect(bidStepError(bidView([ours(1)], [], "Kaleb"), { kind: "ask" }, { ...OK, deciders: 0 })).toMatch(/Add the buyer under Household/);
  });

  it("never moves a finished offer", () => {
    for (const end of ["accepted", "rejected", "expired", "withdrawn"] as BidStatus[]) {
      const view = bidView([ours(1), step(end as BidStep["kind"], 1)], [], "Kaleb");
      expect(bidStepError(view, { kind: "withdrawn", note: "x" }, OK)).toMatch(/finished/);
    }
  });
});
