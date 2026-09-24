import { describe, it, expect } from "vitest";
import { readRegistry } from "./programs";

/**
 * The re-check window is a setting, not a constant.
 *
 * `readRegistry` read `DEFAULT_RULES.registryDays.value` directly, which made
 * it a constant wearing a setting's clothes: /operations/settings could record a
 * decision about it and every programme would go on being suppressed at
 * ninety days regardless. That is the specific failure a settings page
 * introduces if nobody checks: a dial the agent turns, that changes nothing,
 * and reports no error while doing so.
 *
 * No database here. With none configured `readRegistry` falls back to the
 * seeded registry, which is real verified data and exactly the surface these
 * assertions need.
 */

/* Fixed, because "is this programme stale" is a question about elapsed days
   and a test that asks it against the real clock answers differently every
   morning. */
const TODAY = new Date("2026-09-20T12:00:00Z");

describe("the window the caller asks for", () => {
  it("is used instead of the default", async () => {
    const r = await readRegistry(TODAY, 1);
    expect(r.ok && "data" in r).toBe(true);
    if (!r.ok || !("data" in r)) return;
    expect(r.data.windowDays).toBe(1);
  });

  it("suppresses everything when it is short enough", async () => {
    /* One day. Nothing in a hand-verified registry was checked yesterday, so
       the correct outcome is an empty customer-facing list, and the agent
       seeing every programme in the withheld panel. */
    const r = await readRegistry(TODAY, 1);
    if (!r.ok || !("data" in r)) throw new Error("expected data");
    expect(r.data.programs).toEqual([]);
    expect(r.data.suppressed.length).toBeGreaterThan(0);
  });

  it("shows everything when it is long enough", async () => {
    const r = await readRegistry(TODAY, 3650);
    if (!r.ok || !("data" in r)) throw new Error("expected data");
    expect(r.data.programs.length).toBeGreaterThan(0);
    expect(r.data.suppressed).toEqual([]);
  });

  it("falls back to the default rather than accepting zero", async () => {
    /* Zero or negative pushes the cutoff into the future and suppresses the
       entire registry. A page of no programmes renders perfectly, says
       nothing is available in Georgia, and is wrong, so a nonsense value
       must not be honoured just because somebody typed it. */
    const zero = await readRegistry(TODAY, 0);
    const negative = await readRegistry(TODAY, -5);
    const nan = await readRegistry(TODAY, NaN);
    for (const r of [zero, negative, nan]) {
      if (!r.ok || !("data" in r)) throw new Error("expected data");
      expect(r.data.windowDays).toBe(90);
    }
  });

  it("uses the default when the caller asks for nothing in particular", async () => {
    const r = await readRegistry(TODAY);
    if (!r.ok || !("data" in r)) throw new Error("expected data");
    expect(r.data.windowDays).toBe(90);
  });

  it("rounds a fractional window rather than comparing against a fraction", async () => {
    const r = await readRegistry(TODAY, 45.6);
    if (!r.ok || !("data" in r)) throw new Error("expected data");
    expect(r.data.windowDays).toBe(46);
  });
});
