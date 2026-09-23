import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A house rule, not a unit test.
 *
 * Kaleb asked on 23 September 2026 for the em dash to be removed from the whole
 * site and never used again. Every occurrence was rewritten by hand into a
 * comma, colon, semicolon, full stop or parentheses, whichever the sentence
 * needed. This keeps it that way: a new string, comment, email or migration
 * carrying the sign fails here, including the escaped spellings a template or
 * JSX entity would render as the same character.
 *
 * The patterns are built from char codes so that this file does not contain
 * what it forbids.
 */
const DASH = String.fromCharCode(0x2014);
const FORBIDDEN = [DASH, "&" + "mdash;", "&#" + "8212;", "\\" + "u2014", "&#x" + "2014;"];

const ROOTS = ["app", "components", "lib", "e2e", "scripts", "supabase", "types"];
const SKIP = new Set(["node_modules", ".next", ".temp"]);
const TEXT = /\.(tsx?|mjs|cjs|js|sql|sh|json|css)$/;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (TEXT.test(name)) out.push(path);
  }
  return out;
}

describe("punctuation", () => {
  it("has no em dash anywhere in the site's source, copy, email or SQL", () => {
    const found: string[] = [];
    for (const root of ROOTS) {
      for (const file of files(root)) {
        readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          if (FORBIDDEN.some((f) => line.includes(f))) found.push(`${file}:${i + 1}`);
        });
      }
    }
    expect(found, "use a comma, colon, semicolon, full stop or parentheses instead").toEqual([]);
  });
});
