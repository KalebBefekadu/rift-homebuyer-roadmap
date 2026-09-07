import { describe, it, expect } from "vitest";
import { withTimeout, READ_DEADLINE_MS } from "./timeout";

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
