import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A source guard against a layout bug that only appears on a phone.
 *
 * `.row` and `.row-t` are `display: flex`. Every direct child of one becomes a
 * column. With an icon and a single run of text that is exactly what is wanted
 * — icon in one column, prose in the other, prose wrapping normally inside its
 * own column.
 *
 * Put an inline link in the middle of the prose and it stops being one run.
 * The sentence becomes three siblings, and flex lays them out side by side:
 *
 *   ┌────────────────────────┬──────────────┬─────────────────────────┐
 *   │ …we used our own       │ Answer again │ for numbers that are    │
 *   │ figures for timing.    │              │ actually yours.         │
 *   └────────────────────────┴──────────────┴─────────────────────────┘
 *
 * On a wide screen all three fit on one line and it reads correctly, which is
 * why both disclosures on the buyer readout shipped this way and looked right
 * in every check that was not made at 375px. Same family as the rest of this
 * codebase's bugs: nothing threw, nothing was mis-typed, and the wrong outcome
 * was indistinguishable from the right one unless you looked in the one place
 * nobody looked.
 *
 * The rule, therefore, is about the property rather than those two lines: a
 * flex paragraph that contains an interactive element must wrap its prose in a
 * single element, so the flex container still sees one text column.
 */

const ROOTS = ["app/(rift)", "app/(studio)", "components/rift"];

function tsxFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Every `<p …>…</p>` in a file, as [openTag, innerMarkup, lineNumber]. */
function paragraphs(src: string): Array<{ open: string; inner: string; line: number }> {
  const out: Array<{ open: string; inner: string; line: number }> = [];
  const open = /<p\s[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    const close = src.indexOf("</p>", m.index);
    if (close === -1) continue;
    out.push({
      open: m[0],
      inner: src.slice(m.index + m[0].length, close),
      line: src.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

/** `.row` / `.row-t`, as whole words inside the className literal. */
function isFlexRow(openTag: string): boolean {
  const cls = /className="([^"]*)"/.exec(openTag)?.[1] ?? "";
  return /(^|\s)(row|row-t)(\s|$)/.test(cls);
}

const INTERACTIVE = /<(Link|a|button)[\s>]/;

describe("flex paragraphs do not shatter their own sentences", () => {
  const files = ROOTS.flatMap(tsxFiles);

  it("finds the files it is supposed to be guarding", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("wraps the prose whenever a row paragraph contains a link or a button", () => {
    const broken: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const p of paragraphs(src)) {
        if (!isFlexRow(p.open)) continue;
        if (!INTERACTIVE.test(p.inner)) continue;
        /* One wrapping element is enough: the icon is the other column, and
           everything the reader reads is then inside a single one. */
        if (/<span[\s>]/.test(p.inner)) continue;
        broken.push(`${file}:${p.line}`);
      }
    }

    expect(
      broken,
      "these paragraphs are flex containers with an inline link, so their text renders as " +
        "side-by-side columns on a narrow screen — wrap the prose in a <span>",
    ).toEqual([]);
  });
});
