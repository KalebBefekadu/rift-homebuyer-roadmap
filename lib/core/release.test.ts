import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { buyerSearchOn } from "./journey";

/**
 * The release switch (blueprint v4 §8, AT40).
 *
 * `RIFT_BUYER_SEARCH=off` is the rollback: it disables every writer and page
 * this release added, and nothing else. The old share links, readouts, plans,
 * the scheduled jobs and deletion keep working, and no row is deleted.
 *
 * Asserted against the source, because what is guarded is that nobody later
 * adds a writer that forgets the switch, or makes an old link depend on it.
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(root, p)).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

describe("the switch", () => {
  it("is on unless it is explicitly off", () => {
    expect(buyerSearchOn({})).toBe(true);
    expect(buyerSearchOn({ RIFT_BUYER_SEARCH: "" })).toBe(true);
    expect(buyerSearchOn({ RIFT_BUYER_SEARCH: "on" })).toBe(true);
    for (const off of ["off", "OFF", " off "]) expect(buyerSearchOn({ RIFT_BUYER_SEARCH: off }), off).toBe(false);
  });
});

describe("switched off, every new writer refuses", () => {
  it("gates every Studio journey write before it does anything", () => {
    const src = read("app/(studio)/studio/journey/ops.ts");
    const ops = src.split("\nexport async function ").slice(1);
    expect(ops.length).toBeGreaterThan(20);
    for (const op of ops) {
      const name = op.slice(0, op.indexOf("("));
      const body = op.slice(op.indexOf(" {\n"), op.indexOf("\n}\n"));
      expect(body, `${name} does not check the switch`).toContain("await gate()");
      const g = body.indexOf("await gate()");
      for (const effect of ["await record", "await start", "await change", "await add", "await revise", "Journey(", "boundedWrite"]) {
        const at = body.indexOf(effect);
        if (at > -1) expect(at, `${name} does ${effect} before the gate`).toBeGreaterThan(g);
      }
    }
    expect(src).toMatch(/async function gate\(\)[\s\S]{0,120}if \(!buyerSearchOn\(process\.env\)\)/);
  });

  it("refuses the buyer's writes and both document links first thing", () => {
    for (const [file, fn] of [
      ["app/api/app/route.ts", "export async function POST"],
      ["app/api/app/document/route.ts", "export async function GET"],
      ["app/api/studio/document/route.ts", "export async function GET"],
    ]) {
      const src = read(file);
      const body = src.slice(src.indexOf(fn));
      const check = body.indexOf("buyerSearchOn(process.env)");
      expect(check, `${file} does not check the switch`).toBeGreaterThan(-1);
      for (const effect of ["clientSession(", "readJson(", "memberOf("]) {
        const at = body.indexOf(effect);
        if (at > -1) expect(at, `${file} calls ${effect} before the switch`).toBeGreaterThan(check);
      }
    }
  });

  it("closes the buyer's pages and the Studio journey page", () => {
    for (const file of [
      "app/(client)/app/page.tsx", "app/(client)/app/invite/[token]/page.tsx", "app/(client)/app/j/[id]/page.tsx",
      "app/(studio)/studio/journey/[id]/page.tsx",
    ]) expect(read(file), file).toContain("buyerSearchOn(process.env)");
  });
});

describe("switched off, what existed before keeps working", () => {
  /* Anything that imports the switch can be turned off by it. None of these
     may: an old link must open, a job must run and a deletion must complete
     whatever state the release is in. */
  const MUST_NOT_DEPEND = [
    ...files("app/(rift)/plan"), ...files("app/(rift)/r"), ...files("app/(rift)/buy"), ...files("app/(rift)/sell"),
    "app/api/plan/choose/route.ts", "app/api/readout/route.ts", "app/api/forget/route.ts", "app/api/capture/route.ts",
    "app/api/nurture/run/route.ts", "app/api/retention/sweep/route.ts", "app/api/rates/refresh/route.ts",
    "lib/db/retention.ts", "lib/db/plan.ts", "lib/db/nurture.ts",
  ];

  it("covers the old links, the jobs and deletion", () => {
    expect(MUST_NOT_DEPEND.length).toBeGreaterThan(15);
  });

  for (const file of MUST_NOT_DEPEND) {
    it(`${file} does not depend on the switch`, () => {
      expect(read(file)).not.toMatch(/buyerSearchOn|RIFT_BUYER_SEARCH/);
    });
  }
});
