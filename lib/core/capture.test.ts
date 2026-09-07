import { describe, it, expect } from "vitest";
import { sanitise, isEventName, EVENT_NAMES } from "@/lib/core/telemetry";
import { stripToHost, touchFromRequest, describeTouch } from "@/lib/core/attribution";
import { PHONE_CONSENT, EMAIL_NOTE, CONSENT_VERSION } from "@/lib/core/privacy";

/**
 * Capture-path rules.
 *
 * These are pure functions deliberately: the parts of telemetry, attribution
 * and consent that decide what is allowed to be stored are separated from the
 * database calls precisely so they can be tested without one. A rule that can
 * only be exercised against a live Postgres is a rule that gets tested once.
 */

describe("telemetry payloads", () => {
  it("strips anything that could carry an answer", () => {
    const out = sanitise({ value: 42000, answer: "yes", input: "x", step: 3, resumed: true });
    expect(out).toEqual({ step: 3, resumed: true });
  });

  it("strips personal fields even when a caller means well", () => {
    /* `email` in an analytics payload is almost always somebody being helpful.
       It is still a stranger's address in an analytics store. */
    const out = sanitise({ email: "a@b.com", phone: "404", name: "Maya", county: "DeKalb" });
    expect(out).toEqual({ county: "DeKalb" });
  });

  it("drops values that are not scalars", () => {
    const out = sanitise({ nested: { a: 1 }, list: [1, 2], ok: 1 });
    expect(out).toEqual({ ok: 1 });
  });

  it("accepts only names in the taxonomy", () => {
    expect(isEventName("readout_view")).toBe(true);
    /* A taxonomy that accepts anything is not a taxonomy, and the first typo
       becomes a permanent column in somebody's report. */
    expect(isEventName("readout_viewed")).toBe(false);
    expect(EVENT_NAMES.length).toBeGreaterThan(10);
  });
});

describe("attribution", () => {
  it("keeps the referring host and nothing else", () => {
    expect(stripToHost("https://www.facebook.com/groups/atl-buyers?ref=share"))
      .toBe("www.facebook.com");
  });

  it("stores nothing when the referrer is not a URL", () => {
    /* Rather than store an arbitrary string that might be a path with a query
       — which is where the personal data would be. */
    expect(stripToHost("android-app://com.example")).toBeUndefined();
    expect(stripToHost("")).toBeUndefined();
    expect(stripToHost(null)).toBeUndefined();
  });

  it("takes the campaign from the URL and the path without its query", () => {
    const t = touchFromRequest(
      new URL("https://rift.example/buy?utm_source=facebook&utm_campaign=dpa-help-sep&savings=9000"),
      "https://l.facebook.com/",
    );
    expect(t).toMatchObject({ source: "facebook", campaign: "dpa-help-sep", landing: "/buy" });
    expect(t.referrer).toBe("l.facebook.com");
    /* The landing must not carry the query — a stranger's answers can end up
       there, and attribution has no use for them. */
    expect(t.landing).not.toContain("savings");
  });

  it("describes a touch without ever reading 'unknown'", () => {
    expect(describeTouch({ source: "facebook", campaign: "sep" })).toBe("facebook · sep");
    expect(describeTouch({ referrer: "news.example" })).toBe("news.example");
    expect(describeTouch({})).toBe("direct");
  });
});

describe("consent wording", () => {
  it("says the four things TCPA prior express written consent requires", () => {
    const w = PHONE_CONSENT.toLowerCase();
    expect(w).toContain("call and text");
    expect(w).toContain("automatic dialling system");
    expect(w).toContain("not a condition");
    expect(w).toContain("stop");
  });

  it("is versioned, so a change is detectable rather than silent", () => {
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("promises the email is not a list", () => {
    expect(EMAIL_NOTE.toLowerCase()).toContain("no newsletter");
    expect(EMAIL_NOTE.toLowerCase()).toContain("unsubscribe");
  });
});
