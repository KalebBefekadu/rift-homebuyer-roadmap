import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { LATEST_MIGRATION } from "./schema-version";

describe("the migration the health check asks production about", () => {
  it("is the newest file in supabase/migrations", () => {
    const newest = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().at(-1);
    expect(LATEST_MIGRATION, "a migration was added: move LATEST_MIGRATION in lib/db/schema-version.ts to it").toBe(newest?.replace(/\.sql$/, ""));
  });

  it("matches the pattern the ledger accepts, or the script would never record it", () => {
    expect(LATEST_MIGRATION).toMatch(/^[0-9]{14}_[a-z0-9_]+$/);
  });
});
