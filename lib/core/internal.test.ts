import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { internalHidden } from "./internal";

describe("which surfaces are internal", () => {
  it("hides them in a production build", () => {
    expect(internalHidden({ NODE_ENV: "production" })).toBe(true);
  });

  it("serves them in development and in test", () => {
    expect(internalHidden({ NODE_ENV: "development" })).toBe(false);
    expect(internalHidden({ NODE_ENV: "test" })).toBe(false);
  });

  /* The failure this guards against is a deployment where the variable is
     simply absent. Defaulting to "hidden" means that deployment is boring
     rather than a quiet exposure. */
  it("hides them in any environment it does not recognise", () => {
    expect(internalHidden({})).toBe(true);
    expect(internalHidden({ NODE_ENV: "" })).toBe(true);
    expect(internalHidden({ NODE_ENV: "staging" })).toBe(true);
    expect(internalHidden({ NODE_ENV: "preview" })).toBe(true);
    expect(internalHidden({ NODE_ENV: "production", RIFT_INTERNAL: undefined })).toBe(true);
  });

  it("opens them deliberately, and only for the exact value", () => {
    expect(internalHidden({ NODE_ENV: "production", RIFT_INTERNAL: "1" })).toBe(false);
    for (const loose of ["true", "yes", "0", "", "TRUE"]) {
      expect(internalHidden({ NODE_ENV: "production", RIFT_INTERNAL: loose })).toBe(true);
    }
  });
});

/**
 * A drift guard, not a unit test.
 *
 * `robots.ts` is where somebody writes down "this is not for the public". It
 * is also the weaker half of that statement: a disallow keeps a page out of
 * an index and serves it to anybody with the URL. So every non-API path listed
 * there must also be refused in code, and adding a new one to robots without a
 * refusal should fail here rather than on the day somebody finds it.
 */
describe("every disallowed page is refused, not merely uncrawled", () => {
  const robots = readFileSync("app/robots.ts", "utf8");
  const disallow = (robots.match(/disallow:\s*\[([\s\S]*?)\]/)?.[1] ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);

  it("reads the list out of robots.ts", () => {
    expect(disallow).toContain("/prototype/");
    expect(disallow).toContain("/dev");
  });

  /* The ones whose refusal lives somewhere this test cannot see: an auth
     check, a token, or a route that is private by construction. */
  const ELSEWHERE: Record<string, string> = {
    "/api/": "each route guards itself; see lib/db/guard.ts",
    "/r/": "the token IS the credential: app/(rift)/r/[token]/page.tsx",
    "/buy/results": "a readout is public by design; that is the product",
    "/sell/results": "a readout is public by design; that is the product",
    "/abroad/results": "a readout is public by design; that is the product",
    "/book": "public by design",
    "/studio": "behind Supabase auth: app/(studio)/studio/page.tsx",
  };

  for (const path of disallow) {
    if (path in ELSEWHERE) continue;
    it(`${path} refuses in production`, () => {
      const dir = `app${path.replace(/\/$/, "")}`;
      const file = path.endsWith("/") ? `${dir}/layout.tsx` : `${dir}/page.tsx`;
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must call internalHidden() and notFound()`).toMatch(
        /internalHidden\(process\.env\)\)\s*notFound\(\)/,
      );
    });
  }
});

describe("robots and the sitemap agree", () => {
  /* Two lists of public paths, written in two files, that have to say the
     same thing. /privacy was added to the sitemap and not to robots, and
     nothing noticed because `Allow: /` happens to cover everything: so the
     explicit list quietly became decorative while still looking like policy.
     
     The failure this guards against is the other direction: a page submitted
     for indexing that robots disallows. That one produces a Search Console
     warning weeks later and no signal at all before it. */
  const robotsSrc = readFileSync("app/robots.ts", "utf8");
  const sitemapSrc = readFileSync("app/sitemap.ts", "utf8");

  /* Comments stripped first. A `/* … *\/` inside either array put the comment
     text through the quoted-string match, and the suite then asserted that a
     route called "deposit, county and residency status in a URL" refuses in
     production. The parser was reading prose as data. */
  const bare = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  const list = (raw: string, key: string) => {
    const src = bare(raw);
    const at = src.indexOf(`${key}: [`);
    if (at === -1) return [];
    const body = src.slice(at, src.indexOf("]", at));
    return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  };

  const allowed = list(robotsSrc, "allow");
  const disallowed = list(robotsSrc, "disallow");
  const sitemap = [...sitemapSrc.matchAll(/\$\{base\}(\/[a-z/-]*)/g)].map((m) => m[1]!);

  it("reads both lists", () => {
    expect(allowed.length).toBeGreaterThan(5);
    expect(sitemap.length).toBeGreaterThan(5);
  });

  it("never submits a path it also refuses", () => {
    const contradictory = sitemap.filter((p) =>
      disallowed.some((d) => (d.endsWith("/") ? p.startsWith(d) : p === d)));
    expect(contradictory, "these are in the sitemap and disallowed in robots").toEqual([]);
  });

  it("allows every path it submits", () => {
    const missing = sitemap.filter((p) => !allowed.includes(p));
    expect(
      missing,
      "in the sitemap but not in robots' allow list, covered only by the bare `Allow: /`",
    ).toEqual([]);
  });
});
