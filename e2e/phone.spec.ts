import { test, expect, devices } from "@playwright/test";

/**
 * What only goes wrong on a phone.
 *
 * Two disclosure notices on the buyer readout shattered into three
 * side-by-side columns, because `.row` is `display:flex` and an inline link
 * makes the sentence three flex children. It fitted one line on a desktop, so
 * every check passed and every screenshot looked right.
 *
 * Most of this audience is on a phone. Someone opening /abroad from another
 * continent certainly is.
 */
test.use({ ...devices["Pixel 7"] });

const PAGES = [
  "/", "/buy", "/sell", "/abroad", "/privacy", "/book", "/buy/programs",
  "/buy/cash-to-close?p=350000&d=3.5&c=Fulton",
  "/sell/proceeds?c=Fulton&sp=400000&po=200000&cm=5",
];

test.describe("nothing spills off the side of a phone", () => {
  for (const path of PAGES) {
    test(`${path} fits its viewport`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      /* The page itself must not scroll sideways. This is the assertion that
         matters: a reader on a phone discovering that the article moves under
         their thumb, and it is one number rather than a walk of the tree. */
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(doc.scroll, `${path} scrolls sideways`).toBeLessThanOrEqual(doc.client + 1);

      const overflow = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        const out: string[] = [];

        /* Anything inside a deliberate horizontal scroller is exempt. The
           seller readout puts a four-column repair table in one on purpose,
           and reporting it would train whoever reads this to ignore the
           check, which costs more than the check is worth. */
        const inScroller = (el: HTMLElement) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll") return true;
          }
          return false;
        };

        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          /* Two pixels of slack for sub-pixel rounding and decorative rules
             that are deliberately full-bleed. */
          if (r.right > limit + 2 || r.left < -2) {
            if (inScroller(el)) continue;
            out.push(`${el.tagName.toLowerCase()}.${el.className || "-"}: ${Math.round(r.left)}→${Math.round(r.right)} of ${limit}`);
          }
        }
        return out.slice(0, 6);
      });

      expect(overflow, `${path} has content off the side of the screen`).toEqual([]);
    });
  }
});

test.describe("a sentence stays a sentence", () => {
  /* The property, not the two lines that were wrong. A row of flex children
     whose text is all short fragments is a shattered paragraph, whatever
     produced it. */
  for (const path of ["/buy/cash-to-close?p=350000&d=3.5&c=Fulton", "/sell/proceeds?c=Fulton&sp=400000&po=200000&cm=5", "/abroad"]) {
    test(`${path} has no prose broken into columns`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const shattered = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const style = getComputedStyle(el);
          if (style.display !== "flex" || style.flexDirection.startsWith("column")) continue;
          if (style.flexWrap === "wrap") continue;

          /* What is on screen: a child hidden at this width, or the inside
             of a closed menu, is not part of any line a reader sees. With
             textContent the header's hidden links and its closed phone menu
             read as one long run-on row. */
          const kids = ([...el.children] as HTMLElement[]).filter((k) => k.getBoundingClientRect().width > 0);
          if (kids.length < 3) continue;

          /* A sentence cut into pieces: several siblings on one line, each
             holding a fragment that ends mid-thought. A row of buttons or
             stats is not this: its children are short BECAUSE they are
             labels, and they do not run on into each other. */
          const texts = kids.map((k) => (k.innerText ?? "").trim());
          const wordy = texts.filter((t) => t.split(/\s+/).length >= 3).length;
          const endsOpen = texts.filter((t) => t && !/[.!?:]$/.test(t) && /\s/.test(t)).length;
          if (wordy >= 2 && endsOpen >= 2 && texts.join(" ").length > 80) {
            bad.push(texts.join(" | ").slice(0, 160));
          }
        }
        return bad;
      });

      expect(shattered, `prose split across flex children on ${path}`).toEqual([]);
    });
  }
});

test("a value can be answered with a thumb", async ({ page }) => {
  await page.goto("/buy/cash-to-close");

  /* Every control a value needs has to be reachable and big enough to hit.
     24 CSS pixels is well under any guideline and still catches a control
     that has collapsed. */
  const amount = page.locator('input[inputmode="numeric"]');
  const box = await amount.boundingBox();
  expect(box, "the amount box is not on the page").not.toBeNull();
  expect(box!.height, "the amount box is too small to use").toBeGreaterThan(24);
  await amount.fill("350000");
  await page.getByRole("button", { name: /Continue/ }).click();

  for (const name of [/^3\.5%/, /^Fulton$/]) {
    const option = page.getByRole("radio", { name });
    const b = await option.boundingBox();
    expect(b, `${name} is not on the page`).not.toBeNull();
    expect(b!.height, `${name} is too small to hit`).toBeGreaterThan(24);
    await option.click();
  }

  await page.waitForURL(/\/buy\/cash-to-close\?.*p=350000/, { timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/\$[\d,]{4,}/);
});

test.describe("a phone can get from one value to another", () => {
  /* The header hides its links below 720px. For a while nothing replaced
     them, so on a phone the only way from one side's value to another was
     the footer. Each side's menu has to reach the other two. */
  /* By where the links go, not their words: the abroad landing's menu is in
     whichever language the reader chose. Someone buying from abroad is not
     selling here, so that menu reaches buying and how it works. */
  for (const [path, others] of [
    ["/", ["/buy", "/sell", "/abroad"]],
    ["/buy", ["/sell", "/abroad"]],
    ["/sell", ["/buy", "/abroad"]],
    ["/abroad", ["/buy", "/abroad/how"]],
  ] as const) {
    test(`${path} has a menu that reaches the other sides`, async ({ page }) => {
      await page.goto(path);
      const menu = page.locator(".site-menu summary");
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box!.height, "the menu button is too small to hit").toBeGreaterThanOrEqual(40);
      await menu.click();
      const panel = page.locator(".site-menu-panel");
      for (const href of others) await expect(panel.locator(`a[href="${href}"]`)).toBeVisible();
    });
  }
});

test.describe("on the narrowest phone still in use", () => {
  /* 320 CSS pixels. Not a device anyone tests on, and the width at which an
     unbreakable element gives itself away: the chip that took the seller
     readout sideways was 390px wide and invisible at 412. */
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of PAGES) {
    test(`${path} still does not scroll sideways at 320px`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll, `${path} scrolls sideways at 320px`).toBeLessThanOrEqual(client + 1);
    });
  }
});
