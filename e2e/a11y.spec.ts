import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * The accessibility gate.
 *
 * `docs/benchmark.md` scored D3.5 a 3 and wrote the reason in the margin:
 * "Stated target, no-colour-alone, focus-visible, aria-labelled controls. Not
 * tool-audited." The first time anybody ran a tool, the buyer readout returned
 * 35 serious contrast failures — on the page that exists so a stranger can
 * check the arithmetic behind their own numbers.
 *
 * Thirty-three of them were one token. `--ink-4` sat at 2.49:1 against
 * `--sunk` where AA asks for 4.5:1, and it was carrying the assumption lines,
 * the provenance line and the small print under every figure. A reader who
 * cannot read the assumptions is reading a number that asserts itself, which
 * is the one thing this product promises it will never do.
 *
 * This suite is the instrument, not the fix. It runs on both projects, so a
 * rule that only misbehaves at 390px is caught by the phone run — the same
 * reason the mobile project exists in playwright.config.ts.
 *
 * WHY THE WHOLE RULESET, MINUS NOTHING.
 *
 * There is no disabled-rules list and no allowance for "known" violations. An
 * exception list is a bug one deployment behind: `.rift button` had one, and
 * it caught `.btn` and then let `.chip` walk into the identical wall months
 * later. If a rule here is genuinely wrong for this product, the argument
 * belongs in the CSS with a comment, not in a suppression array nobody reads.
 */

/**
 * Every public surface a stranger can reach, plus the two token pages, with
 * parameters that produce real figures rather than the empty state.
 *
 * The readouts carry short keys — `c`, `p`, `s`, `r`, `t` — because that is
 * what the funnel writes. An earlier suite used long names, matched nothing,
 * and passed against the defaults path while asserting almost nothing.
 */
const PAGES: Array<[name: string, path: string]> = [
  ["home", "/"],
  ["buy landing", "/buy"],
  ["sell landing", "/sell"],
  ["abroad landing", "/abroad"],
  ["book", "/book"],
  ["privacy", "/privacy"],
  ["buy assessment", "/buy/start"],
  ["sell assessment", "/sell/start"],
  ["programs", "/buy/programs"],
  ["unclaimed value", "/sell/unclaimed"],
  ["buy how", "/buy/how"],
  ["sell how", "/sell/how"],
  [
    "buyer readout",
    "/buy/results?t=In+the+next+3+months&c=Fulton&o=none&p=350000&s=12000&r=600",
  ],
  [
    "seller readout",
    "/sell/results?c=Fulton&p=400000&o=200000&y=6&t=3+to+9+months",
  ],
  ["abroad readout", "/abroad/results?c=Fulton&p=300000&d=60000"],
  ["closed plan link", "/plan/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  ["closed readout link", "/r/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
];

test.describe("WCAG 2.2 AA", () => {
  for (const [name, path] of PAGES) {
    test(`${name} has no violation`, async ({ page }) => {
      await page.goto(path);
      /* The readouts stream: the shell paints "Working out your numbers…" and
         the figures arrive after. Scanning the fallback would audit a page
         nobody is shown and pass. */
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      /* Report the colour pair and the ratio, not just a count. A failure
         message reading "expected 0, got 35" sends the next person back to the
         browser to find out which thirty-five. */
      const detail = results.violations.map((v) => {
        const where = v.nodes
          .slice(0, 4)
          .map((n) => {
            const d = n.any[0]?.data as
              | { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string }
              | undefined;
            const colour = d?.fgColor
              ? ` [${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}:1, needs ${d.expectedContrastRatio}]`
              : "";
            return `      ${n.target.join(" ")}${colour}`;
          })
          .join("\n");
        const more = v.nodes.length > 4 ? `\n      …and ${v.nodes.length - 4} more` : "";
        return `  ${v.id} (${v.impact}, ${v.nodes.length}): ${v.help}\n${where}${more}`;
      });

      /* The array, not a joined string. Comparing `detail.join("\n")` to `[]`
         is a comparison that can never be true, so the gate failed on pages
         with nothing wrong with them and would have gone on failing after the
         last violation was fixed — a test that is always red says exactly as
         little as one that is always green. */
      expect(detail, `${path}\n${detail.join("\n")}`).toEqual([]);
    });
  }
});

/**
 * Contrast is checked above by axe, which reads what the browser computed.
 * This asserts the token values themselves, which is a different question: axe
 * can only see a colour that something on the audited page happens to use, and
 * a token used on one surface this suite does not visit would go unmeasured.
 */
test("the ink ramp clears AA on every ground it is drawn on", async ({ page }) => {
  await page.goto("/buy");

  const ratios = await page.evaluate(() => {
    const root = document.querySelector(".rift")!;
    const s = getComputedStyle(root);
    const val = (n: string) => s.getPropertyValue(n).trim();

    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const L = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [L(a), L(b)];
      const [hi, lo] = x > y ? [x, y] : [y, x];
      return (hi + 0.05) / (lo + 0.05);
    };

    /* The three grounds text is ever drawn on in this product. --sunk is the
       darkest and therefore the binding one. */
    const grounds = ["--paper", "--canvas", "--sunk"].map(val);
    /* --ink-5 is deliberately absent: it is borders and rules, and a divider
       that met 4.5:1 would read as a line drawn in body text. */
    const inks = ["--ink", "--ink-2", "--ink-3", "--ink-4"];

    const out: Record<string, number> = {};
    for (const ink of inks) {
      out[ink] = Math.min(...grounds.map((g) => ratio(val(ink), g)));
    }
    out["--warn"] = ratio(val("--warn"), val("--warn-wash"));
    out["--pos"] = ratio(val("--pos"), val("--pos-wash"));
    out["--neg"] = ratio(val("--neg"), val("--neg-wash"));
    out["--accent-2"] = ratio(val("--accent-2"), val("--accent-wash"));
    return out;
  });

  for (const [token, r] of Object.entries(ratios)) {
    expect(r, `${token} is ${r.toFixed(2)}:1 on its worst ground, AA needs 4.5`).toBeGreaterThanOrEqual(4.5);
  }
});
