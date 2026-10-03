import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanPlan } from "./saved-plan";
import { ALLOWED_META, sanitise } from "./telemetry";
import { ASKS, parseAnswers } from "./asks";
import type { InputKey } from "./values";
import {
  CODE_WORDING, INPUT_KEYS, cleanCustomAnswers, cleanWording, codeWording, customFor, diffWording,
  mergeAsk, wordingErrors, wordingFromRows, wordingToRows, type CustomKey, type CustomQuestion, type Wording,
} from "./question-wording";

const custom = (over: Partial<CustomQuestion> = {}): CustomQuestion => ({
  key: "x_abc123", type: "choice", title: "How did you hear about Kaleb?", why: null,
  options: [{ value: "a", label: "A friend" }, { value: "b", label: "Online" }],
  sides: ["buy"], values: [], enabled: true, ...over,
});

describe("merging published wording over the code's", () => {
  it("with nothing published, every question is the code's own object", () => {
    for (const k of INPUT_KEYS) expect(mergeAsk(k, CODE_WORDING)).toBe(ASKS[k]);
  });

  it("changes words and never what an answer feeds", () => {
    const w = cleanWording({ builtin: { downPct: {
      title: "What would you put down?", why: "",
      options: [{ value: "3.5", label: "Three and a half", hint: "FHA" }, { value: "99", label: "Ninety-nine" }],
      /* Sent anyway; must not arrive. */
      type: "money", param: "zz", fallback: "20",
    } } });
    const m = mergeAsk("downPct", w);
    expect(m.title).toBe("What would you put down?");
    expect(m.why).toBeUndefined();
    expect(m.type).toBe("choice");
    expect(m.param).toBe("d");
    expect(m.fallback).toBe("3.5");
    expect(m.options!.map((o) => o.value)).toEqual(ASKS.downPct.options!.map((o) => o.value));
    expect(m.options!.find((o) => o.value === "3.5")).toEqual({ value: "3.5", label: "Three and a half", hint: "FHA" });
    /* A relabelled choice still parses to the same compute value. */
    expect(parseAnswers((p) => (p === "d" ? "3.5" : undefined)).downPct).toBe("3.5");
  });

  it("keeps money limits and sliders from the code", () => {
    const w = cleanWording({ builtin: { price: { title: "Roughly what price?", unitLabel: "Price", limits: { min: 0, max: 1 } } } });
    const m = mergeAsk("price", w);
    expect(m.title).toBe("Roughly what price?");
    expect(m.unitLabel).toBe("Price");
    expect(m.limits).toEqual(ASKS.price.limits);
    expect(m.slider).toEqual(ASKS.price.slider);
  });

  it("never relabels a county", () => {
    const w = cleanWording({ builtin: { county: { title: "Which county in Georgia?", options: [{ value: "Fulton", label: "Atlanta" }] } } });
    expect(mergeAsk("county", w).options).toEqual(ASKS.county.options);
    expect(w.builtin.county!.options).toEqual([]);
  });

  it("drops an edit that says what the code says", () => {
    expect(cleanWording({ builtin: { price: codeWording("price") } }).builtin).toEqual({});
    /* An emptied title is the code's, not a blank question. */
    expect(cleanWording({ builtin: { price: { ...codeWording("price"), title: "  " } } }).builtin).toEqual({});
  });
});

describe("custom questions feed nothing (rule 5)", () => {
  it("no InputKey could ever be a custom key", () => {
    for (const k of INPUT_KEYS) expect(k.startsWith("x_")).toBe(false);
    // @ts-expect-error a custom key is not an input
    const k: InputKey = "x_abc123" as CustomKey;
    void k;
  });

  it("a bound compute input is refused by the type and dropped by the cleaner", () => {
    // @ts-expect-error `bound` is `never` on a custom question
    const q: CustomQuestion = { ...custom(), bound: "savings" };
    const w = cleanWording({ custom: [q] });
    expect(w.custom).toHaveLength(1);
    expect("bound" in w.custom[0]!).toBe(false);
    expect(wordingToRows(w)[0]).toMatchObject({ kind: "custom", bound: null });
  });

  it("a key that could name an input is dropped", () => {
    expect(cleanWording({ custom: [custom({ key: "savings" as CustomKey })] }).custom).toEqual([]);
    expect(cleanWording({ custom: [custom({ key: "x_Price" as CustomKey })] }).custom).toEqual([]);
  });

  it("an answer to one is never a compute answer", () => {
    const a = cleanCustomAnswers([custom()], { x_abc123: "a", price: 900000 });
    expect(a).toEqual([{ key: "x_abc123", question: "How did you hear about Kaleb?", answer: "a", label: "A friend" }]);
  });
});

