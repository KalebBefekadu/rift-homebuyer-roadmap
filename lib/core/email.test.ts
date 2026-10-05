import { describe, it, expect } from "vitest";
import { buildReadout, buildTouch, buildPlanTouch, buildResume, buildSavedPlan, buildSignIn, buildInvitation, escapeHtml } from "./email";

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

/**
 * The follow-up for somebody who saved a plan (Blueprint v5 §5.5). Since D31
 * that is every new lead, and until this existed each of them was sent the
 * "pick up where you left off" email about a plan they had finished.
 */
describe("the saved plan's follow-up", () => {
  const base = {
    to: "a@b.com", says: "Your saved plan", body: "Your plan is saved exactly as you saw it.",
    planUrl: "https://x/saved/tok", againUrl: "https://x/buy/cash-to-close", savedOn: "2026-09-28", side: "buy" as const,
  };

  it("links the plan and a way to work it out again, and says the plan does not change", () => {
    const built = buildPlanTouch(base);
    expect(built.subject).toBe("Your saved plan");
    expect(built.html).toContain('href="https://x/saved/tok"');
    expect(built.html).toContain('href="https://x/buy/cash-to-close"');
    expect(built.html).toMatch(/as they were on September 28, 2026, and they stay that way/);
    expect(built.html).toMatch(/today's rates/);
    expect(built.html).not.toMatch(/up to date/i);
  });

  it("quotes no figure at all: the plan's are the browser's text, not ours", () => {
    /* Nothing in its input can carry one, and nothing in its copy invents one. */
    const text = buildPlanTouch(base).html.replace(/<[^>]*>/g, "").replace(/September 28, 2026/, "");
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/\d/);
  });

  it("says no day rather than a wrong one", () => {
    expect(buildPlanTouch({ ...base, savedOn: null }).html).toMatch(/as they were, and they stay that way/);
    expect(buildPlanTouch({ ...base, savedOn: "yesterday<b>" }).html).not.toContain("yesterday");
  });

  it("escapes every link and the name", () => {
    const built = buildPlanTouch({
      ...base, name: "<script>x</script>",
      planUrl: 'https://x/saved/t"><script>alert(1)</script>', againUrl: "https://x/buy?a=1&b=2",
    });
    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain('href="https://x/buy?a=1&amp;b=2"');
  });

  it("warns that the link opens the plan, as the save email does", () => {
    expect(buildPlanTouch(base).html).toMatch(/Anyone with the link can open the\s+plan/);
  });

  it("lists the programs step's programs the same way the readout touch does", () => {
    const programs = [{ name: "Georgia Dream <b>", state: "Waiting list", needs: ["Homebuyer education course required."] }];
    const plan = buildPlanTouch({ ...base, programs }).html;
    const readout = buildTouch({
      to: "a@b.com", says: "s", body: "b", shareUrl: "https://x", againUrl: "https://x/again", county: "DeKalb",
      figures: { cashToClose: 1, gap: 0 }, programs,
    })!.html;
    const list = (h: string) => h.slice(h.indexOf("<ul"), h.indexOf("</ul>"));
    expect(list(plan)).toContain("<strong>Georgia Dream &lt;b&gt;</strong> (Waiting list)");
    expect(list(plan)).toBe(list(readout));
    expect(buildPlanTouch(base).html).not.toContain("<ul");
  });

  it("does not call a seller's estimate a lending commitment", () => {
    expect(buildPlanTouch(base).html).toMatch(/not a lending commitment/);
    const sell = buildPlanTouch({ ...base, side: "sell" }).html;
    expect(sell).toMatch(/not an appraisal or an offer/);
    expect(sell).not.toMatch(/lending/);
  });
});

describe("the other links a customer is sent are escaped too", () => {
  it("the resume link and the saved plan link", () => {
    const hostile = 'https://x/"><script>alert(1)</script>';
    expect(buildResume({ to: "a@b.com", says: "s", body: "b", resumeUrl: hostile, answered: 1, of: 7 }).html).not.toContain("<script>");
    expect(buildSavedPlan({ to: "a@b.com", planUrl: hostile, values: [], review: false }).html).not.toContain("<script>");
  });
});

describe("the sign-in link", () => {
  it("carries the link, escaped, and no unsubscribe", () => {
    /* No unsubscribe because an opt-out here would lock a buyer out of their
       own move; escaped because the next path inside it came from a URL. */
    const built = buildSignIn({ to: "a@b.com", link: 'https://x.test/auth/callback?token_hash=abc&next=/app"><script>' });
    expect(built.html).toContain("token_hash=abc");
    expect(built.html).not.toContain("<script>");
    expect(built.html).not.toContain("unsubscribe");
  });

  it("says what a reset link is for", () => {
    const built = buildSignIn({ to: "a@b.com", link: "https://x.test/auth/callback", purpose: "reset" });
    expect(built.subject).toMatch(/password/i);
    expect(built.html).toContain("new password");
  });
});

describe("the invitation email", () => {
  it("names the agent and the move, carries the link escaped, and has no unsubscribe", () => {
    const b = buildInvitation({ to: "a@b.com", name: "Abel Tesfaye", agentName: "Kaleb Befekadu", journeyLabel: "Abel's search", link: 'https://x.test/app/invite/abc"><script>' });
    expect(b.subject).toContain("Kaleb Befekadu");
    expect(b.text).toContain("Hello Abel,");
    expect(b.html).not.toContain("<script>");
    expect(b.html).not.toContain("unsubscribe");
  });
});
