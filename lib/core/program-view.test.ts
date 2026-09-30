import { describe, it, expect } from "vitest";
import { GEORGIA_PROGRAMS, type ProgramRecord } from "./assistance";
import { applyChecks, type SourceCheck, type SourceReview } from "./program-check";
import {
  amountView, areaText, buyerStatus, checkLine, groupByArea, historyFor, keyRules, largestShown, STATUS_LABEL,
} from "./program-view";

const bySlug = (s: string) => GEORGIA_PROGRAMS.find((p) => p.slug === s)!;
const at = (day: string) => new Date(`${day}T15:00:00Z`);
const W = 90;

const check = (over: Partial<SourceCheck>): SourceCheck => ({
  id: "c1", sourceUrl: bySlug("ga-dream").sourceUrl, checkedAt: "2026-09-28T10:00:00Z", outcome: "unchanged",
  httpStatus: 200, fingerprint: "f", text: null, detail: null, ...over,
});

describe("the one status a buyer sees", () => {
  it("is shown inside the window, withheld once past it", () => {
    const p = bySlug("ga-dream");
    expect(buyerStatus(p, at("2026-09-29"), W)).toBe("shown");
    expect(buyerStatus(p, at("2027-01-10"), W)).toBe("overdue");
  });

  it("names a withdrawal as a withdrawal, not as a record nobody confirmed", () => {
    /* applyChecks marks a withdrawn record "unverified" too; reading status
       alone would call it "Not confirmed" and hide that a person stopped it. */
    const reviews: SourceReview[] = [{ checkId: "c1", outcome: "needs-update", reviewedBy: "Kaleb", reviewedAt: "2026-09-28T12:00:00Z", note: null }];
    const [p] = applyChecks([bySlug("ga-dream")], [check({ outcome: "changed" })], reviews);
    expect(buyerStatus(p!, at("2026-09-29"), W)).toBe("withdrawn");
    expect(buyerStatus(bySlug("we-dekalb"), at("2026-09-29"), W)).toBe("unconfirmed");
  });

  it("every status has its words", () => {
    for (const s of ["shown", "overdue", "unconfirmed", "withdrawn"] as const) expect(STATUS_LABEL[s]).toBeTruthy();
  });
});

describe("the one line about checking", () => {
  const p = bySlug("ga-dream"); // checked 2026-09-24

  it("stays quiet while the record is current", () => {
    expect(checkLine(p, at("2026-09-24"), W)).toEqual({ text: "Checked today", tone: "quiet" });
    expect(checkLine(p, at("2026-09-25"), W)).toEqual({ text: "Checked yesterday", tone: "quiet" });
    expect(checkLine(p, at("2026-09-29"), W)).toEqual({ text: "Checked 5 days ago", tone: "quiet" });
  });

  it("warns inside the last fortnight, and says how late once overdue", () => {
    expect(checkLine(p, at("2026-12-13"), W)).toMatchObject({ tone: "warn", text: expect.stringMatching(/withheld in 10 days/) });
    expect(checkLine(p, at("2026-12-25"), W)).toEqual({ text: "Check overdue by 2 days", tone: "neg" });
  });

  it("a page waiting for review says so before any date", () => {
    expect(checkLine(p, at("2026-09-29"), W, "changed")).toEqual({ text: "Page changed: waiting for your review", tone: "warn" });
    expect(checkLine(p, at("2026-09-29"), W, "unreachable").text).toMatch(/could not be read/);
  });

  it("an unconfirmed record never alarms", () => {
    expect(checkLine(bySlug("dekalb-homestart"), at("2026-09-29"), W).tone).toBe("quiet");
  });
});

