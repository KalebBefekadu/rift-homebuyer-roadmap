import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { authoriseCron } from "./cron";

/**
 * The scheduled jobs, and the thing that had silently stopped them.
 *
 * The second half of this file is a drift guard rather than a unit test, and
 * it earns its place: the bug it pins produced no error, no log line and no
 * failing check anywhere. `vercel.json` scheduled two jobs, both routes
 * exported `POST` only, Vercel's scheduler sends GET, and so for the whole
 * life of the deployment every run returned 405. Health reported
 * `scheduler: configured`, which was true and useless.
 *
 * Nothing in a type system catches an HTTP verb a platform chose. A test that
 * reads the route files does.
 */

const SECRET = "s3cr3t";

describe("authorising a scheduled run", () => {
  it("refuses to run at all when no secret is configured", () => {
    const v = authoriseCron(`Bearer ${SECRET}`, undefined);
    expect(v.ok).toBe(false);
    /* 503, not 401. The caller is fine; the deployment is not, and a monitor
       should be able to tell those apart without reading prose. */
    expect(v).toMatchObject({ status: 503 });
  });

  it("refuses an empty secret, which is how a missing variable usually arrives", () => {
    expect(authoriseCron("Bearer ", "")).toMatchObject({ ok: false, status: 503 });
  });

  it("refuses a missing, malformed or wrong credential", () => {
    for (const header of [null, "", SECRET, `Basic ${SECRET}`, "Bearer wrong", `bearer ${SECRET}`]) {
      expect(authoriseCron(header, SECRET), `header: ${String(header)}`)
        .toMatchObject({ ok: false, status: 401 });
    }
  });

  it("admits the scheduler's credential", () => {
    expect(authoriseCron(`Bearer ${SECRET}`, SECRET)).toEqual({ ok: true });
  });
});

describe("the scheduled routes answer the scheduler", () => {
  /* Read from vercel.json so adding a third cron cannot quietly skip this. */
  const scheduled: { path: string }[] =
    JSON.parse(readFileSync("vercel.json", "utf8")).crons ?? [];

  it("schedules the three jobs the product cannot run without", () => {
    /* Containment, not equality. The loop below is what actually protects the
       product, and it covers whatever is scheduled — so a fourth cron must not
       have to edit this line to be allowed to exist. What is asserted here is
       that these three have not been quietly dropped. */
    const paths = scheduled.map((c) => c.path);
    for (const required of ["/api/nurture/run", "/api/retention/sweep", "/api/rates/refresh"]) {
      expect(paths, `${required} is no longer scheduled`).toContain(required);
    }
  });

  for (const { path } of scheduled) {
    it(`${path} exports GET, which is the only verb Vercel will send it`, () => {
      const src = readFileSync(`app${path}/route.ts`, "utf8");
      expect(src, `${path} must export GET or the scheduler gets a 405 forever`)
        .toMatch(/export (const|async function) GET/);
    });

    it(`${path} is behind the shared cron guard`, () => {
      const src = readFileSync(`app${path}/route.ts`, "utf8");
      expect(src, `${path} must call cronRefusal — a scheduled job open to the public sends email and deletes rows`)
        .toMatch(/cronRefusal\(req\)/);
    });
  }
});
