import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isSummaryToken, linkState, partsAllowed, summaryError, withoutMoney } from "./summary-link";

/* ACCESS-02: hashed high-entropy tokens, explicit parts, revocation, expiry,
   no referrer, no indexing, no shared caching, no money. */
describe("summary links", () => {
  it("lets a member share only what they can see", () => {
    expect(partsAllowed(["search"])).toEqual(["stage", "dates"]);
    expect(partsAllowed(["homes"])).toContain("homes");
    expect(summaryError(["homes"], "Mum", 30, ["search"])).toMatch(/only share what you can see/);
    expect(summaryError(["money"], "Mum", 30, ["money", "homes"])).toMatch(/only share/);
    expect(summaryError(["stage"], "Mum", 365, ["homes"])).toMatch(/how long/);
    expect(summaryError(["stage"], "Mum and Dad", 30, [])).toBeNull();
  });

  it("opens nothing once expired or stopped", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(linkState({ expiresAt: "2026-09-26T00:00:00Z", revokedAt: null }, now)).toBe("live");
    expect(linkState({ expiresAt: "2026-09-25T11:59:00Z", revokedAt: null }, now)).toBe("expired");
    expect(linkState({ expiresAt: "2026-10-25T00:00:00Z", revokedAt: "2026-09-24T00:00:00Z" }, now)).toBe("revoked");
  });

  it("accepts only a 32-byte token's shape", () => {
    expect(isSummaryToken("A".repeat(43))).toBe(true);
    expect(isSummaryToken("A".repeat(42))).toBe(false);
    expect(isSummaryToken("../etc/passwd")).toBe(false);
  });

  it("never lets an amount of money out, even inside a note", () => {
    expect(withoutMoney("Blocked: seller wants $4,000 more for the roof.")).toBe("Blocked: seller wants [amount not shared] more for the roof.");
    expect(withoutMoney("Appraisal came in at $412.5k")).toBe("Appraisal came in at [amount not shared]");
    expect(withoutMoney("Inspection: done on Sep 23.")).toBe("Inspection: done on Sep 23.");
  });

  it("stores only the hash, and serves the page privately", () => {
    const db = readFileSync("lib/db/summary-links.ts", "utf8");
    expect(db).toContain("token_hash: hash(token)");
    expect(db).not.toMatch(/insert\(\{[^}]*\btoken:/);
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain('"/s/:token*"');
    expect(cfg).toMatch(/source: "\/s\/:token\*",\s*headers: \[\s*\{ key: "Cache-Control", value: "private, no-store" \}/);
    expect(readFileSync("app/robots.ts", "utf8")).toContain('"/s/"');
    const sql = readFileSync("supabase/migrations/20260927030000_rift_summary_links.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/\btoken\s+text/);
  });
});
