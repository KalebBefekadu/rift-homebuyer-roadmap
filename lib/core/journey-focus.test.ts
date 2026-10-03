import { describe, expect, it } from "vitest";
import { agoWords, dueWords, journeyAttention, stageFocus, tabCounts, type FocusInput } from "./journey-focus";

const base: FocusInput = {
  side: "buy", stage: "search", status: "active", statusReason: null, nobodyInvited: false,
  missedDates: [], uncheckedDates: [], blocked: [], stageNudge: null, search: "active-confirmed",
  tours: [], bids: [], listing: null, sellerOffers: null, prep: null, leadNext: null, today: "2026-09-30",
};

describe("dueWords", () => {
  it("says days, never an invented hour", () => {
    expect(dueWords("2026-09-27", "2026-09-30")).toEqual({ text: "3 days overdue", days: -3 });
    expect(dueWords("2026-09-29", "2026-09-30").text).toBe("1 day overdue");
    expect(dueWords("2026-09-30", "2026-09-30").text).toBe("due today");
    expect(dueWords("2026-10-01", "2026-09-30").text).toBe("due tomorrow");
    expect(dueWords("2026-10-04", "2026-09-30").text).toBe("due in 4 days");
  });
});

describe("agoWords", () => {
  it("reads recent days as words and older ones as nothing, so the caller shows the date", () => {
    expect(agoWords("2026-09-30", "2026-09-30")).toBe("today");
    expect(agoWords("2026-09-29", "2026-09-30")).toBe("yesterday");
    expect(agoWords("2026-09-20", "2026-09-30")).toBe("10 days ago");
    expect(agoWords("2026-07-01", "2026-09-30")).toBeNull();
    expect(agoWords("2026-10-01", "2026-09-30")).toBe("tomorrow");
  });
});

describe("journeyAttention", () => {
  it("is empty when nothing waits", () => {
    expect(journeyAttention(base)).toEqual([]);
  });

  it("reports an approved search that was never set up in Matrix (was invisible)", () => {
    const a = journeyAttention({ ...base, search: "manual-action-needed" });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ word: "Matrix", tab: "search", severity: "warn" });
  });

  it("stops asking about the search once there is a contract", () => {
    expect(journeyAttention({ ...base, stage: "under-contract", search: "draft" })).toEqual([]);
  });

  it("asks for a brief only before touring", () => {
    expect(journeyAttention({ ...base, stage: "tour", search: "draft" })).toEqual([]);
    expect(journeyAttention({ ...base, stage: "search", search: "draft" })).toHaveLength(1);
  });

  it("puts what went wrong before what is his to do before what he waits on", () => {
    const a = journeyAttention({
      ...base, search: "awaiting-approval",
      tours: [{ id: "t1", address: "1 Oak", status: "awaiting-confirmation", blocked: null, overdue: false }],
      blocked: [{ label: "Repairs", note: "No answer" }],
      leadNext: { text: "Send listings", due: "2026-10-05" },
    });
    expect(a.map((x) => x.severity)).toEqual(["neg", "warn", "info", "info"]);
    expect(a[0]!.word).toBe("Blocked");
  });

  it("marks the lead's own next action overdue when its day has passed", () => {
    const a = journeyAttention({ ...base, leadNext: { text: "Send listings", due: "2026-09-27" } });
    expect(a[0]).toMatchObject({ severity: "neg", word: "Overdue", detail: "Your next action, 3 days overdue" });
  });

  it("separates an offer that needs him from one he is waiting on", () => {
    const a = journeyAttention({
      ...base, stage: "offer",
      bids: [
        { id: "b1", address: "A", status: "countered", nextStep: "Ask the household how to answer the counter.", final: false },
        { id: "b2", address: "B", status: "submitted", nextStep: "Waiting for the listing side.", final: false },
        { id: "b3", address: "C", status: "rejected", nextStep: "Finished.", final: true },
      ],
    });
    expect(a.map((x) => [x.word, x.severity])).toEqual([["Offer", "warn"], ["Waiting", "info"]]);
  });

  it("a paused journey says why and nothing else", () => {
    const a = journeyAttention({ ...base, status: "paused", statusReason: "Delayed until October", blocked: [{ label: "x", note: null }] });
    expect(a).toHaveLength(1);
    expect(a[0]!.text).toBe("Paused: Delayed until October");
  });

  it("a finished journey owes nothing", () => {
    expect(journeyAttention({ ...base, status: "completed", blocked: [{ label: "x", note: null }] })).toEqual([]);
    expect(journeyAttention({ ...base, status: "cancelled", nobodyInvited: true })).toEqual([]);
  });

  it("a sale asks for offers to be shown, and for preparation due within three days", () => {
    const a = journeyAttention({
      ...base, side: "sell", stage: "offers", search: null,
      sellerOffers: { unreleased: 2, chosen: false },
      prep: [{ id: "p1", title: "Photographer booked", dueOn: "2026-10-02" }, { id: "p2", title: "Later", dueOn: "2026-11-02" }],
    });
    expect(a.map((x) => x.key)).toEqual(["release", "prep:p1"]);
  });

  it("counts only what needs him, per tab", () => {
    const a = journeyAttention({
      ...base, search: "manual-action-needed",
      tours: [{ id: "t", address: "1 Oak", status: "awaiting-confirmation", blocked: null, overdue: false }],
    });
    expect(tabCounts(a)).toEqual({ search: 1 });
  });
});

describe("stageFocus", () => {
  it("has a job for every stage on both sides", () => {
    for (const s of ["prepare", "search", "tour", "offer", "under-contract", "close", "own"] as const) expect(stageFocus("buy", s)).not.toBeNull();
    for (const s of ["prepare", "price-launch", "market", "offers", "under-contract", "close", "continue"] as const) expect(stageFocus("sell", s)).not.toBeNull();
  });
});
