import { describe, it, expect } from "vitest";
import { assistanceRecipe, cleanRecipe, liveVersion, recipeErrors, tagIsCampaign, versionFor, type Publication, type Recipe } from "./campaign";

describe("campaign recipes (CAMP-01)", () => {
  it("the first recipe, the assistance path, is valid as it comes", () => {
    expect(recipeErrors(assistanceRecipe("Fulton"))).toEqual([]);
  });

  it("only approved blocks with plain words: no code, no links, no promises", () => {
    const r = (blocks: unknown[]): Recipe => cleanRecipe({ blocks });
    const head = { type: "heading", title: "Buying in Fulton", lede: "See what may fit you, with no account." };
    const cta = { type: "cta", label: "Check my programs", valueId: "assistance" };
    expect(recipeErrors(r([head, { type: "text", body: "<script>alert(1)</script> hello there" }, cta])).join()).toMatch(/plain words only/);
    expect(recipeErrors(r([head, { type: "text", body: "See our site at https://example.com today" }, cta])).join()).toMatch(/no code or links/);
    expect(recipeErrors(r([{ ...head, title: "You qualify for $10,000" }, cta])).join()).toMatch(/promises something/);
    expect(recipeErrors(r([head, { ...cta, valueId: "made-up" }])).join()).toMatch(/live values/);
    expect(recipeErrors(r([head, { type: "programs", county: "Atlantis" }, cta])).join()).toMatch(/county Rift covers/);
  });

  it("starts with a heading and leads to something useful", () => {
    expect(recipeErrors(cleanRecipe({ blocks: [{ type: "text", body: "A paragraph with enough words." }] }))).toEqual(expect.arrayContaining([
      expect.stringMatching(/Start with a heading/), expect.stringMatching(/Include a value or a call to action/),
    ]));
  });

  it("keeps only the known properties of each block, whatever was posted", () => {
    const c = cleanRecipe({ blocks: [{ type: "heading", title: "T", lede: "L", html: "<b>x</b>", style: "color:red" }, { type: "iframe", src: "x" }] });
    expect(c.blocks[0]).toEqual({ type: "heading", title: "T", lede: "L" });
    expect(c.blocks[1]).toEqual({ type: "text", body: "" });
  });
});

describe("publishing and versions (CAMP-03)", () => {
  const p = (action: Publication["action"], version: number | null, at: string): Publication => ({ action, version, by: "Kaleb", at });
  it("the live version is the latest publish or rollback; unpublished is none", () => {
    expect(liveVersion([])).toBeNull();
    expect(liveVersion([p("publish", 1, "a"), p("publish", 3, "b")])).toBe(3);
    expect(liveVersion([p("publish", 3, "a"), p("rollback", 2, "b")])).toBe(2);
    expect(liveVersion([p("publish", 3, "a"), p("unpublish", null, "b")])).toBeNull();
  });

  it("a visitor stays on the version they started on, and a made-up one falls back to live", () => {
    expect(versionFor("2", 3, [1, 2, 3])).toBe(2);
    expect(versionFor(undefined, 3, [1, 2, 3])).toBe(3);
    expect(versionFor("9", 3, [1, 2, 3])).toBe(3);
    expect(versionFor("1; drop table", 3, [1, 2, 3])).toBe(3);
  });
});

describe("which visits a campaign claims", () => {
  it("claims its own slug and any version of it", () => {
    expect(tagIsCampaign("cobb-sellers", "cobb-sellers")).toBe(true);
    expect(tagIsCampaign("cobb-sellers-v3", "cobb-sellers")).toBe(true);
    expect(tagIsCampaign("Cobb-Sellers-v12", "cobb-sellers")).toBe(true);
  });

  it("never claims a longer slug that merely starts with it", () => {
    expect(tagIsCampaign("cobb-sellers-v2", "cobb")).toBe(false);
    expect(tagIsCampaign("cobb-sellers", "cobb")).toBe(false);
    expect(tagIsCampaign("cobb-vacation", "cobb")).toBe(false);
  });

  it("claims nothing for a visit with no campaign", () => {
    expect(tagIsCampaign(null, "cobb")).toBe(false);
    expect(tagIsCampaign("", "cobb")).toBe(false);
  });
});
