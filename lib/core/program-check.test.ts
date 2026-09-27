import { describe, it, expect } from "vitest";
import { GEORGIA_PROGRAMS, isCurrent, matchAssistance } from "./assistance";
import {
  applyChecks, classify, lastGood, openFlags, readableText, sourcesToCheck, textDiff,
  type SourceCheck, type SourceReview,
} from "./program-check";

const dream = GEORGIA_PROGRAMS.find((p) => p.slug === "ga-dream")!;
const URL = dream.sourceUrl;
let n = 0;
const reading = (outcome: SourceCheck["outcome"], at: string, fp: string | null = outcome === "unreachable" ? null : "f".repeat(64)): SourceCheck =>
  ({ id: `c${++n}`, sourceUrl: URL, checkedAt: `${at}T12:00:00Z`, outcome, httpStatus: 200, fingerprint: fp, text: null, detail: null });
const review = (c: SourceCheck, outcome: SourceReview["outcome"], at: string): SourceReview =>
  ({ checkId: c.id, outcome, reviewedBy: "Kaleb", reviewedAt: `${at}T15:00:00Z`, note: null });
const dreamAfter = (checks: SourceCheck[], reviews: SourceReview[] = []) =>
  applyChecks(GEORGIA_PROGRAMS, checks, reviews).find((p) => p.slug === "ga-dream")!;

describe("reading a page (Blueprint v5 §6.5)", () => {
  it("keeps the words and drops what changes on every load", () => {
    const a = readableText(`<html><script>var t="${"a".repeat(10)}1"</script><p>Up to $10,000</p><!-- 12:01 --><style>p{}</style></html>`);
    const b = readableText(`<html><script>var t="${"b".repeat(10)}2"</script><p>Up to $10,000</p><!-- 12:02 --></html>`);
    expect(a).toBe("Up to $10,000");
    expect(a).toBe(b);
  });

  it("the first reading is a baseline, then unchanged or changed, and a failed read is unreachable", () => {
    expect(classify(null, { ok: true, fingerprint: "a" })).toBe("baseline");
    const prev = reading("baseline", "2026-09-28", "a");
    expect(classify(prev, { ok: true, fingerprint: "a" })).toBe("unchanged");
    expect(classify(prev, { ok: true, fingerprint: "b" })).toBe("changed");
    expect(classify(prev, { ok: false, fingerprint: null })).toBe("unreachable");
  });

  it("compares with the last reading that had content, not with a failed one", () => {
    const good = reading("baseline", "2026-09-28", "a");
    const bad = reading("unreachable", "2026-10-05");
    expect(lastGood([good, bad], URL)).toBe(good);
  });

  it("reads each official page once, however many records point at it", () => {
    const urls = sourcesToCheck(GEORGIA_PROGRAMS);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.filter((u) => u === URL)).toHaveLength(1);
    /* Records not confirmed from an official page are never shown, so their
       pages are not what keeps anything current. */
    expect(urls).not.toContain(GEORGIA_PROGRAMS.find((p) => p.slug === "dekalb-homestart")!.sourceUrl);
  });
});

