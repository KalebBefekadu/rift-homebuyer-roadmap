import { describe, it, expect } from "vitest";
import { checkField, missingProfile, profileChanges, PROFILE, PROFILE_FIELDS, type AgentProfile } from "./profile";

const KALEB: AgentProfile = { name: "Kaleb Befekadu", email: "kaleb@example.com", phone: null, license: null, brokerage: "Peachtree Cardinal" };

describe("a profile value", () => {
  it("is trimmed, and empty means not recorded", () => {
    expect(checkField("phone", "  404 555 0100 ")).toEqual({ ok: true, value: "404 555 0100" });
    expect(checkField("license", "   ")).toEqual({ ok: true, value: null });
  });

  it("refuses to empty the two the product cannot do without", () => {
    /* An empty email sends every new-lead alert nowhere and nothing says so. */
    expect(checkField("email", "").ok).toBe(false);
    expect(checkField("name", " ").ok).toBe(false);
  });

  it("refuses an address or a number that is plainly a typo", () => {
    expect(checkField("email", "kaleb@gmail").ok).toBe(false);
    expect(checkField("email", "Kaleb@Example.com")).toEqual({ ok: true, value: "kaleb@example.com" });
    expect(checkField("phone", "call me").ok).toBe(false);
    expect(checkField("phone", "+1 (404) 555-0100")).toEqual({ ok: true, value: "+1 (404) 555-0100" });
  });

  it("refuses something that is not text, and an overlong value", () => {
    expect(checkField("name", 42).ok).toBe(false);
    expect(checkField("brokerage", "x".repeat(PROFILE.brokerage.max + 1)).ok).toBe(false);
  });
});

describe("what a save would change", () => {
  it("records only the fields that differ, so an untouched form writes no history", () => {
    const r = profileChanges(KALEB, { ...KALEB, phone: "404 555 0100" });
    expect(r).toEqual({ ok: true, changes: { phone: "404 555 0100" } });
    expect(profileChanges(KALEB, { ...KALEB })).toEqual({ ok: true, changes: {} });
  });

  it("treats clearing a field as a change to nothing", () => {
    expect(profileChanges(KALEB, { brokerage: "" })).toEqual({ ok: true, changes: { brokerage: null } });
  });

  it("names the field that stopped the save", () => {
    expect(profileChanges(KALEB, { email: "nope" })).toMatchObject({ ok: false, field: "email" });
  });
});

describe("where each field reaches", () => {
  it("says so for every field, in words, and admits the ones that reach nothing", () => {
    for (const f of PROFILE_FIELDS) expect(PROFILE[f].reach.where.length).toBeGreaterThan(20);
    /* Nothing reads these three today. If one gets wired, flip it and say where. */
    expect(PROFILE.phone.reach.live).toBe(false);
    expect(PROFILE.license.reach.live).toBe(false);
    expect(PROFILE.brokerage.reach.live).toBe(false);
  });

  it("lists what is missing in form order", () => {
    expect(missingProfile(KALEB)).toEqual(["phone", "license"]);
  });
});
