import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Two stylesheets, one namespace.
 *
 * `app/globals.css` is loaded by the root layout; `app/prototype/rift.css` is
 * loaded by every Rift and Studio layout inside it. Both are plain global CSS
 * with no module scoping, so a class defined in both is resolved by whichever
 * stylesheet Next happens to emit second — which is not something any of this
 * code decides, states, or can rely on.
 *
 * It had already happened. A dark-ground `.chip` from the retired portal MVP
 * survived in globals.css and won: a selected filter on Studio's People screen
 * rendered as unselected, with the correct markup, the correct class and the
 * correct aria-pressed. Nothing was wrong except the colour, and nothing could
 * have told anyone.
 */

const read = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every class name a stylesheet defines a rule for. */
function definedClasses(path: string): Set<string> {
  const out = new Set<string>();
  for (const m of read(path).matchAll(/^([^{@}][^{}]*)\{/gm)) {
    for (const c of m[1]!.matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(c[1]!);
  }
  return out;
}

describe("the two global stylesheets", () => {
  it("do not define the same class twice", () => {
    const globals = definedClasses("app/globals.css");
    const rift = definedClasses("app/prototype/rift.css");
    const both = [...globals].filter((c) => rift.has(c)).sort();

    expect(both, "defined in both globals.css and rift.css — which one wins is decided by stylesheet order, not by anything here")
      .toEqual([]);
  });

  it("keeps globals.css to element rules and variables", () => {
    /* The narrower rule, and the one that prevents the collision rather than
       detecting it. globals.css exists to render a page that is OUTSIDE
       `.rift` — not-found and global-error. Anything reached through a Rift
       layout is rift.css's to style, and a class here is either dead or a
       collision waiting to happen. */
    const classes = [...definedClasses("app/globals.css")];
    expect(classes, "globals.css should hold no class rules — rift.css styles everything inside .rift")
      .toEqual([]);
  });
});

/**
 * The button reset, and the two years of evidence that it must stay weak.
 *
 * `.rift button { background: none; border: 0; padding: 0 }` exists so a bare
 * `<button>` reads as text. Written with any specificity at all, it out-
 * specifies the visual classes in the same file — and then it has to name its
 * own exceptions, one bug at a time.
 *
 * It has done this twice. `<button class="btn btn-p">` rendered as bare text
 * with no fill, while the identical `<a class="btn btn-p">` looked right,
 * because links were never matched. That was patched with a `:not([class~=
 * "btn"])`. Then `<button class="chip chip-ink">` hit the same wall: correct
 * markup, correct class, correct aria-pressed, rendered as plain text.
 *
 * Both were invisible to every test in this repository, because the page
 * rendered.
 */
describe("the button reset", () => {
  const css = read("app/prototype/rift.css");

  it("carries no specificity, so any class beats it", () => {
    const rule = css.split("\n").find((l) => /button\)?\s*\{[^}]*background:\s*none/.test(l));
    expect(rule, "the reset is gone or has been rewritten — read the comment above it first")
      .toBeTruthy();

    /* `:where()` is the whole mechanism. Without it the rule wins against
       every class in this file and has to be told, one at a time, which ones
       it is not allowed to break. */
    expect(rule, "the button reset must be wrapped in :where() so it has zero specificity")
      .toMatch(/:where\(/);
  });


  it("resets the font at zero specificity too", () => {
    /* `.rift button { font: inherit }` is (0,1,1) and beat `.chip`'s
       font-size. Found the same afternoon as the background, one line above
       it, by the same test — which is the argument for asserting the property
       rather than patching the instance. `cursor` may stay where it is: it is
       not a property any visual class sets, so it cannot out-specify one. */
    const line = css.split("\n").find((l) => /^:where\(\.rift button\)/.test(l));
    expect(line, "the zero-specificity button reset is gone").toBeTruthy();
    expect(line, "font: inherit must be inside the :where() reset, or it out-specifies every class's font-size")
      .toMatch(/font:\s*inherit/);

    const outside = css.split("\n").filter((l) => /^\.rift button\s*\{/.test(l));
    for (const l of outside) {
      expect(l, "a font or colour reset has moved back outside :where()")
        .not.toMatch(/font|color|background|border|padding/);
    }
  });

  it("needs no list of exceptions", () => {
    /* A `:not([class~="…"])` here is the symptom coming back. The list is
       always one bug behind, and the bug is silent. */
    const resets = css.split("\n").filter((l) => /\.rift button/.test(l) && /background:\s*none/.test(l));
    for (const r of resets) {
      expect(r, "an exemption list has reappeared on the button reset").not.toMatch(/:not\(/);
    }
  });
});