describe("renewing a record", () => {
  it("an unchanged page renews it on the day it was read", () => {
    expect(dreamAfter([reading("baseline", "2026-09-28"), reading("unchanged", "2026-11-02")]).checkedOn).toBe("2026-11-02");
  });

  it("a baseline proves nothing and renews nothing", () => {
    expect(dreamAfter([reading("baseline", "2026-10-05")]).checkedOn).toBe(dream.checkedOn);
  });

  it("a changed page stops renewal until someone looks, even if later readings match the changed page", () => {
    const changed = reading("changed", "2026-10-05");
    const after = dreamAfter([reading("baseline", "2026-09-28"), changed, reading("unchanged", "2026-10-12"), reading("unchanged", "2026-10-19")]);
    expect(after.checkedOn).toBe(dream.checkedOn);
    /* So it ages out, and the buyer is told something is being re-checked. */
    const later = new Date("2027-01-10T12:00:00Z");
    expect(isCurrent(after, later, 90)).toBe(false);
  });

  it("'still right' clears the flag and renews on the day of the review", () => {
    const changed = reading("changed", "2026-10-05");
    const after = dreamAfter([reading("baseline", "2026-09-28"), changed, reading("unchanged", "2026-10-12")], [review(changed, "still-right", "2026-10-06")]);
    expect(after.checkedOn).toBe("2026-10-12");
    expect(after.withheldReason).toBeUndefined();
  });

  it("'needs updating' withholds it at once, and the buyer's page says so rather than showing less", () => {
    const changed = reading("changed", "2026-10-05");
    const checks = [reading("baseline", "2026-09-28"), changed];
    const reviews = [review(changed, "needs-update", "2026-10-06")];
    const after = dreamAfter(checks, reviews);
    expect(after.status).toBe("unverified");
    expect(after.withheldReason).toBeTruthy();
    const programs = applyChecks(GEORGIA_PROGRAMS, checks, reviews);
    const r = matchAssistance({ county: "DeKalb", firstTime: true, price: 300_000, income: 60_000, household: 2, occupation: "other" },
      { today: new Date("2026-10-07T12:00:00Z"), windowDays: 90, programs });
    expect(r.matches.map((m) => m.program.slug)).not.toContain("ga-dream");
    expect(r.withheld.map((p) => p.slug)).toContain("ga-dream");
  });

  it("an edited record, dated after the review, is shown again", () => {
    const changed = reading("changed", "2026-10-05");
    const edited = GEORGIA_PROGRAMS.map((p) => (p.slug === "ga-dream" ? { ...p, checkedOn: "2026-10-08" } : p));
    const after = applyChecks(edited, [changed], [review(changed, "needs-update", "2026-10-06")]).find((p) => p.slug === "ga-dream")!;
    expect(after.status).toBe("active");
  });
});

describe("a page that could not be read", () => {
  it("stops renewal, and a later reading that finds it unchanged clears it without anyone", () => {
    const down = reading("unreachable", "2026-10-05");
    const blocked = dreamAfter([reading("baseline", "2026-09-28", "a"), down]);
    expect(blocked.checkedOn).toBe(dream.checkedOn);
    const back = dreamAfter([reading("baseline", "2026-09-28", "a"), down, reading("unchanged", "2026-10-12", "a")]);
    expect(back.checkedOn).toBe("2026-10-12");
    expect(openFlags(GEORGIA_PROGRAMS, [reading("baseline", "2026-09-28", "a"), down, reading("unchanged", "2026-10-12", "a")], [])).toEqual([]);
  });

  it("but never clears a change nobody has reviewed", () => {
    const changed = reading("changed", "2026-10-05", "b");
    const after = dreamAfter([reading("baseline", "2026-09-28", "a"), changed, reading("unreachable", "2026-10-12"), reading("unchanged", "2026-10-19", "b")]);
    expect(after.checkedOn).toBe(dream.checkedOn);
  });
});

describe("flags for a person", () => {
  it("one flag per page, the newest, naming every record that uses it, and gone once reviewed", () => {
    const a = reading("changed", "2026-10-05");
    const b = reading("changed", "2026-10-12");
    const flags = openFlags(GEORGIA_PROGRAMS, [reading("baseline", "2026-09-28"), a, b], []);
    expect(flags).toHaveLength(1);
    expect(flags[0].check).toBe(b);
    expect(flags[0].programs.map((p) => p.slug).sort()).toEqual(["ga-dream", "ga-dream-choice", "ga-dream-pen"]);
    expect(openFlags(GEORGIA_PROGRAMS, [a, b], [review(b, "still-right", "2026-10-13")]).map((f) => f.check)).toEqual([a]);
  });

  it("shows the lines that left and the lines that arrived", () => {
    expect(textDiff("Up to $10,000\nIncome up to $137,555", "Up to $12,500\nIncome up to $137,555")).toEqual({ removed: ["Up to $10,000"], added: ["Up to $12,500"] });
    expect(textDiff(null, "x")).toEqual({ removed: [], added: [] });
  });
});

describe("the AI comparison, for the reviewer only (§6.5, D16)", () => {
  it("turns a usable answer into lines, and anything else into nothing", async () => {
    const { compareSummary } = await import("./program-check");
    expect(compareSummary({ recordAffected: false, changes: [] })).toMatch(/none of the record/i);
    expect(compareSummary({ recordAffected: true, changes: [{ fact: "Maximum amount", record: "$10,000", page: "Up to $12,500" }] }))
      .toBe('Maximum amount: the record says "$10,000"; the page now says "Up to $12,500".');
    expect(compareSummary("changed")).toBeNull();
    expect(compareSummary({ recordAffected: true })).toBeNull();
  });
});
