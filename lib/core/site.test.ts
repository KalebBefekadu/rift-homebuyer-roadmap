import { describe, it, expect } from "vitest";
import { resolveSiteUrl } from "./site";

/**
 * What the sitemap, robots.txt and every share card resolve against.
 *
 * The case that matters most is the last one in the first test: production,
 * with nobody having set the explicit variable. That configuration served an
 * empty sitemap for the life of the deployment, and the point of the fallback
 * chain is that it can no longer happen by omission.
 */
describe("resolving the site origin", () => {
  it("prefers an explicit domain over anything the platform guesses", () => {
    expect(resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://riftrealestate.com",
      VERCEL_PROJECT_PRODUCTION_URL: "rift.vercel.app",
    })).toBe("https://riftrealestate.com");
  });

  it("falls back to the platform's stable production host, not the per-deploy one", () => {
    /* VERCEL_URL changes on every push. Putting it in a share card means the
       card breaks the next time anybody deploys. */
    expect(resolveSiteUrl({
      VERCEL_PROJECT_PRODUCTION_URL: "rift.vercel.app",
      VERCEL_URL: "rift-git-abc123.vercel.app",
    })).toBe("https://rift.vercel.app");
  });

  it("adds the scheme the platform variables leave off", () => {
    expect(resolveSiteUrl({ VERCEL_URL: "rift.vercel.app" })).toBe("https://rift.vercel.app");
  });

  it("strips a trailing slash, which otherwise doubles in every link", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://riftrealestate.com/" }))
      .toBe("https://riftrealestate.com");
  });

  it("drops a path somebody pasted along with the origin", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://riftrealestate.com/buy" }))
      .toBe("https://riftrealestate.com");
  });

  it("refuses plain http except on localhost", () => {
    /* A card or canonical URL on http is a downgrade a crawler will follow. */
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://riftrealestate.com" })).toBe(null);
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }))
      .toBe("http://localhost:3000");
  });

  it("ignores blank and malformed values rather than emitting half a URL", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   ", VERCEL_URL: "rift.vercel.app" }))
      .toBe("https://rift.vercel.app");
    expect(resolveSiteUrl({})).toBe(null);
  });
});
