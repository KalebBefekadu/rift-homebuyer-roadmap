import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, RULE_LABEL, type BusinessRules } from "./settings";

/**
 * The decisions that are the owner's, not engineering's.
 *
 * Each one sat in the code as a literal: "a decision that lives in a constant
 * has been made by whoever typed the constant": and is now a setting stored
 * in `rift_business_rules` (lib/db/settings.ts).
 * The prototype's localStorage copy of these, and its tests, went with the
 * prototype on 13 October 2026.
 */

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