describe("the amount", () => {
  it("states a share of the price as a cap with its basis", () => {
    expect(amountView(bySlug("ga-dream"))).toMatchObject({ headline: "$10,000", basis: "5% of the price, up to this", higher: null, counted: 10_000 });
  });

  it("mentions Beltline's higher amount without counting it, and counts Clayton's", () => {
    const beltline = amountView(bySlug("atl-beltline-map"));
    expect(beltline.higher).toMatchObject({ counted: false, text: expect.stringMatching(/^\$30,000 for /) });
    expect(beltline.counted).toBe(20_000);
    const clayton = amountView(bySlug("clayton-dpa"));
    expect(clayton.higher?.counted).toBe(true);
    expect(clayton.counted).toBe(10_000);
  });

  it("a share of the loan with no dollar cap is never given one", () => {
    expect(amountView(bySlug("cobb-my-home"))).toMatchObject({ headline: "2% of the loan", counted: 0 });
    expect(amountView(bySlug("we-dekalb")).headline).toBe("Not on the record");
  });

  it("the largest figure comes only from programs buyers are shown", () => {
    const best = largestShown(GEORGIA_PROGRAMS, at("2026-09-29"), W)!;
    const shown = GEORGIA_PROGRAMS.filter((p) => buyerStatus(p, at("2026-09-29"), W) === "shown");
    expect(best.amount).toBe(Math.max(...shown.map((p) => amountView(p).counted)));
    expect(largestShown(GEORGIA_PROGRAMS, at("2027-06-01"), W)).toBeNull();
  });
});

describe("the key rules and where", () => {
  it("says first-time, income, price and job in a few words", () => {
    expect(keyRules(bySlug("fulton-hop"))).toEqual(["First-time buyers", "Income up to 80% of area median", "Price up to $347,000 ($367,000 new build)"]);
    expect(keyRules(bySlug("fhlb-community-partners"))[0]).toBe("Only for public safety, educators, health care, military and veterans");
    expect(keyRules(bySlug("cobb-my-home"))).toContain("Income up to $159,880");
  });

  it("uses the record's own words for part of a county", () => {
    expect(areaText(bySlug("ga-dream"))).toBe("Anywhere in Georgia");
    expect(areaText(bySlug("gwinnett-homestretch"))).toBe("All of Gwinnett County");
    expect(areaText(bySlug("atl-homenow"))).toBe("Inside the City of Atlanta limits");
  });

  it("groups statewide, then the city, then counties by name, losing none", () => {
    const g = groupByArea(GEORGIA_PROGRAMS);
    expect(g[0]!.label).toBe("Statewide");
    expect(g[1]!.label).toBe("City of Atlanta");
    const counties = g.slice(2).map((x) => x.label);
    expect(counties).toEqual([...counties].sort());
    expect(g.flatMap((x) => x.programs).length).toBe(GEORGIA_PROGRAMS.length);
  });

  it("a city nobody mapped is grouped under its administrator, not guessed", () => {
    const p: ProgramRecord = { ...bySlug("atl-homenow"), administrator: "Somewhere Housing Authority" };
    expect(groupByArea([p])[0]!.label).toBe("Somewhere Housing Authority");
  });
});

describe("the check history", () => {
  it("is one page's readings, newest first, each with its review", () => {
    const url = bySlug("ga-dream").sourceUrl;
    const checks = [
      check({ id: "a", checkedAt: "2026-09-21T10:00:00Z", outcome: "baseline" }),
      check({ id: "b", checkedAt: "2026-09-28T10:00:00Z", outcome: "changed" }),
      check({ id: "x", sourceUrl: "https://elsewhere.example/", checkedAt: "2026-09-28T10:00:00Z" }),
    ];
    const reviews: SourceReview[] = [{ checkId: "b", outcome: "still-right", reviewedBy: "Kaleb", reviewedAt: "2026-09-28T12:00:00Z", note: null }];
    const h = historyFor(url, checks, reviews);
    expect(h.map((e) => e.check.id)).toEqual(["b", "a"]);
    expect(h[0]!.review?.reviewedBy).toBe("Kaleb");
    expect(h[1]!.review).toBeNull();
  });
});
