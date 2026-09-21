import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A public page that no crawler can find.
 *
 * `app/sitemap.ts` is a hand-written list, which means shipping a new public
 * page and forgetting to add it produces nothing at all: no error, no failing
 * test, a valid sitemap, a 200 on the page. The page simply never appears in a
 * search result, and the only way to notice is for somebody to go looking for
 * a thing they have no reason to suspect is missing.
 *
 * That is this product's recurring failure shape — /sitemap.xml already
 * shipped once serving valid XML with zero URLs in it — so the list gets a
 * guard rather than a note.
 *
 * The rule is derived, not restated. Anything under app/(rift) with a fixed
 * path and no `index: false` in its metadata is a page meant to be found, and
 * must be listed.
 */

const ROOT = join(process.cwd(), "app", "(rift)");
const SITEMAP = readFileSync(join(process.cwd(), "app", "sitemap.ts"), "utf8");

function routes(dir: string, prefix = ""): { route: string; source: string }[] {
  const out: { route: string; source: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    /* A parameterised route is one person's URL, never a sitemap entry. */
    if (entry.startsWith("[")) continue;
    /* Route groups add a folder and no path segment. */
    const segment = entry.startsWith("(") ? "" : `/${entry}`;
    const here = `${prefix}${segment}`;
    if (readdirSync(full).includes("page.tsx")) {
      out.push({ route: here || "/", source: readFileSync(join(full, "page.tsx"), "utf8") });
    }
    out.push(...routes(full, here));
  }
  return out;
}

const all = routes(ROOT);

/** Pages that ask not to be indexed say so in their own metadata. */
const noindex = (src: string) => /index:\s*false|noindex/.test(src);

/**
 * And pages robots.txt already refuses.
 *
 * Read rather than restated. Writing the exceptions out here a second time is
 * how the two lists drift — which is precisely what this file exists to stop,
 * and /book is the proof: it is deliberately disallowed, and a guard that did
 * not know that would have demanded it be submitted for indexing.
 */
const ROBOTS = readFileSync(join(process.cwd(), "app", "robots.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const DISALLOWED = [...ROBOTS.matchAll(/disallow:\s*\[([\s\S]*?)\]/g)]
  .flatMap((m) => [...m[1]!.matchAll(/"([^"]+)"/g)].map((q) => q[1]!));
const refused = (route: string) => DISALLOWED.some((d) => route === d || route.startsWith(d));

describe("every public page is findable", () => {
  it("finds the routes at all, so an empty sweep cannot pass silently", () => {
    /* The check above is worthless if `routes()` returns nothing — which is
       what a moved directory would produce, and it would read as success. */
    expect(all.length).toBeGreaterThan(8);
  });

  it("lists every indexable page in the sitemap", () => {
    const missing = all
      .filter((r) => !noindex(r.source))
      .filter((r) => !refused(r.route))
      .filter((r) => r.route !== "/")
      .filter((r) => !SITEMAP.includes(`\${base}${r.route}\``))
      .map((r) => r.route);

    expect(missing, `not in app/sitemap.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("reads the disallow list rather than assuming one", () => {
    /* If the regex ever stops matching, `refused()` returns false for
       everything and this file starts demanding that /book be indexed. */
    expect(DISALLOWED).toContain("/book");
    expect(DISALLOWED.length).toBeGreaterThan(5);
  });

  it("keeps the readouts out of it", () => {
    for (const r of all.filter((x) => x.route.endsWith("/results"))) {
      expect(SITEMAP.includes(`\${base}${r.route}\``), `${r.route} is one person's situation`).toBe(false);
    }
  });
});
