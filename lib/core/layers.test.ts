import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The layer boundaries, enforced.
 *
 * Dependencies point one way: components import from lib/prototype and
 * lib/core, never the reverse. This is not style. `TrustState` once lived in a
 * React component that two domain modules imported, and when the component came
 * to need one of them back, the readout page stopped hydrating — with no error
 * anywhere, no failed request, and a page that rendered perfectly and responded
 * to nothing. It cost an afternoon to find and the fix was thirty seconds.
 *
 * A convention nobody can check is a convention that lasts until the first
 * hurry. This checks it.
 */

function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (/\.tsx?$/.test(e) && !e.endsWith(".test.ts")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const read = (f: string) => readFileSync(f, "utf8");

describe("layer boundaries", () => {
  it("the domain layer imports no React and no framework", () => {
    const offenders = sources("lib/core").filter((f) => {
      const s = read(f);
      return /from "react"|from "next\//.test(s);
    });
    expect(offenders, "lib/core must stay framework-free").toEqual([]);
  });

  it("the domain layer performs no I/O", () => {
    /* Purity is what makes every contract in handoff.md testable without a
       database, a network, or a browser. */
    const offenders = sources("lib/core").filter((f) => /\bfetch\(|createClient\(/.test(read(f)));
    expect(offenders, "lib/core must stay I/O-free").toEqual([]);
  });

  it("the domain layer never imports a component", () => {
    const offenders = sources("lib/core").filter((f) => /from "@\/components/.test(read(f)));
    expect(offenders, "domain must not depend on the UI that draws it").toEqual([]);
  });

  it("the data layer is server-only", () => {
    /* Without the directive, importing one of these from a client component is
       a runtime surprise instead of a build error — and the thing that leaks is
       the service-role key's reach. */
    const missing = sources("lib/db").filter((f) => !read(f).includes('import "server-only"'));
    expect(missing, "every lib/db module needs the server-only import").toEqual([]);
  });

  it("no client component imports the data layer", () => {
    const offenders = [...sources("app"), ...sources("components")].filter((f) => {
      const s = read(f);
      return s.includes('"use client"') && /from "@\/lib\/db\//.test(s);
    });
    expect(offenders, "server-only modules cannot be reached from the browser").toEqual([]);
  });

  it("production surfaces do not import prototype fixtures", () => {
    /* The prototype is the specification, not a data source. A production page
       reading fixtures looks like it works right up until somebody asks why a
       real client is called Maya Ellison. */
    const offenders = [...sources("app/(rift)"), ...sources("app/(studio)"), ...sources("lib/db")]
      .filter((f) => /from "@\/lib\/prototype\/(fixtures|clients)"/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
