import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BUY_FUNNEL, SELL_FUNNEL } from "./funnel";
import { scoreLead } from "./lead";

/**
 * One list of timing answers, written out in two places.
 *
 * The funnels offer them and `scoreLead` ranks on them by prefix. Each carries
 * its own copy of the same four strings, and nothing joined the copies
 * together. (A third copy lived in `params.ts`, the retired readout's URL
 * parser, deleted on 12 October 2026 with nothing left calling it.)
 *
 * The drift is silent and expensive in a specific way. Change "In the next 3
 * months" in the funnel and `scoreLead` sees a string that matches none of
 * its prefixes and awards 2 points instead of 32 on the strongest signal it
 * has, so every
 * urgent buyer lands in `later` and the agent's ranked list is sorted by
 * something that is not urgency.
 *
 * Nothing throws at any step. Every page renders. The only symptom is that
 * the person who wanted to move in six weeks is fourth on a list.
 */

const timingOptions = (f: typeof BUY_FUNNEL) =>
  f.questions.find((q) => q.id === "timing")!.options!.map((o) => o.value);

describe("the four answers are the same four everywhere", () => {
  const declared = timingOptions(BUY_FUNNEL);

  it("reads the buyer funnel's four", () => {
    expect(declared.length).toBe(4);
  });

  it("matches the seller funnel's own options", () => {
    /* The seller question reads differently: "When would you like to have
       sold?": but the VALUES have to be the same, because one parser and
       one scorer serve both. */
    expect(declared).toEqual(timingOptions(SELL_FUNNEL));
  });

  it("is what the scorer actually branches on", () => {
    const src = readFileSync("lib/core/lead.ts", "utf8");
    const branch = src.slice(src.indexOf("const timingPts"), src.indexOf("label: \"Stated timing\""));
    /* Prefixes, because that is how the scorer matches. If a funnel option
       ever stops starting with one of these, it falls to the 2-point floor. */
    for (const prefix of ["In the next", "3 to", "9 to"]) {
      expect(branch, `the scorer no longer looks for "${prefix}"`).toContain(prefix);
    }
    for (const value of declared.slice(0, 3)) {
      expect(
        ["In the next", "3 to", "9 to"].some((p) => value.startsWith(p)),
        `"${value}" matches no branch in the scorer and would score 2`,
      ).toBe(true);
    }
  });
});

describe("an urgent answer survives the whole chain", () => {
  const urgent = timingOptions(BUY_FUNNEL)[0]!;

  it("reaches the top band once it gets to the scorer", () => {
    const s = scoreLead({
      side: "buy", timing: urgent, completion: 1, hoursSince: 0,
      value: 325_000, monthsToReady: 0, coBuyer: false, contactable: true, source: "readout",
    });
    expect(s.band).toBe("now");
  });

  it("does not reach the top band on a string the funnel never offers", () => {
    /* The control. "0-3 months" reads like a timing answer and is not one;
       it scores the floor, which is correct and is also exactly what a
       drifted funnel would produce for everybody. */
    const s = scoreLead({
      side: "buy", timing: "0-3 months", completion: 1, hoursSince: 0,
      value: 325_000, monthsToReady: 0, coBuyer: false, contactable: true, source: "readout",
    });
    expect(s.band).not.toBe("now");
  });
});
