import { describe, it, expect } from "vitest";
import { SCHEMA, briefError, instructions, readDraft } from "./campaign-draft";
import { MAX_BLOCKS } from "./campaign";
import { AI_WORKFLOWS, MODEL_FOR, PRICE_CENTS_PER_MTOK } from "./ai";

const flat = (over: Record<string, string>) => ({ type: "text", title: "", lede: "", body: "", label: "", valueId: "", county: "", ...over });
const heading = flat({ type: "heading", title: "Buying your first home in Clayton", lede: "See which Georgia programs may fit you and what each one checks." });
const cta = flat({ type: "cta", label: "Check my programs", valueId: "assistance" });

describe("an AI draft of a campaign (§5.10, CAMP-01)", () => {
  it("is counted against the same monthly limit, on a priced model", () => {
    expect(AI_WORKFLOWS).toContain("campaign-draft");
    expect(PRICE_CENTS_PER_MTOK[MODEL_FOR["campaign-draft"]]).toBeDefined();
  });

  it("is constrained to the approved block types, the live values and the covered counties", () => {
    const b = SCHEMA.properties.blocks.items;
    expect(b.properties.type.enum).toEqual(["heading", "text", "value", "programs", "cta"]);
    expect(b.properties.valueId.enum).toContain("assistance");
    expect(b.properties.county.enum).toContain("Clayton");
    expect(b.additionalProperties).toBe(false);
  });

  it("tells the model it never writes a number or a promise", () => {
    expect(instructions()).toMatch(/Never write a digit/);
    expect(instructions()).toMatch(/do not say anyone qualifies/);
  });

  it("keeps blocks that pass every rule, and lands in the editor valid", () => {
    const d = readDraft({ blocks: [heading, flat({ type: "programs", county: "Clayton" }), cta] });
    expect(d?.recipe.blocks.map((b) => b.type)).toEqual(["heading", "programs", "cta"]);
    expect(d?.dropped).toEqual([]);
    expect(d?.errors).toEqual([]);
  });

  it("drops a block with a number in its words rather than repairing it (AGENTS.md rule 1)", () => {
    const d = readDraft({ blocks: [heading, flat({ body: "Up to $15,000 toward your down payment in Clayton County." }), cta] });
    expect(d?.recipe.blocks).toHaveLength(2);
    expect(d?.dropped[0]).toMatch(/Block 2.*number/);
  });

  it("drops a promise, code or a link, with the composer's own reason", () => {
    const d = readDraft({ blocks: [heading, flat({ body: "Most renters in Clayton qualify for help buying a home." }), flat({ body: "Read more at https://example.com today please." }), cta] });
    expect(d?.recipe.blocks).toHaveLength(2);
    expect(d?.dropped).toHaveLength(2);
    expect(d?.dropped[0]).toMatch(/promises/);
    expect(d?.dropped[1]).toMatch(/no code or links/);
  });

  it("still says what the recipe needs when the heading was the block dropped", () => {
    const d = readDraft({ blocks: [flat({ type: "heading", title: "Get 3 programs now", lede: "Every renter in the county can buy a home this year." }), cta] });
    expect(d?.recipe.blocks).toHaveLength(1);
    expect(d?.errors.join(" ")).toMatch(/Start with a heading/);
  });

  it("returns nothing when nothing usable came back, and never more than the block limit", () => {
    expect(readDraft(null)).toBeNull();
    expect(readDraft({ blocks: [] })).toBeNull();
    expect(readDraft({ blocks: Array.from({ length: 12 }, () => cta) })?.recipe.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
  });

  it("needs a brief of a sentence or more", () => {
    expect(briefError("buyers")).toMatch(/who the page is for/);
    expect(briefError("First-time buyers in Clayton who rent")).toBeNull();
    expect(briefError("x".repeat(601))).toMatch(/under 600/);
  });
});