describe("custom answers cannot reach a figure, by construction", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("nothing that computes imports the wording or its answers", () => {
    for (const f of ["lib/core/compute.ts", "lib/core/asks.ts", "lib/core/values.ts", "lib/core/afford.ts", "lib/core/assistance.ts", "lib/core/saved-plan.ts"]) {
      expect(read(f), `${f} must not know about the agent's own questions`).not.toMatch(/from\s+"[^"]*question-wording"|rift_custom_answers|custom_answers/);
    }
  });

  it("the plan a visitor saves never carries one, even if one is sent as an answer", () => {
    const plan = cleanPlan({ side: "buy", values: [], answers: { price: 300000, x_abc123: "a", custom: { x_abc123: "a" } } });
    expect(JSON.stringify(plan)).not.toContain("x_abc123");
    expect(Object.keys(plan.answers)).toEqual(["price"]);
  });

  it("telemetry refuses every key a custom answer could ride on", () => {
    expect(ALLOWED_META as readonly string[]).not.toContain("answer");
    expect(sanitise({ tool: "cash", x_abc123: "a", answer: "Online" })).toEqual({ tool: "cash" });
  });
});

describe("validating", () => {
  it("names what stops a publish", () => {
    const w: Wording = { builtin: {}, custom: [custom({ title: "Hi", sides: [], options: [{ value: "a", label: "Yes" }] })] };
    const e = wordingErrors(w).join(" | ");
    expect(e).toMatch(/at least 3 characters/);
    expect(e).toMatch(/at least one side/);
    expect(e).toMatch(/at least 2 choices/);
  });

  it("a clean set has none", () => {
    expect(wordingErrors(cleanWording({ custom: [custom()] }))).toEqual([]);
  });

  it("keeps only values on the question's sides", () => {
    const w = cleanWording({ custom: [custom({ sides: ["buy"], values: ["cash", "proceeds", "nope"] })] });
    expect(w.custom[0]!.values).toEqual(["cash"]);
  });
});

describe("diffing versions", () => {
  it("names each change in words", () => {
    const before = cleanWording({ custom: [custom()] });
    const after = cleanWording({
      builtin: { savings: { ...codeWording("savings"), title: "What have you saved?" } },
      custom: [custom({ enabled: false, options: [{ value: "a", label: "A friend" }, { value: "b", label: "Google" }] }), custom({ key: "x_new001", type: "text", title: "Anything else?" })],
    });
    const d = diffWording(before, after);
    expect(d).toContainEqual({ question: ASKS.savings.title, what: "Question", from: ASKS.savings.title, to: "What have you saved?" });
    expect(d).toContainEqual({ question: "How did you hear about Kaleb?", what: "Turned off" });
    expect(d).toContainEqual({ question: "How did you hear about Kaleb?", what: "Choices", from: "A friend / Online", to: "A friend / Google" });
    expect(d.find((c) => c.what === "Added")?.question).toBe("Anything else?");
  });

  it("a reorder is a change, and nothing is not", () => {
    const a = cleanWording({ custom: [custom(), custom({ key: "x_two222", title: "Second one?" })] });
    const b = cleanWording({ custom: [a.custom[1], a.custom[0]] });
    expect(diffWording(a, a)).toEqual([]);
    expect(diffWording(a, b).map((c) => c.what)).toEqual(["Order"]);
  });
});

describe("who is asked", () => {
  it("by side, on, and the plan's values", () => {
    const w = cleanWording({ custom: [custom(), custom({ key: "x_sell01", sides: ["sell"] }), custom({ key: "x_cash01", values: ["cash"] }), custom({ key: "x_off001", enabled: false })] });
    expect(customFor(w, "buy", ["assistance"]).map((q) => q.key)).toEqual(["x_abc123"]);
    expect(customFor(w, "buy", ["cash"]).map((q) => q.key)).toEqual(["x_abc123", "x_cash01"]);
    expect(customFor(w, "sell", []).map((q) => q.key)).toEqual(["x_sell01"]);
  });

  it("a text answer is trimmed and capped, an empty one is not an answer", () => {
    const q = custom({ type: "text", options: [] });
    expect(cleanCustomAnswers([q], { x_abc123: "   " })).toEqual([]);
    expect(cleanCustomAnswers([q], { x_abc123: "x".repeat(400) })[0]!.answer).toHaveLength(300);
    expect(cleanCustomAnswers([custom()], { x_abc123: "zz" })).toEqual([]);
  });
});

describe("rows", () => {
  it("round-trip through the table's shape, in order", () => {
    const w = cleanWording({
      builtin: { downPct: { ...codeWording("downPct"), why: null }, price: { ...codeWording("price"), unitLabel: "Price" } },
      custom: [custom({ key: "x_second", title: "Second question?" }), custom()],
    });
    const back = wordingFromRows(wordingToRows(w).reverse() as unknown as Record<string, unknown>[]);
    expect(back).toEqual(w);
  });
});
