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
  /* Closed for good. A 404 is the assertion — /prototype is a design
     specification that once left five dead links on the live seller readout,
     and /dev was a debugging surface. */
  for (const path of ["/prototype", "/prototype/app", "/prototype/studio", "/dev"]) {
    test(`${path} is gone`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} is still being served`).toBe(404);
    });
  }

  /* Private, which is a different thing. Next serves an unauthenticated page
     with a 200 either way, so the status code proves nothing — what matters is
     that no client data is on it and the visitor is told where to sign in. */
  for (const path of ["/studio", "/studio/clients", "/studio/calendar", "/studio/settings", "/studio/questions", "/studio/add", "/studio/lead/some-id"]) {
    test(`${path} shows a stranger nothing`, async ({ page }) => {
      await page.goto(path);

      /* Polled. These pages hold their content behind a Suspense boundary, so
         a single read lands on the loading shell often enough to fail on a
         page that is perfectly correct — which is this suite's own version of
         the bug it exists to catch. */
      await expect
        .poll(async () => (await page.locator("body").innerText()).toLowerCase(),
              { message: `${path} offered no way in`, timeout: 10_000 })
        .toMatch(/sign in|sign-in/);

      const text = await page.locator("body").innerText();

      /* The shapes real client data takes on these screens. None may appear
         to somebody with no session. */
      for (const leak of [/@[a-z0-9-]+\.[a-z]{2,}/i, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, /\$[\d,]{4,}/]) {
        expect(text, `${path} leaked something shaped like client data`).not.toMatch(leak);
      }
      /* And the controls that act on it. */
      expect(text, `${path} showed a signed-out visitor the controls`).not.toMatch(/Sign out|Add someone/i);
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

test.describe("the client's own plan", () => {
  /* Runs with no database, so this asserts the honest-degradation half: the
     page must not tell somebody their link was revoked when in fact nothing
     was ever asked. Those are different sentences about their agent, and the
     reader cannot tell them apart. */
  const TOKEN = "a".repeat(32);

  test("does not claim a link expired when the database is simply absent", async ({ page }) => {
    const res = await page.goto(`/plan/${TOKEN}`);
    expect(res?.status()).toBe(200);

    const text = await page.locator("body").innerText();
    expect(text).toMatch(/cannot open this right now/i);

    /* The wrong CLAIM, not the word. The page says "this does not mean your
       link has expired", which is the right sentence and contains the word —
       so the first version of this assertion failed on the very copy it was
       written to protect. */
    expect(text, "told the client their link was revoked when it was not")
      .not.toMatch(/this link is no longer open/i);
    expect(text, "did not reassure the client that the link still works")
      .toMatch(/does not mean your link has expired/i);
  });

  test("is never indexed", async ({ page }) => {
    /* A link unguessable to a person is trivially findable by a crawler that
       has been given it. */
    await page.goto(`/plan/${TOKEN}`);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "", "the client's plan is indexable").toMatch(/noindex/);
  });

  test("shows a stranger nothing that looks like client data", async ({ page }) => {
    await page.goto(`/plan/${TOKEN}`);
    const text = await page.locator("body").innerText();
    for (const leak of [/@[a-z0-9-]+\.[a-z]{2,}/i, /\$[\d,]{4,}/, /score/i, /\bband\b/i]) {
      expect(text, "the plan page leaked something shaped like the agent's record")
        .not.toMatch(leak);
    }
  });
});
