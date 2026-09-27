import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GEORGIA_PROGRAMS, matchAssistance, checkProgram, estimateAmount, isCurrent, type Profile, type ProgramRecord } from "./assistance";
import { GA_COUNTIES } from "./registry";

const today = new Date("2026-09-25T12:00:00Z");
const run = (p: Partial<Profile>, windowDays = 90) =>
  matchAssistance({ county: "DeKalb", firstTime: true, price: 325_000, income: 70_000, household: 2, occupation: "other", ...p }, { today, windowDays });
const slugs = (r: ReturnType<typeof run>) => r.matches.map((m) => m.program.slug);
const bySlug = (s: string) => GEORGIA_PROGRAMS.find((p) => p.slug === s)!;

describe("the records (Blueprint v5 §6.2, §6.6)", () => {
  it("every shown program has an official source, the day it was checked, and a county the site knows", () => {
    for (const p of GEORGIA_PROGRAMS) {
      expect(p.sourceUrl, p.slug).toMatch(/^https:\/\//);
      expect(p.checkedOn, p.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const c of p.area.counties) expect(GA_COUNTIES, `${p.slug}: ${c}`).toContain(c);
    }
    expect(new Set(GEORGIA_PROGRAMS.map((p) => p.slug)).size).toBe(GEORGIA_PROGRAMS.length);
  });

  it("never says qualify, anywhere in the engine's words", () => {
    const src = readFileSync("lib/core/assistance.ts", "utf8").split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
    expect(src).not.toMatch(/\bqualif/i);
  });
});

describe("matching (§6.3)", () => {
  it("a first-time DeKalb buyer sees Georgia Dream, the FHLBank product and the Atlanta programs, each with what still needs checking", () => {
    const r = run({});
    expect(slugs(r)).toEqual(expect.arrayContaining(["ga-dream", "fhlb-first-time", "atl-homenow"]));
    const homenow = r.matches.find((m) => m.program.slug === "atl-homenow")!;
    expect(homenow.checks.find((c) => c.label === "Location")!.state).toBe("check");
    expect(slugs(r)).not.toContain("fulton-hop");
    expect(slugs(r)).not.toContain("gwinnett-homestretch");
  });

  it("Georgia Dream is 5% of the price up to $10,000", () => {
    expect(estimateAmount(bySlug("ga-dream"), { price: 150_000 }).amount).toBe(7_500);
    expect(estimateAmount(bySlug("ga-dream"), { price: 325_000 }).amount).toBe(10_000);
  });

  it("an educator gets Georgia Dream PEN in place of the standard amount, never both", () => {
    const r = run({ occupation: "educator" });
    expect(slugs(r)).toContain("ga-dream-pen");
    expect(slugs(r)).not.toContain("ga-dream");
    expect(r.matches.find((m) => m.program.slug === "ga-dream-pen")!.amount).toBe(12_500);
  });

  it("a repeat buyer loses the first-time programs and keeps the ones that do not ask", () => {
    const r = run({ county: "Cobb", firstTime: false });
    expect(slugs(r)).toContain("cobb-my-home");
    expect(slugs(r)).not.toContain("ga-dream");
    expect(slugs(r)).not.toContain("fhlb-first-time");
  });

  it("over a price or income limit is not a potential match", () => {
    expect(slugs(run({ county: "Fulton", price: 400_000 }))).not.toContain("fulton-hop");
    expect(slugs(run({ county: "Fulton", price: 300_000 }))).toContain("fulton-hop");
    expect(slugs(run({ income: 150_000, household: 2 }))).not.toContain("ga-dream");
    expect(slugs(run({ income: 90_000, household: 2 }))).not.toContain("fhlb-first-time");
  });

  it("an answer not given is 'needs checking', never a pass", () => {
    const m = checkProgram(bySlug("fhlb-first-time"), { county: "DeKalb", firstTime: true, price: 300_000 });
    expect(m.checks.find((c) => c.label === "Income")!.state).toBe("check");
    expect(m.potential).toBe(true);
  });

  it("Clayton pays more to public safety, health, education and military", () => {
    const base = checkProgram(bySlug("clayton-dpa"), { county: "Clayton", firstTime: true, price: 250_000, income: 60_000, household: 2, occupation: "other" });
    const safety = checkProgram(bySlug("clayton-dpa"), { county: "Clayton", firstTime: true, price: 250_000, income: 60_000, household: 2, occupation: "safety" });
    expect(base.amount).toBe(7_500);
    expect(safety.amount).toBe(10_000);
  });

  it("a tier named for a group narrower than the job question is mentioned, never used as the amount", () => {
    const m = checkProgram(bySlug("atl-beltline-map"), { county: "Fulton", firstTime: true, price: 300_000, income: 60_000, household: 2, occupation: "educator" });
    expect(m.amount).toBe(20_000);
    expect(m.amountNote).toMatch(/\$30,000/);
  });
});

describe("combinations (§6.4)", () => {
  it("are shown only when both programs' rules allow them", () => {
    /* Today only Georgia Dream records that it combines; everything else is
       unknown, so nothing is added up. */
    expect(run({}).combination).toBeNull();
    const yes = (p: ProgramRecord): ProgramRecord => ({ ...p, combines: "yes" });
    const programs = GEORGIA_PROGRAMS.map((p) => (p.slug === "fhlb-first-time" ? yes(p) : p));
    const r = matchAssistance({ county: "DeKalb", firstTime: true, price: 325_000, income: 70_000, household: 2, occupation: "other" }, { today, windowDays: 90, programs });
    expect(r.combination?.programs.map((m) => m.program.slug).sort()).toEqual(["fhlb-first-time", "ga-dream"]);
    expect(r.combination?.total).toBe(27_500);
  });
});

describe("keeping it current (§6.5)", () => {
  it("a program past its review date is withheld, and an unverified one is never shown", () => {
    const later = new Date("2027-06-01T12:00:00Z");
    const r = matchAssistance({ county: "DeKalb", firstTime: true, price: 325_000 }, { today: later, windowDays: 90 });
    expect(r.matches).toEqual([]);
    expect(r.withheld.length).toBeGreaterThan(0);
    expect(isCurrent(bySlug("dekalb-homestart"), today, 90)).toBe(false);
    expect(slugs(run({}))).not.toContain("dekalb-homestart");
  });
});
