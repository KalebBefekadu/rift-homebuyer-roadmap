import { test, expect } from "@playwright/test";
import { signIn } from "./session";

/**
 * Every Operations page opens, signed in, with the demo book, and says
 * nothing failed to load.
 *
 * "Could not be read" is the defect this suite exists for: a page whose read
 * ran out of time looks finished, returns 200, and tells the agent his book
 * is empty or unknown. Every page says so in the same few words ("did not
 * load", "could not be read", or the raw "did not complete in time"), so
 * their absence is the assertion. A red notice about something else, a job
 * that failed for instance, is the page doing its job.
 */
const READ_FAILED = /did not load|could not be read|could not fetch|did not complete in time/i;
/* The weekly program check reports official pages it could not fetch: that is
   news about somebody else's website, said in the same words. */
const OUTSIDE = /\bpages? could not be read|official page|Could not be read on /i;
const BUY_JOURNEY = "de30000c-0000-4000-8000-000000000002";
const SELL_JOURNEY = "de30000c-0000-4000-8000-000000000005";
const LEAD = "de300001-0000-4000-8000-000000000001";

const PAGES = [
  "/operations", "/operations/clients", "/operations/search", "/operations/transactions", "/operations/offers",
  "/operations/calendar", "/operations/outbox", "/operations/referrals", "/operations/reports",
  "/operations/campaigns", "/operations/programs", "/operations/questions", "/operations/settings",
  "/operations/add", `/operations/lead/${LEAD}`,
  `/operations/journey/${BUY_JOURNEY}`, `/operations/journey/${BUY_JOURNEY}?tab=homes`, `/operations/journey/${BUY_JOURNEY}?tab=offers`,
  `/operations/journey/${SELL_JOURNEY}?tab=seller-offers`, `/operations/journey/${SELL_JOURNEY}?tab=prep`,
];

test.beforeEach(async ({ context }) => { await signIn(context, 3188); });

for (const path of PAGES) {
  test(`${path} opens signed in, with nothing that failed to load`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status(), `${path} answered ${res?.status()}`).toBeLessThan(400);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page, `${path} sent the agent to sign in`).not.toHaveURL(/sign-in/);

    const text = await page.locator("main").innerText();
    expect(text.split("\n").filter((l) => READ_FAILED.test(l) && !OUTSIDE.test(l)), `${path} says a read failed`).toEqual([]);

    /* Nothing off the side of the screen, on either project. */
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
    }));
    expect(scroll, `${path} scrolls sideways`).toBeLessThanOrEqual(client + 1);
  });
}

test("a stranger with no session is sent to sign in, not shown the book", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/operations/clients");
  await expect(page).toHaveURL(/sign-in/);
});

test("the whole Relationships row opens the person beside the list", async ({ page }) => {
  await page.goto("/operations/clients");
  /* A real click where the cell is. The name's link is stretched over its row,
     so that point is the link; Playwright's element click would refuse it as
     "intercepted", which is the design working. */
  const cell = page.locator('tbody tr td[data-label="Arrived"]').first();
  await cell.waitFor();
  /* The search bar above the table streams in after the first paint and
     moves the rows down; a position measured before that is clicked into
     nothing. */
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Find someone")).toBeVisible();
  const box = await cell.boundingBox();
  expect(box, "no rows to click").not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page).toHaveURL(/[?&]open=/);
});
