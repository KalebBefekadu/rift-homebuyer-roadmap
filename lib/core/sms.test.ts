import { describe, it, expect } from "vitest";
import { smsNumber } from "./sms";
import { buildNewLeadText } from "./email";

describe("smsNumber", () => {
  it("reads a U.S. number however it was typed", () => {
    for (const raw of ["404-555-0123", "(404) 555 0123", "4045550123", "1 404 555 0123", "+1 404 555 0123"]) {
      expect(smsNumber(raw), raw).toBe("14045550123");
    }
  });

  it("keeps an international number written with a plus", () => {
    expect(smsNumber("+251 91 123 4567")).toBe("251911234567");
  });

  it("refuses to guess", () => {
    for (const raw of ["", "555-0123", "04045550123", "+12", null, undefined]) expect(smsNumber(raw)).toBeNull();
  });
});

describe("the new-lead text", () => {
  const lead = {
    to: "kaleb@example.com", side: "buy" as const, band: "now" as const, score: 82,
    headline: "h", action: "a", signals: [], timing: "", value: 320_000, source: "plan",
    studioUrl: "https://rift.test/operations/lead/abc",
  };

  it("says who, how fast, how to reach them, and links to them", () => {
    const t = buildNewLeadText({ ...lead, name: "Sam", phone: "404-555-0123", county: "Cobb" })!;
    expect(t).toBe("Rift lead (Call today): Sam, buying in Cobb, $320,000. Reply within 15 minutes. Call 404-555-0123. https://rift.test/operations/lead/abc");
  });

  it("falls back to email and to Someone", () => {
    const t = buildNewLeadText({ ...lead, email: "sam@example.com" })!;
    expect(t).toContain("Someone, buying");
    expect(t).toContain("Email sam@example.com");
  });

  it("is not sent about somebody who cannot be reached", () => {
    expect(buildNewLeadText(lead)).toBeNull();
  });

  it("stays short enough to arrive in one or two parts", () => {
    const t = buildNewLeadText({ ...lead, name: "A".repeat(200), email: "sam@example.com", county: "DeKalb" })!;
    expect(t.length).toBeLessThanOrEqual(306);
  });
});
