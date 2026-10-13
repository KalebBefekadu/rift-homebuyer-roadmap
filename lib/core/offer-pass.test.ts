import { describe, it, expect } from "vitest";
import { checkPass, issuePass, PASS_MIN_AGE_MS, PASS_TTL_MS } from "./offer-pass";
import { signRecord } from "./signed";

const S = "a-secret";
const T0 = Date.parse("2026-10-13T15:00:00Z");

describe("the offer upload's pass (D41)", () => {
  it("takes a pass this server signed, once it is a few seconds old", () => {
    const p = issuePass(S, T0);
    expect(checkPass(S, p, T0 + PASS_MIN_AGE_MS)).toBe("ok");
    expect(checkPass(S, p, T0 + 60_000)).toBe("ok");
  });

  it("refuses one sent straight after it was issued", () => {
    expect(checkPass(S, issuePass(S, T0), T0 + 500)).toBe("early");
  });

  it("refuses none, a forged one, an expired one, and one signed for something else", () => {
    expect(checkPass(S, undefined, T0)).toBe("missing");
    expect(checkPass(S, "", T0)).toBe("missing");
    expect(checkPass("another-secret", issuePass(S, T0), T0 + 10_000)).toBe("bad");
    expect(checkPass(S, issuePass(S, T0), T0 + PASS_TTL_MS + 1)).toBe("bad");
    expect(checkPass(S, signRecord(S, "equb-lead", T0.toString(36), PASS_TTL_MS, T0), T0 + 10_000)).toBe("bad");
  });

  it("refuses a pass that says it was issued in the future", () => {
    expect(checkPass(S, issuePass(S, T0 + 60_000), T0 + 10_000)).toBe("bad");
  });
});
