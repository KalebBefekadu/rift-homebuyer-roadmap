import { describe, it, expect } from "vitest";
import { BUY_FUNNEL, SELL_FUNNEL, optionsFor, needsOptions } from "./funnel";

/**
 * The funnels have to be completable.
 *
 * This exists because they were not. The county question is `type: "select"`
 * with no `options` of its own — the values come from the registry — and the
 * assessment never resolved that binding, so it rendered a dropdown containing
 * nothing but "Choose one". County is question two of both funnels and it is
 * required, so no visitor could finish an assessment on either side.
 *
 * Nothing threw. The page rendered. The control was just empty, and the only
 * way to find it was to try to answer it.
 */
describe("every funnel can actually be completed", () => {
  for (const funnel of [BUY_FUNNEL, SELL_FUNNEL]) {
    describe(funnel.side, () => {
      it("offers options for every required question that needs them", () => {
        const unanswerable = funnel.questions
          .filter(needsOptions)
          .filter((q) => optionsFor(q).length === 0)
          .map((q) => q.id);

        expect(unanswerable).toEqual([]);
      });

      it("resolves the county question from the registry", () => {
        const county = funnel.questions.find((q) => q.bound === "county");
        expect(county).toBeDefined();
        /* Not a fixed number — the registry grows. What matters is that the
           binding resolves to a real list rather than nothing. */
        expect(optionsFor(county!).length).toBeGreaterThan(1);
      });

      it("asks for every input its compute engine needs", () => {
        const bounds = new Set(funnel.questions.filter((q) => q.enabled).map((q) => q.bound));
        const required = funnel.side === "buy"
          ? ["county", "price", "savings", "monthlySaving", "timing"]
          : ["county", "price", "payoff", "yearsOwned", "timing"];

        for (const b of required) expect(bounds).toContain(b);
      });
    });
  }
});
