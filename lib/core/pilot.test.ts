import { describe, it, expect } from "vitest";
import {
  asksFrom, checkError, checkState, durationText, median, promiseLine, replyDueDay, replyStats, setupStats, timing,
  type Ask, type Check, type PilotRows,
} from "./pilot";

/* New York is UTC-4 in September. 13:00Z is 9 AM there. */
const T = (day: string, hour = 13) => `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const J = "j1";

const empty = (): PilotRows => ({
  stops: [], tourSteps: [], work: [], briefResponses: [], revisions: [], packages: [], bidAnswers: [], bidSteps: [],
});

describe("when a reply is due (D07: the same business day)", () => {
  it("is the day asked on a business day, even late in the evening there", () => {
    expect(replyDueDay(T("2026-09-23"))).toBe("2026-09-23");
    /* 02:00Z on the 24th is 10 PM on the 23rd in New York. */
    expect(replyDueDay("2026-09-24T02:00:00Z")).toBe("2026-09-23");
  });

  it("moves past a weekend and a federal holiday", () => {
    expect(replyDueDay(T("2026-09-26"))).toBe("2026-09-28"); // Saturday to Monday
    expect(replyDueDay(T("2026-10-12"))).toBe("2026-10-13"); // Columbus Day
  });

  it("an answer the same day is kept, the next day is late, and an open one is late only once its day has passed", () => {
    const a: Ask = { kind: "showing", journeyId: J, askedAt: T("2026-09-23"), answeredAt: T("2026-09-23", 21) };
    expect(timing(a, new Date(T("2026-09-30")))).toBe("same-day");
    expect(timing({ ...a, answeredAt: T("2026-09-24") }, new Date(T("2026-09-30")))).toBe("later");
    expect(timing({ ...a, answeredAt: null }, new Date(T("2026-09-23", 20)))).toBe("waiting");
    expect(timing({ ...a, answeredAt: null }, new Date(T("2026-09-24")))).toBe("overdue");
  });

  it("a Saturday question answered on Monday is on time, and waiting on Sunday is not late", () => {
    const a: Ask = { kind: "work", journeyId: J, askedAt: T("2026-09-26"), answeredAt: T("2026-09-28", 18) };
    expect(timing(a, new Date(T("2026-09-30")))).toBe("same-day");
    expect(timing({ ...a, answeredAt: null }, new Date(T("2026-09-27")))).toBe("waiting");
  });
});

describe("pairing what a buyer did with the agent's answer", () => {
  it("a showing a buyer asked for is answered by the first step after the request; one the agent added is not an ask", () => {
    const rows = empty();
    rows.stops = [
      { id: "s1", journeyId: J, byMember: true, at: T("2026-09-23") },
      { id: "s2", journeyId: J, byMember: false, at: T("2026-09-23") },
    ];
    rows.tourSteps = [
      { stopId: "s1", seq: 1, at: T("2026-09-23") },
      { stopId: "s1", seq: 3, at: T("2026-09-25") },
      { stopId: "s1", seq: 2, at: T("2026-09-23", 18) },
    ];
    expect(asksFrom(rows)).toEqual([{ kind: "showing", journeyId: J, askedAt: T("2026-09-23"), answeredAt: T("2026-09-23", 18) }]);
  });

  it("work a buyer reported is answered by the agent's next update on that workstream, not another workstream's", () => {
    const rows = empty();
    rows.work = [
      { transactionId: "t", journeyId: J, workstream: "inspection", seq: 1, state: "in-progress", byMember: false, at: T("2026-09-22") },
      { transactionId: "t", journeyId: J, workstream: "inspection", seq: 2, state: "reported", byMember: true, at: T("2026-09-23") },
      { transactionId: "t", journeyId: J, workstream: "title", seq: 1, state: "confirmed", byMember: false, at: T("2026-09-23", 15) },
      { transactionId: "t", journeyId: J, workstream: "inspection", seq: 3, state: "confirmed", byMember: false, at: T("2026-09-24") },
    ];
    expect(asksFrom(rows)).toEqual([{ kind: "work", journeyId: J, askedAt: T("2026-09-23"), answeredAt: T("2026-09-24") }]);
  });

  it("a request for changes to the priorities is answered by the agent's next version; a confirmation needs nothing", () => {
    const rows = empty();
    rows.briefResponses = [
      { journeyId: J, response: "confirmed", at: T("2026-09-21") },
      { journeyId: J, response: "changes-requested", at: T("2026-09-23") },
    ];
    rows.revisions = [
      { journeyId: J, byMember: false, at: T("2026-09-20") },
      { journeyId: J, byMember: false, at: T("2026-09-23", 16) },
    ];
    expect(asksFrom(rows)).toEqual([{ kind: "brief-changes", journeyId: J, askedAt: T("2026-09-23"), answeredAt: T("2026-09-23", 16) }]);
  });

  it("a buyer's proposal is answered by an approval or a new version, whichever came first", () => {
    const rows = empty();
    rows.revisions = [{ journeyId: J, byMember: true, at: T("2026-09-23") }, { journeyId: J, byMember: false, at: T("2026-09-25") }];
    rows.packages = [{ id: "p", journeyId: J, status: "active-confirmed", approvedAt: T("2026-09-24"), confirmedAt: T("2026-09-24", 16), endedAt: null }];
    expect(asksFrom(rows)[0]!.answeredAt).toBe(T("2026-09-24"));
  });

  it("an offer answer from the buyer waits for the next offer step; one the agent recorded from a call does not", () => {
    const rows = empty();
    rows.bidAnswers = [
      { bidId: "b", journeyId: J, byMember: true, at: T("2026-09-23") },
      { bidId: "b", journeyId: J, byMember: false, at: T("2026-09-23") },
    ];
    rows.bidSteps = [{ bidId: "b", at: T("2026-09-22") }, { bidId: "other", at: T("2026-09-23", 14) }];
    expect(asksFrom(rows)).toEqual([{ kind: "offer-answer", journeyId: J, askedAt: T("2026-09-23"), answeredAt: null }]);
  });

  it("timestamps are compared as instants, whatever their spelling", () => {
    const rows = empty();
    rows.briefResponses = [{ journeyId: J, response: "changes-requested", at: "2026-09-23T13:00:00+00:00" }];
    rows.revisions = [{ journeyId: J, byMember: false, at: "2026-09-23T12:30:00.000Z" }, { journeyId: J, byMember: false, at: "2026-09-23T09:30:00-04:00" }];
    expect(asksFrom(rows)[0]!.answeredAt).toBe("2026-09-23T09:30:00-04:00");
  });
});

describe("the figures", () => {
  it("median and durations say no more than is useful", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(durationText(0.4)).toBe("under an hour");
    expect(durationText(1)).toBe("1 hour");
    expect(durationText(30.4)).toBe("30 hours");
    expect(durationText(80)).toBe("3 days");
  });

  it("counts each kind, and the promise line counts only what is due or answered", () => {
    const now = new Date(T("2026-09-24", 14));
    const asks: Ask[] = [
      { kind: "showing", journeyId: J, askedAt: T("2026-09-22"), answeredAt: T("2026-09-22", 15) },
      { kind: "showing", journeyId: J, askedAt: T("2026-09-22"), answeredAt: T("2026-09-23") },
      { kind: "showing", journeyId: J, askedAt: T("2026-09-23"), answeredAt: null },
      { kind: "work", journeyId: J, askedAt: T("2026-09-24"), answeredAt: null },
    ];
    const stats = replyStats(asks, now);
    expect(stats.find((s) => s.kind === "showing")).toEqual({ kind: "showing", asked: 3, sameDay: 1, later: 1, waiting: 0, overdue: 1, medianHours: 13 });
    expect(stats.find((s) => s.kind === "work")).toMatchObject({ asked: 1, waiting: 1, medianHours: null });
    expect(stats.find((s) => s.kind === "offer-answer")).toMatchObject({ asked: 0 });
    expect(promiseLine(stats)).toBe("1 of 3 answered the same business day. 1 more is waiting and not late yet.");
    expect(promiseLine(replyStats([], now))).toBe("Nothing from a buyer has needed you yet.");
    expect(promiseLine(replyStats([asks[3]!], now))).toBe("Nothing is past due. 1 more is waiting and not late yet.");
  });

  it("search setup is approval to recording, and a search replaced before recording is not counted as fast or slow", () => {
    const s = setupStats([
      { id: "a", journeyId: J, status: "superseded", approvedAt: T("2026-09-20"), confirmedAt: T("2026-09-20", 17), endedAt: T("2026-09-22") },
      { id: "b", journeyId: J, status: "active-confirmed", approvedAt: T("2026-09-22"), confirmedAt: T("2026-09-23", 13), endedAt: null },
      { id: "c", journeyId: "j2", status: "cancelled", approvedAt: T("2026-09-22"), confirmedAt: null, endedAt: T("2026-09-23") },
      { id: "d", journeyId: "j3", status: "manual-action-needed", approvedAt: T("2026-09-24"), confirmedAt: null, endedAt: null },
    ]);
    expect(s).toEqual({ recorded: 2, waiting: 1, dropped: 1, medianHours: 14 });
  });
});

describe("checks against Matrix and the documents", () => {
  const check = (over: Partial<Check> = {}): Check => ({ search: "matches", dates: "matches", note: null, by: "Kaleb", at: T("2026-09-23"), ...over });

  it("never checked, then current, then stale when the search or dates change after it, naming which", () => {
    expect(checkState(null, { search: null, dates: null })).toEqual({ state: "never" });
    expect(checkState(check(), { search: T("2026-09-22"), dates: null }).state).toBe("current");
    expect(checkState(check(), { search: T("2026-09-24"), dates: T("2026-09-25") })).toMatchObject({ state: "changed", what: ["search", "dates"] });
    expect(checkState(check(), { search: T("2026-09-20"), dates: T("2026-09-25") })).toMatchObject({ state: "changed", what: ["dates"] });
  });

  it("a difference stands until a later check finds a match", () => {
    expect(checkState(check({ dates: "differs", note: "Closing moved" }), { search: null, dates: null }).state).toBe("differs");
  });

  it("the answer must fit what the journey has", () => {
    const both = { search: true, dates: true };
    expect(checkError({ search: "matches", dates: "matches", note: null }, both)).toBeNull();
    expect(checkError({ search: "none", dates: "matches", note: null }, both)).toMatch(/Matrix search matches/);
    expect(checkError({ search: "matches", dates: "none", note: null }, both)).toMatch(/dates match/);
    expect(checkError({ search: "matches", dates: "none", note: null }, { search: false, dates: false })).toMatch(/nothing to check/);
    expect(checkError({ search: "matches", dates: "none", note: null }, { search: false, dates: false })).toMatch(/nothing to check/);
    expect(checkError({ search: "matches", dates: "none", note: null }, { search: false, dates: true })).toMatch(/no search recorded/);
    expect(checkError({ search: "none", dates: "matches", note: null }, { search: true, dates: false })).toMatch(/Matrix search matches/);
    expect(checkError({ search: "matches", dates: "matches", note: null }, { search: true, dates: false })).toMatch(/no contract dates/);
    expect(checkError({ search: "none", dates: "matches", note: null }, { search: false, dates: true })).toBeNull();
  });

  it("a difference says what it was", () => {
    const both = { search: true, dates: true };
    expect(checkError({ search: "differs", dates: "matches", note: " " }, both)).toMatch(/what differed/);
    expect(checkError({ search: "differs", dates: "matches", note: "Price cap was 450k in Matrix; fixed to 425k" }, both)).toBeNull();
    expect(checkError({ search: "whatever" as never, dates: "matches", note: null }, both)).toMatch(/Choose an answer/);
  });
});
