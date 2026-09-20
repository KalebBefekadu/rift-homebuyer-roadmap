import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/**
 * Nothing a stranger can reach may link into /prototype.
 *
 * `/prototype/*` returns 404 in production — deliberately, it is the design
 * prototype and it is not the product. The trouble is that three components
 * are shared between the prototype and the real funnels, and one of them,
 * `components/rift/Readout.tsx`, is the shell the live seller readout renders
 * inside. When /prototype was closed, that page kept five links pointing into
 * it: the logo, "Change my answers", "Sign in", "About Kaleb", and the
 * cross-sell to the buyer product.
 *
 * Every test passed. The page rendered. `<Link href="/prototype/sell">` is not
 * an error until a person clicks it, and the person who clicks it is a seller
 * who has just been shown their equity and wants to change an answer.
 *
 * So the rule is enforced across the import graph rather than per file: walk
 * out from every production route through everything it imports, and refuse a
 * prototype link anywhere in that closure. A shared component is free to point
 * at /prototype right up until the moment production starts rendering it.
 */

const SEED_ROOTS = ["app/(rift)", "app/(studio)"];
const EXTS = [".tsx", ".ts"];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (EXTS.some((e) => entry.endsWith(e)) && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

/** `@/x` → `x`, `./x` → resolved against the importer. Anything else is a package. */
function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec).replace(`${process.cwd()}/`, "");
  else return null;

  for (const ext of EXTS) {
    if (existsSync(base + ext)) return base + ext;
    if (existsSync(join(base, `index${ext}`))) return join(base, `index${ext}`);
  }
  return existsSync(base) && statSync(base).isFile() ? base : null;
}

function importsOf(src: string, from: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
    const r = resolveImport(m[1]!, from);
    if (r) out.push(r);
  }
  return out;
}

/** Everything production can render, following imports until nothing is new. */
function productionClosure(): Set<string> {
  const seen = new Set<string>();
  const queue = SEED_ROOTS.flatMap(walk);

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...importsOf(readFileSync(file, "utf8"), file));
  }
  return seen;
}

/* `href="/prototype…"` and `` href={`/prototype…`} `` alike. */
const PROTOTYPE_LINK = /href=(?:"|\{`)\/prototype/;

describe("the production import graph", () => {
  const closure = productionClosure();

  it("reaches the shared components, or it is not testing anything", () => {
    expect(closure.has("components/rift/Readout.tsx")).toBe(true);
    expect(closure.has("lib/core/compute.ts")).toBe(true);
  });

  it("leaves the prototype-only shells out", () => {
    /* These link into /prototype on purpose and are rendered only by
       /prototype/*. If one of them ever appears here, its links become live
       404s and the test below is the one that should say so. */
    expect(closure.has("components/rift/Shell.tsx")).toBe(false);
    expect(closure.has("components/rift/ProductShell.tsx")).toBe(false);
  });

  it("contains no link into /prototype", () => {
    const dead = [...closure]
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((f) => {
        const src = readFileSync(f, "utf8");
        return src
          .split("\n")
          .map((line, i) => (PROTOTYPE_LINK.test(line) ? `${f}:${i + 1}` : null))
          .filter((x): x is string => x !== null);
      });

    expect(
      dead,
      "/prototype returns 404 in production, so each of these is a dead link on a live page",
    ).toEqual([]);
  });
});
