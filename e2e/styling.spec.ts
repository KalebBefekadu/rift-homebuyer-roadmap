import { test, expect } from "@playwright/test";

/**
 * A class that is applied and does nothing.
 *
 * Twice now, a rule in rift.css has out-specified the visual classes in the
 * same file and stripped them off any `<button>` that carried them. First
 * `.btn`: `<button class="btn btn-p">` rendered as bare text with no fill,
 * while the identical `<a class="btn btn-p">` looked right. Then `.chip`: a
 * filter pill on Studio's People screen rendered as plain text with the
 * correct markup, the correct class and the correct aria-pressed.
 *
 * Neither threw. Neither failed a test. Both rendered a 200 and looked, to
 * anything that reads the DOM, completely correct — the classes were all
 * there. The only way to see it is to ask the browser what it actually
 * computed.
 */

/** Pages that carry the product's buttons and chips. */
const PAGES = [
  "/", "/buy", "/sell", "/abroad", "/book", "/privacy",
  "/buy/start", "/sell/start",
  "/buy/results?t=In+the+next+3+months&c=Fulton&o=none&p=350000&s=12000&r=600",
  "/sell/results?c=Fulton&p=400000&o=200000&y=6&t=3+to+9+months",
];

test.describe("every visual class actually paints", () => {
  for (const path of PAGES) {
    test(`${path} has no button or chip stripped of its styling`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const naked = await page.evaluate(() => {
        const bad: string[] = [];
        const transparent = (c: string) => c === "transparent" || /rgba\(0,\s*0,\s*0,\s*0\)/.test(c);

        for (const el of document.querySelectorAll<HTMLElement>(".chip, .btn")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;

          const cs = getComputedStyle(el);

          /* A chip or a button is a SHAPE. If it has no fill, no border and no
             rounding, none of its classes reached it — which is exactly what
             both incidents looked like. `.btn-g` and `.chip-out` are
             deliberately transparent, and they still carry their radius and
             their padding, so this catches the stripped case without flagging
             the quiet ones. */
          const hasFill = !transparent(cs.backgroundColor);
          const hasBorder = cs.borderTopWidth !== "0px" && !transparent(cs.borderTopColor);
          const hasRadius = parseFloat(cs.borderTopLeftRadius) > 0;
          const hasPadding = parseFloat(cs.paddingLeft) > 0;

          if (!hasFill && !hasBorder && !hasRadius && !hasPadding) {
            bad.push(`<${el.tagName.toLowerCase()} class="${el.className}"> "${(el.textContent ?? "").trim().slice(0, 30)}"`);
          }
        }
        return [...new Set(bad)].slice(0, 6);
      });

      expect(naked, `${path}: these carry a visual class that never reached them`).toEqual([]);
    });
  }
});

test("a chip renders the same whether it is a span or a button", async ({ page }) => {
  /* The property underneath both incidents, stated directly. A reset that
     distinguishes them is a reset that will strip one of them, and which one
     is decided by whichever the author happened to reach for. */
  await page.goto("/buy");

  const pair = await page.evaluate(() => {
    const host = document.querySelector(".rift") ?? document.body;
    const read = (tag: string) => {
      const e = document.createElement(tag);
      e.className = "chip chip-ink";
      e.textContent = "x";
      host.appendChild(e);
      const cs = getComputedStyle(e);
      const v = {
        background: cs.backgroundColor, color: cs.color,
        fontSize: cs.fontSize, padding: cs.paddingLeft, radius: cs.borderTopLeftRadius,
      };
      e.remove();
      return v;
    };
    return { span: read("span"), button: read("button") };
  });

  expect(pair.button, "a <button class='chip'> is styled differently from a <span class='chip'>")
    .toEqual(pair.span);
});

test("a button and a link with the same classes look the same", async ({ page }) => {
  /* The first incident, in one line. */
  await page.goto("/buy");

  const pair = await page.evaluate(() => {
    const host = document.querySelector(".rift") ?? document.body;
    const read = (tag: string) => {
      const e = document.createElement(tag);
      e.className = "btn btn-p";
      e.textContent = "x";
      host.appendChild(e);
      const cs = getComputedStyle(e);
      const v = { background: cs.backgroundColor, color: cs.color, height: cs.height, padding: cs.paddingLeft };
      e.remove();
      return v;
    };
    return { a: read("a"), button: read("button") };
  });

  expect(pair.button, "a <button class='btn btn-p'> is styled differently from an <a class='btn btn-p'>")
    .toEqual(pair.a);
});
