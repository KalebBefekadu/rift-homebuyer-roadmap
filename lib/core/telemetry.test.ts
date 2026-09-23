import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { sanitise, ALLOWED_META } from "./telemetry";

/**
 * The rule that cannot be walked back.
 *
 * An answer value that reaches the analytics table is a stranger's situation
 * sitting in an analytics store, and deleting it later does not undo having
 * collected it. There is no recovering from this one, so it is checked in
 * three places and this file checks that all three still agree.
 *
 * The specific failure it was written after: `sanitise` was a blocklist of
 * eleven key names and the database constraint was a blocklist of three. The
 * buyers-abroad landing page sent `status`: citizen, resident, ITIN, or no
 * U.S. status: on every page view, and it was on neither list. Residency
 * status is a close proxy for national origin, which is a protected class
 * under the Fair Housing Act. Nothing failed.
 */
describe("what telemetry may carry", () => {
  it("keeps the keys on the list", () => {
    expect(sanitise({ page: "abroad", step: 3, of: 7, live: true }))
      .toEqual({ page: "abroad", step: 3, of: 7, live: true });
  });

  it("drops the residency status that started all this", () => {
    expect(sanitise({ page: "abroad", status: "foreign", use: "rent" }))
      .toEqual({ page: "abroad" });
  });

  it("drops anything else nobody approved, whatever it is called", () => {
    /* The point of an allowlist: this passes for keys nobody has thought of
       yet, which is where the last one came from. */
    for (const key of ["status", "county", "savings", "income", "timing", "zip", "ownership", "lang"]) {
      expect(sanitise({ [key]: "x" }), `${key} must not survive`).toEqual({});
    }
  });

  it("drops objects and arrays even under an allowed key", () => {
    /* A nested object is a place to hide a payload, and `payload ? 'key'` in
       the database only inspects top-level keys. */
    expect(sanitise({ page: { deep: "value" }, step: [1, 2] } as never)).toEqual({});
  });

  it("does not quietly accept a key that differs only in case", () => {
    /* The blocklist lowercased before comparing, which meant `Status` and
       `status` were treated as the same key. An allowlist must not do the
       reverse and admit `Page` as though somebody had approved it. */
    expect(sanitise({ Page: "abroad", PAGE: "abroad" })).toEqual({});
  });

  it("agrees with the database, key for key", () => {
    /* Two allowlists that drift apart are worse than one: the application
       would filter to a set the constraint refuses, and every event would be
       rejected at the database with nothing on screen to say so. */
    const dir = "supabase/migrations";
    const migration = readdirSync(dir)
      .filter((f) => f.includes("events_allowlist"))
      .sort()
      .at(-1);
    expect(migration, "the allowlist migration should exist").toBeTruthy();

    const sql = readFileSync(`${dir}/${migration}`, "utf8");
    /* The list as the CHECK constraint spells it: the last array in the file,
       which is the one inside `alter table ... add constraint`. */
    const arrays = [...sql.matchAll(/payload - array\[([\s\S]*?)\]/g)];
    expect(arrays.length, "the constraint should subtract an allowlist").toBeGreaterThan(0);

    const inSql = arrays
      .at(-1)![1]
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean)
      .sort();

    expect(inSql).toEqual([...ALLOWED_META].sort());
  });

  it("never lets `status` back onto the list", () => {
    /* Named explicitly rather than left to the general rule. In this product
       that word means somebody's situation; the one legitimate use is the
       readout's computed readiness band and it is called `band` so that this
       assertion can stay absolute. */
    expect(ALLOWED_META).not.toContain("status");
  });

  it("covers every meta key the product actually sends", () => {
    /* The other direction: a key the app sends that the list forgets is
       silently dropped, and the symptom is a funnel report missing a column
       nobody remembers asking for. */
    const sources: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "prototype" && e.name !== "node_modules") walk(p); continue; }
        if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts")) sources.push(p);
      }
    };
    walk("app"); walk("components");

    const used = new Set<string>();
    for (const f of sources) {
      for (const m of readFileSync(f, "utf8").matchAll(/meta:\s*\{([^}]*)\}/g)) {
        for (const part of m[1].split(",")) {
          const key = part.trim().split(":")[0]?.trim();
          /* Shorthand (`{ live }`) names the key as the variable. */
          if (key && /^[A-Za-z_$][\w$]*$/.test(key)) used.add(key);
        }
      }
    }

    const missing = [...used].filter((k) => !(ALLOWED_META as readonly string[]).includes(k));
    expect(missing, "these are sent but would be dropped").toEqual([]);
  });
});
