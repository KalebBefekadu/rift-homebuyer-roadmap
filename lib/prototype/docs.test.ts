import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RETENTION } from "./privacy";
import { STALE_AFTER_DAYS } from "./registry";
import { DEFAULT_RULES } from "./settings";
import { DRIFT_PCT, CROSSINGS } from "./seam";
import { REVIEW_SLA_HOURS } from "./review";
import { SEQUENCES, STOPS } from "./nurture";
import { MOMENTS } from "./referral";

/**
 * The documentation drift guard.
 *
 * A review found six places where the docs and the code had quietly diverged —
 * a test count, two retention periods, a suppression window described as fixed
 * after it became configurable, and a phase gate that required a screen the
 * scope did not include. None were hard to fix. All six were found by a person
 * reading carefully, which is not a mechanism.
 *
 * The expensive one was retention: `docs/schema.md` said funnel telemetry was
 * kept 13 months while `privacy.ts` — the array actually rendered to the
 * customer at the bottom of every readout — said 24. An engineer implementing
 * the deletion job from the schema document would have built a product that
 * breaks a promise made on screen, and nothing would have failed.
 *
 * So the numbers that appear in both places are asserted here. This does not
 * check prose, and it is not meant to: it checks the handful of figures where
 * disagreement between a document and the code produces a wrong behaviour
 * rather than a confusing sentence.
 *
 * When one of these fails, the code is the source of truth and the document is
 * what needs changing — unless the code is genuinely wrong, in which case fix
 * it and the document together.
 */

const doc = (name: string) => readFileSync(join(process.cwd(), "docs", name), "utf8");

describe("docs match the code they describe", () => {
  it("schema.md states every retention rule, with the period the customer is shown", () => {
    const schema = doc("schema.md");
    for (const rule of RETENTION) {
      /* The client rule is expressed as a setting rather than a fixed period,
         because it has a legal floor nobody here gets to choose. */
      if (rule.id === "client") {
        expect(schema).toContain("business_rules.clientRetentionYears");
        continue;
      }
      expect(
        schema.toLowerCase(),
        `docs/schema.md does not state "${rule.keptFor}" for the "${rule.id}" retention rule`,
      ).toContain(rule.keptFor.toLowerCase());
    }
  });

  it("schema.md does not omit a retention rule", () => {
    /* A retention list missing one category is not a list, it is a selection.
       Scoped to the table under the Retention heading rather than pattern-matched
       across the file, so an unrelated table elsewhere cannot make this pass. */
    const after = doc("schema.md").split(/^## Retention$/m)[1] ?? "";
    const rows = after
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| ---") && !l.startsWith("| Data "));
    expect(rows.length, "the retention table has drifted from RETENTION").toBe(RETENTION.length);
  });

  it("product.md agrees with the customer-facing abandonment period", () => {
    const abandoned = RETENTION.find((r) => r.id === "abandoned")!;
    expect(doc("product.md")).toContain(abandoned.keptFor);
  });

  it("nobody documents the registry window as a fixed number", () => {
    /* It became a business rule. A document that still calls it 90 days teaches
       the next engineer to hard-code it, and the setting then changes nothing. */
    expect(STALE_AFTER_DAYS).toBe(DEFAULT_RULES.registryDays.value);
    for (const name of ["handoff.md", "product.md"]) {
      expect(doc(name), `${name} should name registryDays, not a bare 90 days`).toContain("registryDays");
    }
  });

  it("handoff.md states the real drift threshold and review promise", () => {
    const handoff = doc("handoff.md");
    expect(handoff).toContain(`${DRIFT_PCT}%`);
    expect(handoff).toContain(`${REVIEW_SLA_HOURS}h`);
  });

  it("the documented counts are the actual counts", () => {
    const all = ["handoff.md", "architecture.md", "benchmark.md"].map(doc).join("\n");
    expect(SEQUENCES.length).toBe(4);
    expect(STOPS.length).toBe(6);
    expect(MOMENTS.length).toBe(8);
    expect(CROSSINGS.length).toBe(10);
    expect(Object.keys(DEFAULT_RULES).length).toBe(6);
    /* Spelled out in prose, so assert the words the docs actually use. */
    expect(all).toContain("four sequences");
    expect(all).toContain("six stop conditions");
    expect(all).toContain("six business");
  });

  it("the stated test count is not smaller than the suite", () => {
    /* The count in the docs is a promise to whoever runs `npm test` next. */
    const suite = readFileSync(join(process.cwd(), "lib/prototype/compute.test.ts"), "utf8");
    const written = (suite.match(/\n\s{2}it\(/g) ?? []).length;
    for (const name of ["handoff.md", "setup.md"]) {
      const m = doc(name).match(/(\d+) tests/);
      expect(m, `${name} should state a test count`).not.toBeNull();
      expect(Number(m![1]), `${name} understates the suite`).toBeGreaterThanOrEqual(written);
    }
  });
});
