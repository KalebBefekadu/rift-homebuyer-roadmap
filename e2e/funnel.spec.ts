import { test, expect } from "@playwright/test";

/**
 * The lead side, walked the way a stranger walks it (Blueprint v5 §5.1).
 *
 * The seven-question funnel became separate values: each asks a few
 * questions and answers one question with real money, no account anywhere.
 * If a value breaks, nothing else matters. The old readout addresses still
 * forward, with the answers, to the value that replaced them.
 *
 * Runs against a production build with NO database configured, which is
 * deliberate. See playwright.config.ts: the degradation contract says every
 * public page renders without one, and that has only ever been asserted
 * against mocked modules.
 */

test.describe("a stranger gets their numbers", () => {
  test("the landing page says what it will do before asking for anything", async ({ page }) => {
    await page.goto("/buy");
    await expect(page.locator("h1").first()).toBeVisible();

    /* The thesis, asserted. The front door must not ask for an account, and
       a value must be reachable from it. */
    await expect(page.locator("body")).not.toContainText(/create an account|sign up to see/i);
    await expect(page.locator('a[href^="/buy/cash-to-close"]').first()).toBeVisible();
  });

  test("three answers produce cash to close with real money on it", async ({ page }) => {
    await page.goto("/buy/cash-to-close");

    /* The first question renders on the server. If this is a spinner, the
       value's front door has gone dynamic and every visitor pays for it. */
    await expect(page.getByRole("heading", { name: /What price are you thinking about/i })).toBeVisible();
    await page.locator('input[inputmode="numeric"]').fill("350000");
    await page.getByRole("button", { name: /Continue/ }).click();

    await expect(page.getByRole("heading", { name: /How much would you put down/i })).toBeVisible();
    await page.getByRole("radio", { name: /^3\.5%/ }).click();

    await expect(page.getByRole("heading", { name: /Which Georgia county/i })).toBeVisible();
    await page.getByRole("radio", { name: "Fulton", exact: true }).click();

    await page.waitForURL(/\/buy\/cash-to-close\?.*p=350000/, { timeout: 20_000 });
    const body = page.locator("body");

    /* Not "a page loaded". The answer's job is to put a specific number in
       front of somebody, and one that renders with the money missing is this
       product's characteristic failure: it looks completely fine. */
    await expect(body).toContainText(/\$[\d,]{4,}/);
    await expect(body).toContainText("$350,000");
  });

  test("an answer computes on the server, so the address cannot be edited into a lie", async ({ page }) => {
    /* "My answer says I need $4,000" has to be false. Two identical requests
       differing only in made-up parameters must agree on the arithmetic. */
    const base = "/buy/cash-to-close?p=350000&d=3.5&c=Fulton";
    await page.goto(base);
    const honest = await page.locator("main").innerText();

    await page.goto(`${base}&cashToClose=1&gap=0&assistance=999999&cash=1&net=1&monthly=1`);
    const tampered = await page.locator("main").innerText();

    const money = (s: string) => (s.match(/\$[\d,]+/g) ?? []).join("|");
    expect(money(tampered)).toBe(money(honest));

    /* The guard that makes this test able to fail: if the parameter names
       were wrong, both pages would ask the first question again and compare
       two question pages. */
    expect(honest).toContain("$350,000");
    await expect(page.getByRole("heading", { name: /What price are you thinking about/i })).toHaveCount(0);
  });

  test("the monthly cost prints the rate it assumed, and says it is an assumption", async ({ page }) => {
    await page.goto("/buy/monthly-cost?p=350000&d=3.5&c=Fulton");
    const body = page.locator("body");
    await expect(body).toContainText(/\$[\d,]{3,}/);
    /* A monthly figure without its rate is the unlabelled precision the
       product exists not to do. With nothing configured the rate falls back
       and says so rather than presenting a number as an observation. */
    await expect(body).toContainText(/%/);
    await expect(body).toContainText(/assum/i);
  });

  test("an absurd price is bounded rather than rendered", async ({ page }) => {
    /* An arithmetically correct absurdity is worse than an error page, because
       an error page cannot be screenshotted as something this product said. */
    await page.goto("/buy/cash-to-close?p=999999999&d=3.5&c=Fulton&s=-5000&ms=1e9");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\$999,999,999|\$-|NaN|Infinity|undefined/);
  });

  test("the retired readout address forwards, with the answers, to the value that replaced it", async ({ page }) => {
    await page.goto("/buy/results?c=Fulton&o=none&p=350000&s=12000");
    await page.waitForURL(/\/buy\/cash-to-close\?/, { timeout: 20_000 });
    expect(page.url()).toContain("p=350000");
    expect(page.url()).toContain("c=Fulton");
    /* The old readout never asked for a down payment, so the value asks that
       one question and none it was already told. */
    await expect(page.getByRole("heading", { name: /How much would you put down/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /What price are you thinking about/i })).toHaveCount(0);
  });
});

test.describe("the seller values", () => {
  test("what you'd keep never promises money to somebody underwater", async ({ page }) => {
    /* The underwater seller is this codebase's most-repeated bug: the prose was
       fixed in one place and four more surfaces went on saying "You keep" over
       a negative number. */
    await page.goto("/sell/proceeds?c=Fulton&sp=300000&po=380000&cm=5");
    const text = await page.locator("main").innerText();

    expect(text.length).toBeGreaterThan(200);
    expect(text).toContain("$300,000");
    for (const promise of [/\byou keep\b/i, /what actually reaches you/i, /what survives the payoff/i]) {
      if (promise.test(text)) {
        /* Allowed only where the page also says the position is negative. */
        expect(text, `"${promise}" beside an underwater position`).toMatch(/owe|short|underwater|bring|negative/i);
      }
    }
  });
});
