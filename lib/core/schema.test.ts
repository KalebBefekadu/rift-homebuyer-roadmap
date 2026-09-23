import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Structured data has to describe the page it is on.
 *
 * It is the one thing this product publishes that nobody ever looks at. A
 * claim in a JSON-LD block is read by machines, ranked on, and never seen by
 * the agent or by a visitor, so if it drifts from the page, nothing in the
 * product surfaces it and the drift is permanent.
 *
 * Which makes it the natural home for exactly the bug this codebase keeps
 * producing: a plausible statement that nobody can check.
 */

const AGENT = readFileSync("components/rift/Agent.tsx", "utf8");

/* Comments stripped. Agent.tsx's docblock explains at length that the licence
   number and telephone are deliberately absent, so a guard that greps the raw
   file fails on the sentence saying the thing is not there. */
const AGENT_CODE = AGENT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const ABROAD = readFileSync("app/(rift)/abroad/Landing.tsx", "utf8");

describe("the agent block", () => {
  it("asserts nothing that is not recorded", () => {
    /* The licence number and telephone are null on rift_agents. A structured
       data block is exactly the wrong place to guess one: it is a claim made
       to an index, in a file nobody reads, that no screen would contradict.

       Two properties, stated separately rather than in one clever expression.
       The first draft of this test combined them into a conditional regex
       that asserted almost nothing and passed. */
    expect(AGENT_CODE, "a telephone appears in the agent schema, but it is null on rift_agents")
      .not.toMatch(/\btelephone\b/);

    /* Anything that looks like a licence number, whether or not it is labelled
       as one. `hasCredential`, `identifier` and a bare string would all be the
       same mistake. */
    expect(AGENT_CODE, "something shaped like a licence number appears in the agent schema")
      .not.toMatch(/["'][A-Za-z]{0,4}\s?\d{5,}["']/);
  });

  it("serialises rather than interpolating", () => {
    /* A stray quote in a county name would break the block silently, and
       invalid structured data is ignored rather than reported. */
    expect(AGENT_CODE).toMatch(/JSON\.stringify\(data\)/);
  });
});

describe("the FAQ block", () => {
  it("emits nothing rather than an empty FAQPage", () => {
    /* An empty one is invalid, which means silently ignored: the worst of
       both outcomes, since it also looks like the feature is working. */
    expect(AGENT_CODE).toMatch(/if \(usable\.length === 0\) return null;/);
  });

  it("declares the language, because the Amharic page is its own page", () => {
    /* Declaring English answers on it would describe a page that does not
       exist. The whole reason for having written it is that somebody
       searching in Amharic can find it. */
    expect(AGENT_CODE).toMatch(/inLanguage: locale/);
    expect(ABROAD).toMatch(/<FaqSchema locale=\{locale\}/);
  });

  it("is fed from the same array the page renders", () => {
    /* Google's rule is that structured data must match what the visitor sees,
       and a second copy written for crawlers drifts inside a release: after
       which the product makes two claims about the same thing, one invisible.

       Asserted structurally: the schema takes `faq`, and so does the map that
       draws the cards. */
    expect(ABROAD).toMatch(/items=\{faq\.map\(/);
    expect(ABROAD).toMatch(/\{faq\.map\(\(\[q, a\]\) => \(/);

    /* And there is exactly one place the questions are listed. */
    const listings = ABROAD.match(/t\("faq\.q1"\)/g) ?? [];
    expect(listings, "faq.q1 appears more than once; there are two copies of the questions")
      .toHaveLength(1);
  });
});
