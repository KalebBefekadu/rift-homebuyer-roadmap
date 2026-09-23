import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MAX_TAG, describeTouch, externalReferrer, safeLanding, stripToHost, touchFromRequest,
} from "./attribution";

/**
 * `capture.test.ts` already tested these functions and they passed, because it
 * fed `touchFromRequest` a referrer like "https://l.facebook.com/": which is
 * what the module is for and not what its caller ever produced.
 *
 * The caller is a fetch from the landing page to /api/attribution. The Referer
 * header on that call is the landing page. So the referrer handed to this
 * function was always our own host, every row recorded rift as the channel
 * that sent a visitor to rift, and "direct": which `describeTouch` calls "a
 * real answer": could not occur. A green test sat over it the whole time.
 *
 * So these tests use the inputs the route actually produces.
 */

const SELF = "rift.example";

describe("where a visit came from, using the values the route really passes", () => {
  it("reports nothing when the referrer is our own host", () => {
    /* The exact case: a fetch made from https://rift.example/buy. */
    expect(externalReferrer("https://rift.example/buy", SELF)).toBeUndefined();
    expect(externalReferrer("https://rift.example/sell?p=1", SELF)).toBeUndefined();
  });

  it("ignores case, because a Host header's is not guaranteed", () => {
    expect(externalReferrer("https://RIFT.example/buy", SELF)).toBeUndefined();
    expect(externalReferrer("https://rift.example/buy", "RIFT.EXAMPLE")).toBeUndefined();
  });

  it("still keeps a genuine external host", () => {
    expect(externalReferrer("https://l.facebook.com/", SELF)).toBe("l.facebook.com");
    expect(externalReferrer("https://www.google.com/search?q=x", SELF)).toBe("www.google.com");
  });

  it("treats a different subdomain as external, which it is", () => {
    expect(externalReferrer("https://blog.rift.example/x", SELF)).toBe("blog.rift.example");
  });

  it("reads as direct once the internal referrer is gone", () => {
    const t = touchFromRequest(new URL(`https://${SELF}/buy`), `https://${SELF}/buy`, SELF);
    expect(t.referrer).toBeUndefined();
    expect(describeTouch(t)).toBe("direct");
  });

  it("defaults selfHost to the landing URL's own host", () => {
    expect(touchFromRequest(new URL(`https://${SELF}/buy`), `https://${SELF}/`).referrer).toBeUndefined();
  });
});

describe("a utm tag is whatever a stranger typed into a link", () => {
  const long = "x".repeat(MAX_TAG + 500);

  it("is clamped before it reaches the database or the agent's screen", () => {
    const t = touchFromRequest(new URL(`https://${SELF}/buy?utm_source=${long}`), null, SELF);
    expect(t.source).toHaveLength(MAX_TAG);
  });

  it("clamps every tag, not just the one that is rendered first", () => {
    const u = new URL(`https://${SELF}/buy?utm_source=${long}&utm_medium=${long}&utm_campaign=${long}`);
    const t = touchFromRequest(u, null, SELF);
    for (const v of [t.source, t.medium, t.campaign]) expect(v).toHaveLength(MAX_TAG);
  });

  it("treats an empty or whitespace tag as absent rather than as a channel", () => {
    const t = touchFromRequest(new URL(`https://${SELF}/buy?utm_source=&utm_medium=%20`), null, SELF);
    expect(t.source).toBeUndefined();
    expect(t.medium).toBeUndefined();
    expect(describeTouch(t)).toBe("direct");
  });
});

describe("the landing path never carries a credential", () => {
  it("redacts a shared readout's token", () => {
    /* /r/<token> is unguessable on purpose: the token IS the credential for a
       document somebody can forward. The query string was already dropped for
       carrying answers; this path carries something stronger. */
    expect(safeLanding("/r/2f9c1a8b4d")).toBe("/r/[token]");
    expect(safeLanding("/r/2f9c1a8b4d/print")).toBe("/r/[token]/print");
  });

  it("leaves every other path alone", () => {
    for (const p of ["/buy", "/sell/results", "/abroad", "/", "/rates", "/reviews"]) {
      expect(safeLanding(p)).toBe(p);
    }
  });

  it("keeps the query out of the landing, as before", () => {
    const t = touchFromRequest(new URL(`https://${SELF}/buy?savings=9000&utm_source=fb`), null, SELF);
    expect(t.landing).toBe("/buy");
    expect(t.landing).not.toContain("savings");
  });

  it("does not store a non-web scheme as a channel", () => {
    expect(stripToHost("android-app://com.example")).toBeUndefined();
  });
});

/**
 * The two halves of the endpoint, asserted against its source.
 *
 * The bug was not in a function. It was in which side of the boundary each
 * value came from, and that is only visible in the route.
 */
describe("the route takes each value from the side that can know it", () => {
  const src = readFileSync("app/api/attribution/route.ts", "utf8");
  const client = readFileSync("lib/rift/track.ts", "utf8");

  it("derives the landing page from the header, not from the body", () => {
    expect(src).toContain('req.headers.get("referer")');
    /* A client-supplied landing URL let any caller attribute any session to
       any campaign. */
    expect(src).not.toMatch(/body\.url/);
    expect(client).not.toContain("url: window.location.href");
  });

  it("rejects a Referer that is not one of our own pages", () => {
    expect(src).toContain("url.host !== self.host");
  });

  it("takes the external referrer from the body, which is the only place it exists", () => {
    expect(client).toContain("document.referrer");
    expect(src).toMatch(/body\.referrer/);
    expect(src).toContain("touchFromRequest(url, cameFrom, self.host)");
  });
});
