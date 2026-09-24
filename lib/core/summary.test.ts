import { describe, it, expect } from "vitest";
import { activityLine, buildDailySummary, summaryWindow, type Activity, type DailySummary } from "./summary";

/**
 * The morning summary (W12; D07: one summary a business day instead of
 * instant alerts). What it covers, what it says, and when it says nothing.
 */

const base = { journeyId: "j1", journey: "First home in Gwinnett", person: "Devon Drill", who: "Devon", at: "2026-09-24T15:00:00Z" };
const empty: DailySummary = { day: "2026-09-25", activity: [], dates: [], jobs: [], leads: [], studioUrl: "https://rift.example/operations" };

describe("what one summary covers", () => {
  it("covers the previous business day, and Monday's covers the weekend", () => {
    const thu = summaryWindow(new Date("2026-09-24T13:00:00Z"));
    expect(thu.businessDay).toBe(true);
    expect(thu.since.toISOString()).toBe("2026-09-23T13:00:00.000Z");
    const mon = summaryWindow(new Date("2026-09-28T13:00:00Z"));
    expect(mon.since.toISOString()).toBe("2026-09-25T13:00:00.000Z");
  });

  it("skips a federal holiday and covers it the next business morning", () => {
    expect(summaryWindow(new Date("2026-09-07T13:00:00Z")).businessDay).toBe(false);
    expect(summaryWindow(new Date("2026-09-08T13:00:00Z")).since.toISOString()).toBe("2026-09-04T13:00:00.000Z");
  });
});

describe("what it says", () => {
  it("words each kind of thing a buyer did, without claiming more than happened", () => {
    const lines = ([
      { kind: "joined" },
      { kind: "reaction", home: "412 Maple Ridge Dr", reaction: "interested", reason: "The yard" },
      { kind: "tour-request", home: "412 Maple Ridge Dr" },
      { kind: "tour-answer", home: "412 Maple Ridge Dr", offer: "yes" },
      { kind: "offer-answer", home: "412 Maple Ridge Dr", version: 2, instruction: "proceed" },
      { kind: "brief-proposal" },
      { kind: "work", workstream: "earnest-money" },
    ] as const).map((k) => activityLine({ ...base, ...k } as Activity));
    expect(lines[1]).toBe('Devon on 412 Maple Ridge Dr: Interested ("The yard").');
    expect(lines[2]).toMatch(/Nothing is booked until you arrange it/);
    expect(lines[4]).toBe("Devon on version 2 of the offer on 412 Maple Ridge Dr: Go ahead with these terms.");
    expect(lines[5]).toMatch(/unchanged until you approve it/);
    expect(lines[6]).toBe("Devon reported earnest money as done. It needs your confirmation.");
  });

  it("is not sent when there is nothing to say", () => {
    expect(buildDailySummary(empty)).toBeNull();
  });

  it("leads with what needs him first, and counts it in the subject", () => {
    const s = buildDailySummary({
      ...empty,
      activity: [{ ...base, kind: "tour-request", home: "412 Maple Ridge Dr" }],
      dates: [
        { person: "Devon Drill", label: "Due diligence ends", when: "Wed, Sep 23 (no time stated)", why: "missed" },
        { person: "Devon Drill", label: "Closing", when: "Fri, Oct 23 at 5:00 PM (Georgia time)", why: "unchecked" },
      ],
      leads: [{ name: "Sam", side: "buy", band: "now" }],
    })!;
    expect(s.subject).toBe("Rift, Fri, Sep 25: 1 date passed, 1 thing from buyers, 1 date to look at, 1 new person");
    expect(s.html.indexOf("Needs you first")).toBeLessThan(s.html.indexOf("From your buyers"));
    expect(s.html).toMatch(/Due diligence ends<\/strong>, Wed, Sep 23 \(no time stated\), passed and not recorded as met\. Record what actually happened/);
    expect(s.html).toContain("https://rift.example/operations");
  });

  it("escapes everything a person typed", () => {
    const s = buildDailySummary({ ...empty, activity: [{ ...base, who: "<b>x</b>", kind: "reaction", home: "1 <i>A</i> St", reaction: "pass", reason: "<script>" }] })!;
    expect(s.html).not.toMatch(/<script>|<b>x|<i>A/);
    expect(s.html).toContain("&lt;script&gt;");
  });
});
