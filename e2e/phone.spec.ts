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
  "/", "/buy", "/sell", "/abroad", "/privacy", "/book",
  "/buy/results?t=In+the+next+3+months&c=Fulton&o=none&p=350000&s=12000&r=600",
  "/sell/proceeds?p=400000&po=200000&cm=5",
  "/buy/afford?i=90000&dt=400&d=3.5",
  "/buy/lender-questions?d=3.5&k=600&o=none",
  "/sell/prepare?p=450000&in=tired&kb=original&sy=unsure",
  "/sell/unclaimed?p=350000&yo=8&hs=unsure&a6=yes",
  "/abroad/can-i-buy?st=itin&u=rent",
  "/abroad/cost?st=itin&u=live&p=300000",
  "/buy/how", "/offer",
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
  for (const path of ["/buy/results?t=In+the+next+3+months&c=Fulton&o=none&p=350000&s=12000&r=600", "/sell/proceeds?p=400000&po=200000&cm=5", "/abroad"]) {
    test(`${path} has no prose broken into columns`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const shattered = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const style = getComputedStyle(el);
          if (style.display !== "flex" || style.flexDirection.startsWith("column")) continue;
          if (style.flexWrap === "wrap") continue;

          const kids = [...el.children] as HTMLElement[];
          if (kids.length < 3) continue;

          /* A sentence cut into pieces: several siblings on one line, each
             holding a fragment that ends mid-thought. A row of buttons or
             stats is not this: its children are short BECAUSE they are
             labels, and they do not run on into each other. */
          const texts = kids.map((k) => (k.textContent ?? "").trim());
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

test("the funnel can be completed with a thumb", async ({ page }) => {
  await page.goto("/buy/start");
  await page.getByRole("button", { name: "In the next 3 months", exact: true }).click();
  await page.getByRole("combobox").selectOption({ label: "Fulton" });
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "No, I haven't owned anything", exact: true }).click();

  /* Every control the funnel needs has to be reachable and big enough to hit.
     24 CSS pixels is well under any guideline and still catches a control
     that has collapsed. */
  /* Each slider has its own range, so one value cannot serve all three: a
     range input refuses anything outside its own min and max. */
  for (const [label, value] of [["Target price", "350000"], ["Saved so far", "12000"], ["Each month", "600"]] as const) {
    const slider = page.getByLabel(label, { exact: true });
    const box = await slider.boundingBox();
    expect(box, `${label} is not on the page`).not.toBeNull();
    expect(box!.height, `${label} is too small to use`).toBeGreaterThan(20);

    await slider.fill(value);
    await slider.dispatchEvent("change");
    await page.getByRole("button", { name: /Next/ }).click();
  }

  await page.getByRole("button", { name: /Show my numbers/ }).click();
  await page.waitForURL(/\/buy\/results\?/, { timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/\$[\d,]{4,}/);
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
