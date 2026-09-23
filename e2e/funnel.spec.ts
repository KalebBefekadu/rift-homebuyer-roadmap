import { test, expect, type Page } from "@playwright/test";

/**
 * The buyer funnel, walked the way a stranger walks it.
 *
 * This is the path the whole product is built around: a landing page, seven
 * questions, and a readout with real money on it: no account anywhere. If it
 * breaks, nothing else matters.
 *
 * Runs against a production build with NO database configured, which is
 * deliberate. See playwright.config.ts: the degradation contract says every
 * public page renders without one, and that has only ever been asserted
 * against mocked modules.
 */

/** Answers a choice question by its visible option text. */
async function choose(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

/** Sets a slider by typing into it rather than dragging: dragging is flaky
 *  and tests the mouse, not the product. */
async function setSlider(page: Page, label: string, value: number) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.dispatchEvent("change");
}

async function next(page: Page) {
  await page.getByRole("button", { name: /Next|Show my numbers/ }).click();
}

test.describe("a stranger gets their numbers", () => {
  test("the landing page says what it will do before asking for anything", async ({ page }) => {
    await page.goto("/buy");
    await expect(page.locator("h1").first()).toBeVisible();

    /* The thesis, asserted. The front door must not ask for an account, and
       the funnel's entrance must be reachable from it. */
    await expect(page.locator("body")).not.toContainText(/create an account|sign up to see/i);
    await expect(page.locator('a[href^="/buy/start"]').first()).toBeVisible();
  });

  test("seven questions produce a readout with real money on it", async ({ page }) => {
    await page.goto("/buy/start");

    /* Question one renders on the server. If this is a spinner, the funnel's
       front door has gone dynamic again and every visitor is paying for it. */
    await expect(page.getByRole("heading", { name: /When would you like to be in a home/i })).toBeVisible();

    await choose(page, "In the next 3 months");

    await page.getByRole("combobox").selectOption({ label: "Fulton" });
    await next(page);

    await choose(page, "No, I haven't owned anything");

    await setSlider(page, "Target price", 350_000);
    await next(page);

    await setSlider(page, "Saved so far", 12_000);
    await next(page);

    await setSlider(page, "Each month", 600);
    await next(page);

    /* The last question is optional, which is the point of asking it last. */
    await page.getByLabel("Is anyone else part of this decision?").fill("Sara");
    await next(page);

    await page.waitForURL(/\/buy\/results\?/, { timeout: 20_000 });

    const body = page.locator("body");

    /* Not "a page loaded". The readout's job is to put a specific number in
       front of somebody, and a readout that renders with the money missing is
       this product's characteristic failure: it looks completely fine. */
    await expect(body).toContainText(/\$[\d,]{4,}/);

    /* The rate assumption must be printed. A monthly figure without the rate
       it was computed at is the exact kind of unlabelled precision the
       product exists not to do. */
    await expect(body).toContainText(/%/);

    /* With nothing configured the rate falls back, and says so rather than
       presenting 6.5% as an observation. */
    await expect(body).toContainText(/assumption/i);
  });

  test("the readout computes on the server, so the URL cannot be edited into a lie", async ({ page }) => {
    /* "My readout says I need $4,000" has to be false. Two identical requests
       differing only in a made-up parameter must agree on the arithmetic. */
    const base = "/buy/results?t=In+the+next+3+months&c=Fulton&o=none&p=350000&s=12000&r=600";

    await page.goto(base);
    const honest = await page.locator("body").innerText();

    /* Every figure the page prints, offered back to it as a parameter. If any
       of them were trusted rather than recomputed, one of these would land. */
    await page.goto(`${base}&cashToClose=1&gap=0&assistance=999999&cash=1&net=1&monthly=1`);
    const tampered = await page.locator("body").innerText();

    const money = (s: string) => (s.match(/\$[\d,]+/g) ?? []).join("|");
    expect(money(tampered)).toBe(money(honest));

    /* The guard that makes this test able to fail. The readout substitutes
       typical Georgia figures for anything it was not told and says so, so a
       test that gets the parameter NAMES wrong exercises the defaults path and
       passes, having compared two pages that both ignored it. That is how the
       first draft of this file passed. */
    expect(honest, "the readout did not receive the answers").not.toMatch(/did not tell us/i);
    expect(honest).toContain("$350,000");
  });

  test("an absurd price is bounded rather than rendered", async ({ page }) => {
    /* An arithmetically correct absurdity is worse than an error page, because
       an error page cannot be screenshotted as something this product said. */
    await page.goto("/buy/results?c=Fulton&o=none&p=999999999&s=-5000&r=1e9");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\$999,999,999|\$-|NaN|Infinity|undefined/);
  });
});

test.describe("the seller funnel", () => {
  test("reaches a readout and never promises money to somebody underwater", async ({ page }) => {
    /* The underwater seller is this codebase's most-repeated bug: the prose was
       fixed in the verdict and the chip, and four more surfaces went on saying
       "You keep" over a negative number. */
    await page.goto("/sell/results?c=Fulton&p=300000&o=380000&y=3&t=3+to+9+months");
    const text = await page.locator("body").innerText();

    expect(text.length).toBeGreaterThan(200);
    expect(text, "the readout did not receive the answers").not.toMatch(/did not tell us/i);
    expect(text).toContain("$300,000");
    for (const promise of [/\byou keep\b/i, /what actually reaches you/i, /what survives the payoff/i]) {
      if (promise.test(text)) {
        /* Allowed only where the page also says the position is negative. */
        expect(text, `"${promise}" beside an underwater position`).toMatch(/owe|short|underwater|bring|negative/i);
      }
    }
  });
});
