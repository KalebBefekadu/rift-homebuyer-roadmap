import { describe, expect, it } from "vitest";
import { pickTab, placeHref, tabOf } from "./portal-tabs";

describe("portal tabs (WS11.2)", () => {
  it("opens the asked tab only when this member can see it", () => {
    expect(pickTab("homes", ["today", "homes", "help"])).toBe("homes");
    expect(pickTab("money", ["today", "homes", "help"])).toBe("today");
    expect(pickTab("nonsense", ["today", "help"])).toBe("today");
    expect(pickTab(undefined, ["today"])).toBe("today");
    expect(pickTab(["homes"], ["today", "homes"])).toBe("today");
  });

  it("sends Today's links to the tab their place is on", () => {
    expect(tabOf("priorities")).toBe("homes");
    expect(tabOf("under-contract")).toBe("today");
    expect(placeHref("offers")).toBe("?tab=offers#offers");
    expect(placeHref("somewhere-new")).toBe("?tab=today#somewhere-new");
  });
});
