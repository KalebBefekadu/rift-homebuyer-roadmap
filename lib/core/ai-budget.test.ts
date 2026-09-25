import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CALL_CEILING_CENTS, MONTHLY_CAP_CENTS, WORKFLOW_CAP_CENTS, centsFor, maySpend, monthStart, worstCaseCents,
} from "./ai-budget";

/* AUTO-06 and D16: a hard $50 a month, enforced in code, manual entry after. */
describe("the AI budget", () => {
  it("is the $50 a month Kaleb set, and no workflow may take all of it", () => {
    expect(MONTHLY_CAP_CENTS).toBe(5_000);
    for (const cap of Object.values(WORKFLOW_CAP_CENTS)) expect(cap).toBeLessThan(MONTHLY_CAP_CENTS);
  });

  it("prices a call from tokens: Opus 5 at $5 in and $25 out per million", () => {
    expect(centsFor("claude-opus-5", 1_000_000, 0)).toBeCloseTo(500);
    expect(centsFor("claude-opus-5", 0, 1_000_000)).toBeCloseTo(2_500);
  });

  it("prices the worst case at the dearest model a fallback could reach", () => {
    expect(worstCaseCents("claude-opus-5", 10_000, 4_000)).toBeGreaterThan(centsFor("claude-opus-5", 10_000, 4_000));
    /* An unknown model is priced pessimistically, never at zero. */
    expect(centsFor("some-new-model", 1_000, 1_000)).toBeGreaterThan(0);
  });

  it("refuses a call over the ceiling, the workflow's share or the month", () => {
    expect(maySpend("offer-extract", CALL_CEILING_CENTS + 1, { month: 0, workflow: 0 })).toMatchObject({ ok: false, reason: "call" });
    expect(maySpend("offer-extract", 10, { month: 0, workflow: WORKFLOW_CAP_CENTS["offer-extract"] - 5 })).toMatchObject({ ok: false, reason: "workflow" });
    expect(maySpend("offer-extract", 10, { month: MONTHLY_CAP_CENTS - 5, workflow: 0 })).toMatchObject({ ok: false, reason: "month" });
    expect(maySpend("offer-extract", 10, { month: 100, workflow: 100 })).toEqual({ ok: true });
  });

  it("counts the calendar month in UTC", () => {
    expect(monthStart(new Date("2026-09-25T23:30:00-04:00"))).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("the offer reader spends only through the ledger", () => {
  const src = readFileSync("lib/ai/offer-extract.ts", "utf8");

  it("does nothing without a key, and says so", () => {
    expect(src.indexOf("process.env.ANTHROPIC_API_KEY")).toBeLessThan(src.indexOf("new Anthropic("));
  });

  it("reserves before it calls, and settles every outcome", () => {
    const reserved = src.indexOf('await reserve("offer-extract"');
    const called = src.indexOf("client.beta.messages.create(");
    expect(reserved).toBeGreaterThan(-1);
    expect(reserved).toBeLessThan(called);
    expect(src.match(/await settle\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("makes no call when the ledger cannot be reached", () => {
    const ledger = readFileSync("lib/db/ai-usage.ts", "utf8");
    expect(ledger).toContain('skipped("no database, so no spending limit, so no AI")');
    expect(src).toMatch(/if \("skipped" in held\) return manual\(/);
  });
});
