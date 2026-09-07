import { describe, it, expect } from "vitest";
import { MAX_BODY_BYTES } from "./limits";

/**
 * The body-size limit, as a value rather than as behaviour.
 *
 * The first version of this imported the constant from lib/db and was blocked
 * by `server-only` — which is the layering rule working. The limit is policy
 * and belongs in the domain layer; `readJson` stays where the I/O is.
 *
 * What this pins is the number, because the failure mode of raising it is
 * invisible: nothing breaks, the database just fills.
 */
describe("request size limit", () => {
  it("is generous against real payloads and mean against accidents", () => {
    /* The largest real body is a readout with three tracked figures and a
       matched programme list, comfortably under 8KB. */
    expect(MAX_BODY_BYTES).toBeGreaterThan(8 * 1024);
    expect(MAX_BODY_BYTES).toBeLessThanOrEqual(128 * 1024);
  });
});
