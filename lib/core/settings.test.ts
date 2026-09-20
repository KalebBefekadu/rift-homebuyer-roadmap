import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RULES, RULE_LABEL, readRules, resetRules, undecided, writeRule,
  type BusinessRules,
} from "./settings";

/**
 * The decisions that are the owner's, not engineering's.
 *
 * Each one sat in the code as a literal — "a decision that lives in a constant
 * has been made by whoever typed the constant" — and is now a setting stored
 * in the browser. Which means every one of them is read back out of a store
 * that survives a schema change, a half-finished edit, and anything typed into
 * a console.
 */

const KEY = "rift.rules";

/** A localStorage good enough to be wrong in the ways the real one is. */
function stubStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
    dispatchEvent: () => true,
  });
  return map;
}

let store: Map<string, string>;
beforeEach(() => { store = stubStorage(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("the defaults are a defensible starting position", () => {
  it("labels every rule and says who owns it", () => {
    for (const k of Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]) {
      expect(RULE_LABEL[k], k).toBeTruthy();
      expect(DEFAULT_RULES[k].owner.trim(), k).not.toBe("");
      expect(DEFAULT_RULES[k].affects.trim().length, k).toBeGreaterThan(30);
    }
  });

  it("starts the two conflict-shaped rules switched off", () => {
    /* Soliciting the counterparty mid-transaction, and emailing an address
       nobody confirmed. Both default to no. */
    expect(DEFAULT_RULES.marketUnrepresented.value).toBe(false);
    expect(DEFAULT_RULES.autoEmailReadout.value).toBe(false);
  });

  it("hands the two rules that are not the agent's to somebody else", () => {
    expect(DEFAULT_RULES.clientRetentionYears.owner).toContain("broker");
    expect(DEFAULT_RULES.marketUnrepresented.owner).toContain("broker");
  });
});

describe("reading rules back out of the browser", () => {
  it("falls back to the defaults with nothing stored", () => {
    expect(readRules()).toEqual(DEFAULT_RULES);
  });

  it("takes a stored value and keeps the prose from the code", () => {
    writeRule("commissionPct", 3);
    const r = readRules();
    expect(r.commissionPct.value).toBe(3);
    /* The wording is the single source and must not be overwritten by a stale
       saved copy of an earlier version of it. */
    expect(r.commissionPct.affects).toBe(DEFAULT_RULES.commissionPct.affects);
    expect(r.commissionPct.owner).toBe(DEFAULT_RULES.commissionPct.owner);
  });

  it("leaves rules nobody has touched alone", () => {
    writeRule("commissionPct", 3);
    expect(readRules().registryDays.value).toBe(DEFAULT_RULES.registryDays.value);
  });

  it("survives a corrupted store", () => {
    store.set(KEY, "{not json");
    expect(readRules()).toEqual(DEFAULT_RULES);
  });
});

/**
 * `commissionPct` is described in its own note as "the only number in the
 * product that turns pipeline into money". The merge used to carry a saved
 * value straight onto the rule behind a `@ts-expect-error` saying the type was
 * "checked by the setter". The setter stores whatever it is handed.
 */
describe("a stored value of the wrong shape is ignored, not used", () => {
  const bad: Record<string, unknown[]> = {
    commissionPct: ["2.5", null, true, [], {}, Number.NaN, Number.POSITIVE_INFINITY],
    registryDays: ["90", null, false, Number.NaN],
    clientRetentionYears: ["5", null, Number.NEGATIVE_INFINITY],
    autoEmailReadout: ["true", 1, null, "yes"],
    marketUnrepresented: ["false", 0, null],
    registryOwner: [5, null, true, "", "   "],
  };

  for (const [k, values] of Object.entries(bad)) {
    for (const v of values) {
      it(`${k}: ${JSON.stringify(v) ?? String(v)} falls back to the default`, () => {
        store.set(KEY, JSON.stringify({ [k]: v }));
        const key = k as keyof BusinessRules;
        expect(readRules()[key].value).toBe(DEFAULT_RULES[key].value);
      });
    }
  }

  it("never lets a non-finite number reach a revenue figure", () => {
    for (const v of [Number.NaN, Infinity, -Infinity]) {
      store.set(KEY, JSON.stringify({ commissionPct: v }));
      expect(Number.isFinite(readRules().commissionPct.value)).toBe(true);
    }
  });

  it("keeps a good value when a bad one sits beside it", () => {
    store.set(KEY, JSON.stringify({ commissionPct: "nonsense", registryDays: 45 }));
    const r = readRules();
    expect(r.commissionPct.value).toBe(DEFAULT_RULES.commissionPct.value);
    expect(r.registryDays.value).toBe(45);
  });

  it("accepts a legitimate value of every type", () => {
    writeRule("commissionPct", 3.25);
    writeRule("autoEmailReadout", true);
    writeRule("registryOwner", "Someone else");
    const r = readRules();
    expect(r.commissionPct.value).toBe(3.25);
    expect(r.autoEmailReadout.value).toBe(true);
    expect(r.registryOwner.value).toBe("Someone else");
  });

  it("accepts zero and false, which are values rather than absences", () => {
    writeRule("commissionPct", 0);
    writeRule("autoEmailReadout", false);
    expect(readRules().commissionPct.value).toBe(0);
    expect(readRules().autoEmailReadout.value).toBe(false);
    expect(undecided()).not.toContain("commissionPct");
  });
});

describe("which decisions have actually been made", () => {
  it("starts with all of them outstanding", () => {
    expect(undecided()).toEqual(Object.keys(DEFAULT_RULES));
  });

  it("drops one once it is chosen, even to the same value as the default", () => {
    writeRule("registryDays", DEFAULT_RULES.registryDays.value);
    expect(undecided()).not.toContain("registryDays");
    expect(undecided()).toContain("commissionPct");
  });

  it("puts them all back on reset", () => {
    writeRule("commissionPct", 3);
    resetRules();
    expect(undecided()).toEqual(Object.keys(DEFAULT_RULES));
    expect(readRules()).toEqual(DEFAULT_RULES);
  });
});
