import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sellerNet } from "./seller";
import { ASKS } from "./asks";

/**
 * Source guards for what a landing says when nobody is looking at it.
 *
 * These are not unit tests: they read the three landing components and assert
 * two properties that are invisible in review and invisible on screen.
 *
 * The first is that each landing has a live region. All three answer in place:
 * change a select or move a slider and the dark panel recomputes. There was no
 * `aria-live` anywhere in the codebase, so for anybody not watching the panel
 * nothing happened at all, and the front-door promise: a real number before
 * you give up anything: was being kept visually and only visually.
 *
 * The second is the seller's payoff. The sliders let a visitor put $700,000 of
 * payoff against a $150,000 price, and the panel described that as
 * "What you'd actually walk away with: -$566,000". The readout was rewritten
 * for this case; the landing, which is where a seller meets the product, was
 * not.
 */

/* The buyer and seller landings no longer answer in place: since Blueprint
   v5 they offer the values as separate pages, and each value page is a server
   render with nothing that changes under the reader. */
const LANDINGS = [
  "app/(rift)/abroad/Landing.tsx",
] as const;

describe("every landing that answers in place announces its answer", () => {
  for (const file of LANDINGS) {
    const src = readFileSync(file, "utf8");

    it(`${file} renders a live region`, () => {
      expect(src).toContain('from "@/components/rift/Live"');
      expect(src).toMatch(/<Announce>/);
    });
  }

  it("the live region is polite, atomic, and reachable only by a reader", () => {
    const src = readFileSync("components/rift/Live.tsx", "utf8");
    expect(src).toContain('aria-live="polite"');
    /* Without this a reader may announce only the nodes that changed, which
       for "$28,000 – $40,000" can be the digits on their own. */
    expect(src).toContain('aria-atomic="true"');
    expect(src).toContain('className="sr-only"');

    const css = readFileSync("app/prototype/rift.css", "utf8");
    expect(css).toContain(".sr-only");
    /* display:none and visibility:hidden both remove the element from the
       accessibility tree, which removes the announcement with it. */
    expect(css).toMatch(/\.sr-only\s*\{[^}]*clip-path/);
  });
});

describe("what you would keep handles a sale that does not cover the loan", () => {
  /* The seller landing's sliders were where this was first found. Since
     Blueprint v5 the figure is the proceeds value, whose limits come from
     lib/core/asks.ts: a payoff can be as large as any price. */
  const src = readFileSync("app/(rift)/sell/proceeds/page.tsx", "utf8");

  it("is a case the questions can actually reach", () => {
    const priceMin = ASKS.salePrice.limits!.min;
    const payoffMax = ASKS.payoff.limits!.max;
    expect(payoffMax).toBeGreaterThan(priceMin);
    const worst = sellerNet({ price: priceMin, payoff: payoffMax, county: "Cobb", commissionPct: null });
    expect(worst.net).toBeLessThan(0);
    expect(worst.shortfall).toBe(-worst.net);
  });

  it("branches on it rather than printing a negative under a positive label", () => {
    expect(src).toMatch(/const underwater = r\.net < 0;/);
    expect(src).toContain("brought to closing");
    expect(src).toMatch(/underwater \? money\(r\.shortfall\) : money\(r\.net\)/);
  });
});

/**
 * Every surface that prints a seller's net, and whether it checks the sign.
 *
 * The underwater case was fixed once, in the verdict and the status chip, and
 * the fix did not travel. Three more places went on describing a debt in the
 * vocabulary of a gain: the reframe card, the section heading above it, the
 * last row of the proceeds table, and the landing page, a click earlier. Each
 * was found by rendering the page and reading it, one at a time.
 *
 * So this asserts the property rather than the instances: no phrase that only
 * makes sense for money arriving may appear in these files unguarded.
 */
describe("no seller surface describes a shortfall as a gain", () => {
  const SURFACES = [
    "app/(rift)/sell/page.tsx",
    "app/(rift)/sell/proceeds/page.tsx",
  ] as const;

  /* Phrases that are only true when the number is positive. */
  const POSITIVE_ONLY = [
    "walk away with",
    "You keep",
    "actually reaches you",
    "Yours",
  ];

  /* Comments in these files quote the very phrases being searched for, in
     order to explain why they are guarded. Scan the code, not the prose. */
  const code = (file: string) =>
    readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^[ \t]*\/\/.*$/gm, " ");

  for (const file of SURFACES) {
    const src = code(file);

    it(`${file} knows whether the seller is underwater`, () => {
      expect(src).toMatch(/const underwater = (r|proceeds)\.net < 0;/);
    });

    for (const phrase of POSITIVE_ONLY) {
      const at = src.indexOf(phrase);
      if (at === -1) continue;
      it(`${file}: "${phrase}" is behind that check`, () => {
        /* The branch has to be near the phrase: a check 200 lines away is
           not guarding this string. */
        expect(src.slice(Math.max(0, at - 320), at + 60)).toContain("underwater");
      });
    }
  }
});
