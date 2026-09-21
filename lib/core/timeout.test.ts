import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { withTimeout, READ_DEADLINE_MS, WRITE_DEADLINE_MS, AUTH_DEADLINE_MS } from "./timeout";

describe("deadlines", () => {
  it("returns the real value when work finishes in time", async () => {
    const r = await withTimeout(Promise.resolve("real"), 50, "fallback");
    expect(r).toEqual({ value: "real", timedOut: false });
  });

  it("falls back when it does not", async () => {
    const slow = new Promise<string>((res) => setTimeout(() => res("late"), 100));
    const r = await withTimeout(slow, 10, "fallback");
    expect(r).toEqual({ value: "fallback", timedOut: true });
  });

  it("says which happened, rather than hiding it", async () => {
    /* A fallback that cannot be distinguished from a real answer is how a
       degraded product looks healthy on every dashboard. */
    const slow = new Promise<number>((res) => setTimeout(() => res(1), 100));
    expect((await withTimeout(slow, 10, 0)).timedOut).toBe(true);
    expect((await withTimeout(Promise.resolve(1), 50, 0)).timedOut).toBe(false);
  });

  it("lets a rejection through rather than swallowing it into the fallback", async () => {
    /* A failure has its own handling — a reported error and a documented
       fallback. Converting it to a timeout would lose the reason. */
    await expect(withTimeout(Promise.reject(new Error("boom")), 50, "fallback")).rejects.toThrow("boom");
  });

  it("waits for the visitor, not for the database", async () => {
    /* Past about two seconds on a phone people leave, so waiting longer for a
       better answer trades a certainty for a possibility. */
    expect(READ_DEADLINE_MS).toBeLessThanOrEqual(3_000);
  });
});

/**
 * Which deadline goes where, and why they differ.
 *
 * Not a style question. A read that misses falls back to a documented answer
 * and the visitor still gets their numbers. A session check that misses has no
 * equivalent — it cannot answer "who is asking", so the page shows the agent
 * either a sign-in form he does not need or an apology he does not want.
 */
describe("the three deadlines", () => {
  it("gives the gate longer than a figure", () => {
    /* A client record page missed a two-second deadline on roughly one
       request in three, against a local auth endpoint answering in under
       twenty milliseconds. The deadline is wall-clock and the page runs the
       record, the plan and the offers at once, so a busy event loop makes a
       fast query look slow. */
    expect(AUTH_DEADLINE_MS).toBeGreaterThan(READ_DEADLINE_MS);
  });

  it("bounds all three, because unbounded is a blank tab", () => {
    for (const [name, ms] of Object.entries({ READ_DEADLINE_MS, WRITE_DEADLINE_MS, AUTH_DEADLINE_MS })) {
      expect(ms, `${name} is not a number of milliseconds`).toBeGreaterThan(0);
      /* Vercel's default function ceiling. A deadline past it is not a
         deadline — the platform kills the request first and the fallback
         never runs. */
      expect(ms, `${name} is longer than the platform will wait anyway`).toBeLessThan(10_000);
    }
  });

  it("keeps the session check off the read deadline", () => {
    /* Asserted against the source, because the mistake is an import rather
       than a value: session.ts used READ_DEADLINE_MS for both of its calls
       simply because that was what the file already imported. */
    const src = readFileSync("lib/db/session.ts", "utf8");
    expect(src, "the session check is back on the read deadline")
      .not.toMatch(/READ_DEADLINE_MS/);
    expect((src.match(/AUTH_DEADLINE_MS/g) ?? []).length,
      "both reads in the session check should use the auth deadline")
      .toBeGreaterThanOrEqual(3);
  });
});
