import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * Every PostgREST column list, run against a real PostgREST.
 *
 * `scripts/verify-queries.mjs` has existed since September and was never part
 * of `npm test` or `npm run verify`. It was a thing somebody had to remember.
 *
 * On 21 September 2026 nobody remembered, and `lib/db/referral.ts` shipped
 * asking for `rift_leads.figure_id`: a column that exists on
 * rift_review_items and has never existed on rift_leads. PostgREST answers an
 * unknown column with an error about a schema cache, so every read in that
 * module failed and /operations/referrals was broken from the moment its migration
 * reached production. 1112 unit tests were green throughout, because the fake
 * database they run against does not validate column names, and neither
 * TypeScript nor the build can check a string.
 *
 * So the script is now a test. It SKIPS when no PostgREST is reachable: a
 * contributor without Docker should still get a meaningful `npm test`: and
 * fails loudly when one is reachable and a query is broken. Skipping silently
 * on a reachable-but-wrong database is the failure this whole file is about,
 * so the two cases are distinguished rather than collapsed.
 */

const BASE = process.env.PGRST_URL ?? "http://localhost:3001";

let reachable = false;

beforeAll(async () => {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    reachable = res.status < 500;
  } catch {
    reachable = false;
  }
});

describe("PostgREST query shapes", () => {
  it("every column list the data layer sends is one the database accepts", () => {
    if (!reachable) {
      console.warn(`  SKIPPED: no PostgREST at ${BASE}. Run scripts/local/up.sh.`);
      return;
    }

    let out = "";
    try {
      out = execFileSync("node", ["scripts/verify-queries.mjs"], {
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env },
      });
    } catch (e) {
      /* The script exits non-zero when a path is broken, and its stdout names
         which one. Surfacing that is the entire value: "the verifier failed"
         would send somebody to read a script instead of a column list. */
      const err = e as { stdout?: Buffer | string; message?: string };
      out = String(err.stdout ?? err.message ?? e);
      const broken = out.split("\n").filter((l) => /^(FAIL|THROW)/.test(l));
      expect(broken, `broken query paths:\n${broken.join("\n")}`).toEqual([]);
    }

    expect(out, "the verifier did not report a result").toMatch(/All \d+ query paths OK/);
  });

  it("is wired into npm run verify, so it cannot be forgotten again", async () => {
    /* The script existed for two weeks and was in neither `test` nor `verify`.
       A guard nobody runs is a guard that does not exist, and this is the
       cheapest possible statement of that. */
    const pkg = JSON.parse(
      await import("node:fs").then((fs) => fs.readFileSync("package.json", "utf8")),
    ) as { scripts: Record<string, string> };

    expect(
      pkg.scripts.verify,
      "npm run verify must run the test suite, which now includes this file",
    ).toMatch(/vitest run/);
  });
});
