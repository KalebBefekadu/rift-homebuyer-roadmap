import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { currentShares, defaultAudience, mayOpen } from "./document-share";

/* Blueprint v5 §7.2: every document shared with the household, in one place. */
describe("sharing a document with the household", () => {
  it("keeps papers with money in them to members who see money, by default", () => {
    for (const f of ["offer", "counter", "contract", "appraisal", "lender"] as const) expect(defaultAudience(f)).toBe("money");
    for (const f of ["disclosure", "inspection", "other"] as const) expect(defaultAudience(f)).toBe("household");
  });

  it("opens only for the audience chosen", () => {
    expect(mayOpen("household", [])).toBe(true);
    expect(mayOpen("money", ["search", "homes"])).toBe(false);
    expect(mayOpen("money", ["money"])).toBe(true);
    expect(mayOpen("none", ["money"])).toBe(false);
    expect(mayOpen(undefined, ["money"])).toBe(false);
  });

  it("holds the latest decision per document, so a withdrawn share stays withdrawn", () => {
    const shares = currentShares([
      { id: "2", documentId: "d1", audience: "none", at: "2026-09-25T10:00:00Z" },
      { id: "1", documentId: "d1", audience: "household", at: "2026-09-24T10:00:00Z" },
      { id: "3", documentId: "d2", audience: "money", at: "2026-09-24T10:00:00Z" },
    ]);
    expect(shares.get("d1")).toBe("none");
    expect(shares.get("d2")).toBe("money");
  });

  it("has one rule for opening a document: the list and the link cannot disagree", () => {
    const client = readFileSync("lib/db/client.ts", "utf8");
    const link = client.slice(client.indexOf("export async function clientDocumentLink"), client.indexOf("export interface ClientDocument"));
    expect(link).toContain("await clientDocuments(m)");
    expect(client).toMatch(/const docs = await clientDocuments\(m\);[\s\S]*return done\(\{ sections, documents \}\)/);
  });

  it("ships its table with a policy, and as history", () => {
    const sql = readFileSync("supabase/migrations/20260927020000_rift_document_shares.sql", "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("create policy rift_document_shares_agent");
    expect(sql).toContain("before update on public.rift_document_shares");
  });
});
