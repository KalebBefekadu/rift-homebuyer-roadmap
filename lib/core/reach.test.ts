import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_RULES, RULE_LABEL, RULE_REACH, mergeRules, undecidedIn, type BusinessRules } from "./settings";

/**
 * A settings page has one way to fail badly, and it is not a crash.
 *
 * It is a dial connected to nothing: the agent sets his commission to 3%,
 * every screen agrees with him, and a forecast he has been quoting for a
 * quarter turns out to have been computed at 2.5 the whole time. Nothing
 * throws. This is the same shape as every other defect in this product, with
 * the difference that building a settings page is how you introduce it
 * deliberately.
 *
 * Five of the six rules currently reach nothing: the screens they price or
 * govern are prototype-only. That is fine and it is said on the page. What is
 * not fine is the claim drifting from the code, so these tests hold
 * RULE_REACH to the source.
 */

const keys = Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[];

describe("every rule accounts for itself", () => {
  it("has a label", () => {
    for (const k of keys) expect(RULE_LABEL[k], k).toBeTruthy();
  });

  it("says whether it is in force, and where", () => {
    for (const k of keys) {
      expect(RULE_REACH[k], k).toBeDefined();
      expect(RULE_REACH[k].where.length, k).toBeGreaterThan(20);
    }
  });

  it("names a real consumer for each rule it calls live", () => {
    /* A live claim is checkable: something outside lib/core/settings.ts has
       to actually read that rule. This is the assertion that stops RULE_REACH
       becoming a comment that used to be true. */
    function files(dir: string): string[] {
      let out: string[] = [];
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) out = out.concat(files(full));
        else if ((e.endsWith(".ts") || e.endsWith(".tsx")) && !e.includes(".test.")) out.push(full);
      }
      return out;
    }

    const body = ["lib/db", "app/(rift)", "app/(operations)"]
      .flatMap(files)
      .filter((f) => !f.includes("settings"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    for (const k of keys) {
      if (!RULE_REACH[k].live) continue;
      expect(body.includes(k), `${k} is marked live but nothing outside settings reads it`).toBe(true);
    }
  });
});

describe("merging what was stored", () => {
  it("keeps the defaults when nothing is stored", () => {
    expect(mergeRules({})).toEqual(DEFAULT_RULES);
  });

  it("takes a stored value of the right shape", () => {
    expect(mergeRules({ commissionPct: 3 }).commissionPct.value).toBe(3);
  });

  it("keeps the product's own prose rather than a stored copy of it", () => {
    /* Value-only. A saved blob from an older version carrying stale `affects`
       text would otherwise overwrite the current wording, and that wording is
       how the agent knows what he is changing. */
    const merged = mergeRules({ commissionPct: 3 });
    expect(merged.commissionPct.affects).toBe(DEFAULT_RULES.commissionPct.affects);
    expect(merged.commissionPct.owner).toBe(DEFAULT_RULES.commissionPct.owner);
  });

  it("refuses a value of the wrong type rather than letting it through", () => {
    /* jsonb holds anything. A string where commissionPct belongs multiplies
       into every revenue figure without throwing. */
    expect(mergeRules({ commissionPct: "3" as unknown }).commissionPct.value).toBe(2.5);
    expect(mergeRules({ autoEmailReadout: 1 as unknown }).autoEmailReadout.value).toBe(false);
  });

  it("refuses NaN and Infinity, which are both typeof number", () => {
    expect(mergeRules({ registryDays: NaN as unknown }).registryDays.value).toBe(90);
    expect(mergeRules({ registryDays: Infinity as unknown }).registryDays.value).toBe(90);
  });

  it("refuses an empty string", () => {
    expect(mergeRules({ registryOwner: "   " as unknown }).registryOwner.value).toBe("Kaleb");
  });

  it("ignores a key that is not one of ours", () => {
    const merged = mergeRules({ somethingElse: 9 } as Record<string, unknown>);
    expect(merged).toEqual(DEFAULT_RULES);
  });
});

describe("telling a decision from a default", () => {
  it("calls everything undecided when nothing is stored", () => {
    expect(undecidedIn({}).sort()).toEqual(keys.slice().sort());
  });

  it("stops calling a key undecided once it has a usable value", () => {
    expect(undecidedIn({ commissionPct: 3 })).not.toContain("commissionPct");
  });

  it("still calls it undecided when the stored value is unusable", () => {
    /* The whole point. A bad row must not read as a decision: the agent
       would see his own value on screen and it would not be the one in use. */
    expect(undecidedIn({ commissionPct: "3" as unknown })).toContain("commissionPct");
  });

  it("treats a stored value equal to the default as decided", () => {
    /* "I looked at this and 2.5 is right" is a different fact from "nobody
       has ever opened this page", and the table records who and when. */
    expect(undecidedIn({ commissionPct: 2.5 })).not.toContain("commissionPct");
  });
});

describe("the re-check window actually reaches the registry", () => {
  const programs = readFileSync("lib/db/programs.ts", "utf8");

  it("takes the window as an argument rather than reading the constant", () => {
    expect(programs).toMatch(/readRegistry\(today = new Date\(\), overrideDays\?: number\)/);
  });

  it("is passed the agent's own value by both callers", () => {
    const studio = readFileSync("app/(operations)/operations/page.tsx", "utf8");
    const buyers = readFileSync("app/(rift)/buy/programs/page.tsx", "utf8");
    expect(studio).toContain("registryDays.value");
    expect(buyers).toContain("registryDays.value");
  });

  it("falls back to the default for a value that could suppress everything", () => {
    /* 0 and negative would push the cutoff into the future and suppress the
       whole registry: a page of no programmes, which renders perfectly. */
    expect(programs).toContain("overrideDays > 0");
  });
});
