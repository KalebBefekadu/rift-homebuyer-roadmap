import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SELLER_DEFAULTS, netProceeds } from "./compute";

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

/* The buyer landing no longer answers in place: since Blueprint v5 it offers
   the values as separate pages, and each value page is a server render with
   nothing that changes under the reader. */
const LANDINGS = [
  "app/(rift)/sell/Landing.tsx",
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

describe("the seller's front door handles a sale that does not cover the loan", () => {
  const src = readFileSync("app/(rift)/sell/Landing.tsx", "utf8");

  it("is a case the sliders can actually reach", () => {
    /* Read the bounds out of the component rather than assuming them. */
    const priceMin = Number(src.match(/\["price",[^\]]*?(\d[\d_]*), *\d[\d_]*, *\d/)?.[1]?.replace(/_/g, "") ?? NaN);
    const payoffMax = Number(src.match(/\["payoff",[^\]]*?\d[\d_]*, *(\d[\d_]*), *\d/)?.[1]?.replace(/_/g, "") ?? NaN);
    expect(priceMin).toBeGreaterThan(0);
    expect(payoffMax).toBeGreaterThan(priceMin);

    const worst = netProceeds({ ...SELLER_DEFAULTS, price: priceMin, payoff: payoffMax });
    expect(worst.net).toBeLessThan(0);
  });

  it("branches on it rather than printing a negative under a positive label", () => {
    expect(src).toMatch(/const underwater = r\.net < 0;/);
    expect(src).toContain("bring to the closing table");
    /* The panel must not reach `money(r.net)` unguarded: that is the string
       that rendered "-$566,000" beside "What you'd actually walk away with". */
    expect(src).toMatch(/underwater \? short : money\(r\.net\)/);
  });

  it("does not offer a percentage of the price when the percentage is negative", () => {
    const pctLine = src.slice(src.indexOf("% of the sale price") - 400, src.indexOf("% of the sale price"));
    expect(pctLine).toContain("underwater");
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
    "app/(rift)/sell/Landing.tsx",
    "app/(rift)/sell/results/Readout.tsx",
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
