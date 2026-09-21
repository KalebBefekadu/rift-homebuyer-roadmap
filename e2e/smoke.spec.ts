import { test, expect } from "@playwright/test";

/**
 * The things that were broken while every check said they were fine.
 *
 * Each test here pins a defect this product actually shipped. None of them
 * threw, none failed a unit test, and all of them returned 200.
 */

/* Every public route. Kept as a list rather than crawled, because the failure
   being guarded is a route disappearing, and a crawler would simply not visit
   one that no longer exists. */
const PUBLIC = [
  "/", "/buy", "/buy/how", "/buy/start", "/buy/programs",
  "/sell", "/sell/how", "/sell/start", "/sell/unclaimed",
  "/abroad", "/book", "/privacy",
];

test.describe("every public page renders with no database", () => {
  for (const path of PUBLIC) {
    test(`${path} serves a page, not an error`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);

      /* 200 is not the assertion. Next serves its error boundary with a 200,
         so a page that has fallen over looks identical to one that has not
         until you read it.

         Polled rather than read once. The funnel pages hold their content
         behind a Suspense boundary until hydration, so a single read can land
         on the fallback and report a working page as an empty one — which is
         this suite's own version of the bug it exists to catch. */
      await expect
        .poll(async () => (await page.locator("body").innerText()).length,
              { message: `${path} rendered almost nothing`, timeout: 10_000 })
        .toBeGreaterThan(120);

      const text = await page.locator("body").innerText();
      expect(text, path).not.toMatch(/Application error|Internal Server Error|Unhandled Runtime/i);

      /* The one heading rule. A page with no h1 is a page a screen reader
         cannot enter and a search engine cannot place. */
      await expect(page.locator("h1, h2").first(), path).toBeVisible();
    });
  }
});

test.describe("no page links somewhere that is not there", () => {
  /* Five dead /prototype links sat on the live seller readout because the
     shell is shared with the prototype. Full green suite throughout: a <Link>
     to a 404 is not an error until somebody clicks it. */
  for (const path of ["/", "/buy", "/sell", "/sell/results?c=Fulton&p=400000&o=200000&y=6&t=3+to+9+months", "/abroad", "/privacy"]) {
    test(`${path} has no internal link to a missing page`, async ({ page, request }) => {
      await page.goto(path);

      const hrefs = await page.locator('a[href^="/"]').evaluateAll(
        (as) => [...new Set(as.map((a) => a.getAttribute("href")!).filter(Boolean))],
      );
      expect(hrefs.length, `${path} has no internal links at all, which is itself suspicious`).toBeGreaterThan(0);

      const dead: string[] = [];
      for (const href of hrefs) {
        if (href.startsWith("//")) continue;
        const res = await request.get(href, { maxRedirects: 3 });
        if (res.status() >= 400) dead.push(`${href} → ${res.status()}`);
      }
      expect(dead, `dead links on ${path}`).toEqual([]);
    });
  }
});

test.describe("what must not be reachable", () => {
  for (const path of ["/prototype", "/prototype/app", "/dev", "/studio/today"]) {
    test(`${path} is not open to the public`, async ({ page }) => {
      const res = await page.goto(path);
      const status = res?.status() ?? 0;
      /* 404 for what was closed, a redirect to sign-in for what is private.
         What must never happen is a 200 with the page on it. */
      expect([404, 401, 403, 307, 308], `${path} answered ${status}`).toContain(status === 200 ? page.url().includes("sign-in") ? 307 : 200 : status);
    });
  }
});

test.describe("the scheduled jobs are not open to a stranger", () => {
  /* Both crons spent the life of the deployment returning 405 to the
     scheduler, because they exported POST and Vercel sends GET. Health
     reported "scheduler: configured" throughout, which was true and useless.
     So: assert the verb the caller actually uses. */
  for (const path of ["/api/nurture/run", "/api/retention/sweep", "/api/rates/refresh"]) {
    test(`GET ${path} refuses without the secret — and does not 405`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), `${path} answered ${res.status()} to a GET`).not.toBe(405);
      expect([401, 503], `${path} let a stranger in`).toContain(res.status());
    });
  }
});

test("the sitemap lists pages rather than serving valid, empty XML", async ({ request }) => {
  /* It served well-formed XML with zero URLs and a 200 for weeks, because the
     site URL was unset on Vercel and the code returned []. */
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect((xml.match(/<loc>/g) ?? []).length, "the sitemap is empty").toBeGreaterThan(3);
});

test("health answers honestly with nothing configured", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = await res.json();
  /* The point is not that it says ok. It is that a check reports an OUTCOME
     rather than whether a variable is set. */
  expect(body).toHaveProperty("ok");
  expect(JSON.stringify(body)).not.toMatch(/SUPABASE_SERVICE_ROLE|eyJ[A-Za-z0-9_-]{20}/);
});
