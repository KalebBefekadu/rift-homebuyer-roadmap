import { describe, it, expect } from "vitest";
import { expiryFrom, linkState, readScopes, tokenShape, MAX_DAYS } from "./summary-link";

describe("read-only summary links (ACCESS-02)", () => {
  it("keeps only known scopes, and none means none", () => {
    expect(readScopes(["progress", "money", "dates", "progress"])).toEqual(["progress", "dates"]);
    expect(readScopes(["documents"])).toEqual([]);
  });

  it("expires within the limits, whatever was asked", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(expiryFrom(now, 30)).toBe("2026-10-31T12:00:00.000Z");
    expect(Date.parse(expiryFrom(now, 1000)) - now.getTime()).toBe(MAX_DAYS * 86_400_000);
    expect(Date.parse(expiryFrom(now, 0)) - now.getTime()).toBe(86_400_000);
  });

  it("is live, expired or turned off, and turned off wins", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(linkState({ expiresAt: "2026-10-31T00:00:00Z", revokedAt: null }, now)).toBe("live");
    expect(linkState({ expiresAt: "2026-10-01T00:00:00Z", revokedAt: null }, now)).toBe("expired");
    expect(linkState({ expiresAt: "2026-10-31T00:00:00Z", revokedAt: "2026-10-05T00:00:00Z" }, now)).toBe("revoked");
  });

  it("looks a token over before anything is looked up", () => {
    expect(tokenShape("a".repeat(43))).toBe(true);
    expect(tokenShape("short")).toBe(false);
    expect(tokenShape(`${"a".repeat(40)}'; drop`)).toBe(false);
  });
});
