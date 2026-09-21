import { describe, it, expect } from "vitest";
import { refFrom, touchFromRequest, describeTouch, MAX_REF } from "./attribution";

/**
 * The handle that says who sent somebody.
 *
 * `rift_leads.referred_by` was added, read in three places, and written by
 * nothing — so "advocacy share of pipeline", the first of the three metrics
 * docs/vision.md names as mattering most, could not become non-zero by any
 * path through the product. This is the front half of the writer.
 *
 * `refFrom` is stricter than the campaign tags beside it on purpose. Those are
 * prose somebody typed into a marketing URL; this is an opaque token that gets
 * looked up in the database, so anything not token-shaped is either a mistake
 * or an attempt and neither is worth storing.
 */

const at = (url: string, referrer: string | null = null) =>
  touchFromRequest(new URL(url), referrer, "rift.test");

describe("refFrom", () => {
  it("accepts the token shapes this product actually mints", () => {
    /* hex from randomBytes, and the readout share token. */
    expect(refFrom("3dd3355a1c8697f489a5e327")).toBe("3dd3355a1c8697f489a5e327");
    expect(refFrom("abc-DEF_123")).toBe("abc-DEF_123");
    expect(refFrom("0f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f")).toBe("0f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f");
  });

  it("trims but does not otherwise repair", () => {
    expect(refFrom("  abc123  ")).toBe("abc123");
  });

  it("refuses anything that is not token-shaped", () => {
    for (const bad of [
      "",
      "   ",
      "has space",
      "semi;colon",
      "<script>",
      "a/b",
      "a?b=c",
      "drop table",
      "e'x",
      "%2e%2e",
    ]) {
      expect(refFrom(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it("refuses a handle longer than anything it mints", () => {
    expect(refFrom("a".repeat(MAX_REF))).toBe("a".repeat(MAX_REF));
    expect(refFrom("a".repeat(MAX_REF + 1))).toBeUndefined();
  });

  it("handles null and undefined", () => {
    expect(refFrom(null)).toBeUndefined();
    expect(refFrom(undefined)).toBeUndefined();
  });
});

describe("the touch carries it", () => {
  it("reads ?r= off the landing url", () => {
    expect(at("https://rift.test/buy/start?r=abc123").ref).toBe("abc123");
  });

  it("is absent when nobody sent them", () => {
    expect(at("https://rift.test/buy/start").ref).toBeUndefined();
  });

  it("does not put the handle in the stored landing path", () => {
    /* `safeLanding` drops the query, and it must go on doing so — the landing
       column is a path, and a referral that also appeared there would be a
       second copy nothing keeps in step with the first. */
    const t = at("https://rift.test/buy/start?r=abc123&utm_source=fb");
    expect(t.landing).toBe("/buy/start");
    expect(t.landing).not.toContain("abc123");
  });

  it("survives alongside campaign tags", () => {
    /* A client copies a link out of a newsletter and passes it on with the
       utm still attached. Both facts are true and both are kept. */
    const t = at("https://rift.test/buy?r=abc123&utm_source=newsletter&utm_campaign=sep");
    expect(t.ref).toBe("abc123");
    expect(t.source).toBe("newsletter");
    expect(t.campaign).toBe("sep");
  });

  it("drops a malformed handle rather than storing it", () => {
    expect(at("https://rift.test/buy/start?r=%3Cscript%3E").ref).toBeUndefined();
  });
});

describe("describeTouch", () => {
  it("calls a referral a referral, over any campaign tag", () => {
    /* The person who passed the link on sent them. An attribution report that
       credits the newsletter has just told the agent to buy more newsletter
       and stop asking for referrals. */
    expect(describeTouch({ ref: "abc", source: "newsletter", campaign: "sep" })).toBe("referral");
    expect(describeTouch({ ref: "abc", referrer: "www.google.com" })).toBe("referral");
  });

  it("leaves every other answer exactly as it was", () => {
    expect(describeTouch({ source: "fb", campaign: "sep" })).toBe("fb · sep");
    expect(describeTouch({ source: "fb" })).toBe("fb");
    expect(describeTouch({ referrer: "www.google.com" })).toBe("www.google.com");
    expect(describeTouch({})).toBe("direct");
  });
});
