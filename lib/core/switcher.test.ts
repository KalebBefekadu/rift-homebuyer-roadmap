import { describe, expect, it } from "vitest";
import { GO_KEYS, PAGES, isTypingTarget, matchPages } from "./switcher";

describe("the quick switcher", () => {
  it("finds a page by the start of any of its words, name matches first", () => {
    expect(matchPages("trans")[0].label).toBe("Transactions");
    expect(matchPages("coord").map((p) => p.label)).toEqual(["Settings: who does each step", "Settings: team"]);
    expect(matchPages("deals")[0].label).toBe("Transactions");
  });

  it("needs every typed word to match, and shows everything for a blank box", () => {
    expect(matchPages("settings team").map((p) => p.label)).toEqual(["Settings: team"]);
    expect(matchPages("")).toHaveLength(PAGES.length);
    expect(matchPages("zzz")).toEqual([]);
  });

  it("sends every go key to a page the switcher also knows", () => {
    for (const href of Object.values(GO_KEYS)) expect(PAGES.some((p) => p.href === href), href).toBe(true);
  });

  it("never fires while someone is typing", () => {
    expect(isTypingTarget({ tagName: "input" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
  });
});
