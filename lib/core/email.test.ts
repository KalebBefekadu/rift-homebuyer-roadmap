import { describe, it, expect } from "vitest";
import { buildReadout, buildTouch, buildResume, escapeHtml } from "./email";

/**
 * The emails, against the real builders.
 *
 * This file used to re-implement `escapeHtml` and assert against its own copy,
 * because the builders lived inside a `server-only` module and could not be
 * imported. A test of the test. Moving them into the domain layer is what
 * makes the rest of this file possible, and the defect below is what made it
 * worth doing.
 */

describe("email escaping", () => {
  it("neutralises markup in a name from a public form", () => {
    expect(escapeHtml("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("escapes the name where it is actually interpolated", () => {
    /* The point the old test could not reach: not that the helper works, but
       that the builder calls it. */
    const built = buildReadout({
      to: "a@b.com", name: "<script>alert(1)</script>", shareUrl: "https://x/r/t",
      county: "DeKalb", side: "buy", cashToClose: 26_187, gap: 17_187, monthsToClose: 27,
    });
    expect(built!.html).not.toContain("<script>");
    expect(built!.html).toContain("&lt;script&gt;");
  });
});

describe("the seller's readout email", () => {
  /**
   * It did not exist. `buildReadout` had one body: "Buying in {county} County
   * takes {cashToClose} at the table": and the capture route fed it
   * `cashToClose` from a payload the seller page never sent, so
   * `Number(undefined) || 0` made it zero.
   *
   * A seller who typed their address into their own readout was queued:
   *
   *     Subject: Your numbers: $0 to close in DeKalb County
   *     Buying in DeKalb County takes $0 at the table…
   *
   * Nothing threw. No test could import the function. Email has never been
   * switched on in production, so this was armed rather than fired.
   */
  const seller = {
    to: "a@b.com", shareUrl: "https://x/r/t", county: "DeKalb", side: "sell" as const,
  };

  it("talks about selling, not buying", () => {
    const built = buildReadout({ ...seller, price: 415_000, net: 193_145 })!;
    expect(built.html).not.toMatch(/Buying in/);
    expect(built.html).toMatch(/Selling in DeKalb County/);
  });

  it("never sends a zero where the figure belongs", () => {
    const built = buildReadout({ ...seller, price: 415_000, net: 193_145 })!;
    expect(built.subject).not.toContain("$0");
    expect(built.html).not.toContain("$0 ");
    expect(built.subject).toContain("$193,145");
  });

  it("refuses to build at all when the figure is missing", () => {
    /* The guard buildTouch already had. There is no version of this message
       worth sending without the number it is about. */
    expect(buildReadout({ ...seller, price: 415_000 })).toBeNull();
    expect(buildReadout({ ...seller, net: 193_145 })).toBeNull();
    expect(buildReadout({ ...seller })).toBeNull();
  });

  it("tells an underwater seller what they must bring, not what they keep", () => {
    const built = buildReadout({ ...seller, price: 300_000, net: -73_575 })!;
    expect(built.subject).toMatch(/short of your payoff/);
    expect(built.subject).not.toContain("-$");
    expect(built.html).toMatch(/bring about/);
    expect(built.html).toMatch(/\$73,575/);
    /* An email saying somebody "keeps -$73,575" is the page's old defect
       arriving somewhere it cannot be corrected. */
    expect(built.html).not.toMatch(/leaves you about/);
  });
});

describe("the buyer's readout email", () => {
  const buyer = {
    to: "a@b.com", shareUrl: "https://x/r/t", county: "DeKalb", side: "buy" as const,
  };

  it("is unchanged", () => {
    const built = buildReadout({ ...buyer, cashToClose: 26_187, gap: 17_187, monthsToClose: 27 })!;
    expect(built.subject).toBe("Your numbers: $26,187 to close in DeKalb County");
    expect(built.html).toMatch(/Buying in DeKalb County takes/);
    expect(built.html).toMatch(/about 27 months/);
  });

  it("says so when the savings already cover it", () => {
    const built = buildReadout({ ...buyer, cashToClose: 26_187, gap: 0, monthsToClose: 0 })!;
    expect(built.html).toMatch(/already cover/);
  });

  it("asks for the monthly figure when it cannot date the gap", () => {
    const built = buildReadout({ ...buyer, cashToClose: 26_187, gap: 17_187, monthsToClose: null })!;
    expect(built.html).toMatch(/what you set aside each month/);
  });

  it("refuses without its figure too", () => {
    expect(buildReadout({ ...buyer })).toBeNull();
  });
});

describe("the cadence's own emails still behave", () => {
  it("a touch with no figures is not built", () => {
    expect(buildTouch({
      to: "a@b.com", says: "s", body: "b", shareUrl: "https://x", againUrl: "https://x/again", county: "DeKalb", figures: null,
    })).toBeNull();
  });

  it("the programs touch names each programme and what it asks, escaped", () => {
    const built = buildTouch({
      to: "a@b.com", says: "s", body: "b", shareUrl: "https://x", againUrl: "https://x/again", county: "DeKalb",
      figures: { cashToClose: 26_000, gap: 0 },
      programs: [
        { name: "Georgia Dream <b>", state: null, needs: ["Homebuyer education course required.", "Primary residence"] },
        { name: "County Fund", state: "Waiting list", needs: [] },
      ],
    })!;
    expect(built.html).toContain("<strong>Georgia Dream &lt;b&gt;</strong>");
    expect(built.html).toContain("Homebuyer education course required; Primary residence.");
    expect(built.html).toContain("<strong>County Fund</strong> (Waiting list)");
  });

  it("never says a readout is kept up to date, because it is a snapshot", () => {
    const built = buildTouch({
      to: "a@b.com", says: "s", body: "b", shareUrl: "https://x", againUrl: "https://x/again", county: "DeKalb",
      figures: { cashToClose: 26_000, gap: 0 },
    })!;
    expect(built.html).not.toMatch(/up to date/i);
    expect(built.html).toMatch(/saved as it\s+was on the day you made it/);
    expect(built.html).toContain('href="https://x/again"');
  });

  it("escapes the links it puts in an attribute", () => {
    const hostile = 'https://x/r/t"><script>alert(1)</script>';
    const touch = buildTouch({
      to: "a@b.com", says: "s", body: "b", shareUrl: hostile, againUrl: "https://x/again?a=1&b=2", county: "DeKalb",
      figures: { cashToClose: 26_000, gap: 0 },
    })!;
    expect(touch.html).not.toContain("<script>");
    expect(touch.html).toContain('href="https://x/again?a=1&amp;b=2"');
    const readout = buildReadout({ to: "a@b.com", shareUrl: hostile, county: "DeKalb", side: "buy", cashToClose: 26_000 })!;
    expect(readout.html).not.toContain("<script>");
  });

  it("an ordinary touch lists no programmes", () => {
    const built = buildTouch({
      to: "a@b.com", says: "s", body: "b", shareUrl: "https://x", againUrl: "https://x/again", county: "DeKalb",
      figures: { cashToClose: 26_000, gap: 0 },
    })!;
    expect(built.html).not.toContain("<ul");
  });

  it("a resume email carries progress and can say it is the last", () => {
    const built = buildResume({
      to: "a@b.com", says: "s", body: "b", resumeUrl: "https://x", answered: 3, of: 7, last: true,
    });
    expect(built.html).toMatch(/3 of 7 questions/);
    expect(built.html).toMatch(/last email/);
  });
});
