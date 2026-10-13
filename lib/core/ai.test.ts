import { describe, it, expect } from "vitest";
import { allowance, costCents, dayStart, monthStart, AI_WORKFLOWS, DAILY_CENTS, MODEL_FOR, PRICE_CENTS_PER_MTOK, MONTHLY_LIMIT_CENTS, RESERVE_CENTS, SHARE_CENTS } from "./ai";
import { readCandidates, SCHEMA, FIELDS } from "./offer-extract";

describe("the AI limit (Blueprint v5 §10.2, D16)", () => {
  it("is $50 a month, and every workflow's model has a price", () => {
    expect(MONTHLY_LIMIT_CENTS).toBe(5_000);
    for (const m of Object.values(MODEL_FOR)) expect(PRICE_CENTS_PER_MTOK[m], m).toBeDefined();
  });

  it("costs are rounded up, so the running total never under-counts", () => {
    expect(costCents("claude-opus-5", { input_tokens: 30_000, output_tokens: 1_000 })).toBe(18);
    expect(costCents("claude-haiku-4-5", { input_tokens: 1, output_tokens: 0 })).toBe(1);
    expect(() => costCents("some-new-model", { input_tokens: 1, output_tokens: 1 })).toThrow(/no price/);
  });

  const none = { month: 0, workflow: 0, today: 0 };

  it("refuses a call that could take the month over the limit, and says why", () => {
    expect(allowance({ configured: true, spent: none, workflow: "offer-extraction" })).toEqual({ ok: true });
    const near = allowance({ configured: true, spent: { ...none, month: MONTHLY_LIMIT_CENTS - RESERVE_CENTS["offer-extraction"] + 1 }, workflow: "offer-extraction" });
    expect(near).toMatchObject({ ok: false, reason: "over-limit" });
    expect(allowance({ configured: false, spent: none, workflow: "program-compare" })).toMatchObject({ ok: false, reason: "not-configured" });
  });

  it("gives each workflow its own share, adding up to the month (D41)", () => {
    expect(AI_WORKFLOWS.reduce((s, w) => s + SHARE_CENTS[w], 0)).toBe(MONTHLY_LIMIT_CENTS);
    for (const w of AI_WORKFLOWS) expect(RESERVE_CENTS[w], w).toBeLessThan(SHARE_CENTS[w]);
  });

  it("an offer upload that has used its share cannot stop the program comparison", () => {
    const share = SHARE_CENTS["offer-extraction"];
    const offers = allowance({ configured: true, spent: { month: share, workflow: share, today: 0 }, workflow: "offer-extraction" });
    expect(offers).toMatchObject({ ok: false, reason: "over-limit", say: expect.stringMatching(/this month/) });
    expect(allowance({ configured: true, spent: { month: share, workflow: 0, today: 0 }, workflow: "program-compare" })).toEqual({ ok: true });
  });

  it("the public workflow stops for the day before it can spend the week", () => {
    const day = DAILY_CENTS["offer-extraction"]!;
    expect(day).toBeLessThan(SHARE_CENTS["offer-extraction"] / 4);
    const r = allowance({ configured: true, spent: { month: day, workflow: day, today: day - RESERVE_CENTS["offer-extraction"] + 1 }, workflow: "offer-extraction" });
    expect(r).toMatchObject({ ok: false, reason: "over-limit", say: expect.stringMatching(/today's limit and starts again tomorrow/) });
    /* Only on the workflow a stranger can start. */
    expect(DAILY_CENTS["program-compare"]).toBeUndefined();
  });

  it("the day starts at midnight Eastern, or an hour earlier, never later", () => {
    expect(dayStart(new Date("2026-10-15T12:00:00Z"))).toBe("2026-10-15T04:00:00Z");
    /* 11:30pm on 14 January in Georgia is still the 14th. */
    expect(dayStart(new Date("2026-01-15T04:30:00Z"))).toBe("2026-01-14T04:00:00Z");
  });

  it("the month starts at midnight Eastern, or an hour earlier, never later", () => {
    expect(monthStart(new Date("2026-10-15T12:00:00Z"))).toBe("2026-10-01T04:00:00Z");
    /* 11:30pm on 31 January in Georgia is still January. */
    expect(monthStart(new Date("2026-02-01T04:30:00Z"))).toBe("2026-01-01T04:00:00Z");
  });
});

const hit = (value: string, page = 1, quote = "…") => ({ found: true, value, page, quote });
const miss = { found: false, value: "", page: 0, quote: "" };
const answer = (over: Record<string, unknown>) => ({ ...Object.fromEntries(FIELDS.map((f) => [f, miss])), ...over });

describe("reading an offer PDF (§5.9, DOC-02)", () => {
  it("the schema asks for every field, each with its page and words", () => {
    expect(SCHEMA.required).toEqual([...FIELDS]);
    expect(SCHEMA.additionalProperties).toBe(false);
  });

  it("keeps candidates that pass the form's own checks, with where they came from", () => {
    const c = readCandidates(answer({
      price: hit("$410,000", 1, "Purchase Price: $410,000"),
      earnest: hit("5,000", 2, "Earnest Money: $5,000"),
      financing: hit("FHA", 1, "FHA loan"),
      closeOn: hit("2026-11-14", 3, "Closing Date: November 14, 2026"),
      dueDiligenceDays: hit("10", 3, "Due Diligence Period of 10 days"),
      contingencies: hit("Inspection, Appraisal, Something else", 4, "…"),
    }), 12);
    expect(c.price).toEqual({ value: "410000", page: 1, quote: "Purchase Price: $410,000" });
    expect(c.earnest?.value).toBe("5000");
    expect(c.financing?.value).toBe("fha");
    expect(c.closeOn?.value).toBe("2026-11-14");
    expect(c.dueDiligenceDays?.value).toBe("10");
    expect(c.contingencies?.value).toBe("Inspection, Appraisal");
  });

  it("drops rather than repairs anything that cannot be right", () => {
    const c = readCandidates(answer({
      price: hit("410000"),
      earnest: hit("900000"),
      closeOn: hit("November 14"),
      dueDiligenceDays: hit("120"),
      financing: hit("crypto"),
      address: hit("123 Main St, Atlanta, GA 30303", 99, "…"),
      concessions: { found: true, value: "5000", page: 1, quote: "" },
    }), 12);
    expect(c.price?.value).toBe("410000");
    expect(c.earnest).toBeUndefined();
    expect(c.closeOn).toBeUndefined();
    expect(c.dueDiligenceDays).toBeUndefined();
    expect(c.financing).toBeUndefined();
    /* A page the document does not have, or no quoted words: nothing to check it against. */
    expect(c.address).toBeUndefined();
    expect(c.concessions).toBeUndefined();
  });

  it("'other' financing is only described when the financing is other", () => {
    expect(readCandidates(answer({ financing: hit("conventional"), financingOther: hit("seller financing") })).financingOther).toBeUndefined();
    expect(readCandidates(answer({ financing: hit("other"), financingOther: hit("seller financing") })).financingOther?.value).toBe("seller financing");
  });

  it("anything that is not an answer reads as nothing", () => {
    expect(readCandidates(null)).toEqual({});
    expect(readCandidates("price: 410000")).toEqual({});
  });
});
