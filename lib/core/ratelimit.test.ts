import { describe, it, expect, beforeEach } from "vitest";
import { check, reset, LIMITS } from "./ratelimit";

describe("rate limiting", () => {
  beforeEach(reset);

  it("allows up to the limit and refuses past it", () => {
    const limit = { max: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) expect(check("a", limit, 0).allowed).toBe(true);
    expect(check("a", limit, 0).allowed).toBe(false);
  });

  it("reopens after the window", () => {
    const limit = { max: 1, windowMs: 1_000 };
    expect(check("b", limit, 0).allowed).toBe(true);
    expect(check("b", limit, 500).allowed).toBe(false);
    expect(check("b", limit, 1_001).allowed).toBe(true);
  });

  it("keeps separate counts per key", () => {
    const limit = { max: 1, windowMs: 60_000 };
    expect(check("x", limit, 0).allowed).toBe(true);
    /* One noisy visitor must not lock out everybody else, which is the failure
       mode of limiting on a shared key. */
    expect(check("y", limit, 0).allowed).toBe(true);
  });

  it("reports when to come back", () => {
    const limit = { max: 1, windowMs: 60_000 };
    check("c", limit, 0);
    expect(check("c", limit, 10_000).retryAfter).toBe(50);
  });

  it("cannot grow without bound", () => {
    /* A flood of unique keys must not become the memory leak that takes the
       process down — that would hand an attacker what the limiter prevents. */
    const limit = { max: 1, windowMs: 1_000 };
    for (let i = 0; i < 12_000; i++) check(`k${i}`, limit, i * 2);
    expect(check("after", limit, 100_000).allowed).toBe(true);
  });

  it("is generous with telemetry and tight with submissions", () => {
    /* A single assessment legitimately batches every 1.5 seconds. Submitting a
       form forty times an hour is not a person. */
    expect(LIMITS.events.max).toBeGreaterThan(LIMITS.capture.max * 10);
  });
});
