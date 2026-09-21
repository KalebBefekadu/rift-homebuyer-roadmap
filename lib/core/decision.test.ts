import { describe, it, expect } from "vitest";
import {
  canRelease, balanced, statusOf, spreadOf, compare, daysLeft, chosen,
  KIND_LABEL, MIN_OPTIONS,
  type Decision, type Option,
} from "./decision";

/**
 * Decision Rooms.
 *
 * docs/benchmark.md scores 4.3 at 0 in production — absent, not weak. What is
 * tested here is almost entirely the restraint, because the failure mode of a
 * comparison tool is not a wrong number. It is a comparison that has quietly
 * made the choice: ordering by amount, showing one option with only good news,
 * or setting two different kinds of number side by side in the same column.
 */

let seq = 0;
const opt = (p: Partial<Option> = {}): Option => ({
  id: `o${seq++}`,
  label: "An option",
  detail: null,
  amountCents: null,
  amountLabel: null,
  upside: null,
  downside: null,
  sort: 0,
  ...p,
});

const room = (p: Partial<Decision> = {}): Decision => ({
  id: "d1",
  kind: "offers",
  question: "Which offer?",
  context: null,
  decideBy: null,
  releasedAt: null,
  decidedAt: null,
  chosenOptionId: null,
  outcomeNote: null,
  options: [],
  ...p,
});

describe("canRelease", () => {
  const two = [opt({ label: "A" }), opt({ label: "B" })];

  it("passes a plain two-option room", () => {
    expect(canRelease({ question: "Which?", options: two }).ok).toBe(true);
  });

  it("refuses a room with one option", () => {
    /* One option is not a choice. Presenting it as a decision asks somebody to
       agree with something they were never given an alternative to. */
    const c = canRelease({ question: "Which?", options: [opt()] });
    expect(c.ok).toBe(false);
    expect(c.blocks.join(" ")).toMatch(/not a choice/);
  });

  it("refuses a room with no options at all", () => {
    expect(canRelease({ question: "Which?", options: [] }).ok).toBe(false);
  });

  it("names the minimum it requires", () => {
    const c = canRelease({ question: "Which?", options: [opt()] });
    expect(c.blocks.join(" ")).toContain(String(MIN_OPTIONS));
  });

  it("refuses a room with no question", () => {
    expect(canRelease({ question: "   ", options: two }).ok).toBe(false);
  });

  it("refuses a mix of priced and unpriced options", () => {
    /* Side by side, an option with no number reads as one that costs
       nothing — which is the most expensive misreading available here. */
    const c = canRelease({
      question: "Which?",
      options: [
        opt({ label: "A", amountCents: 41_200_00, amountLabel: "would reach you" }),
        opt({ label: "B" }),
      ],
    });
    expect(c.ok).toBe(false);
    expect(c.blocks.join(" ")).toMatch(/reads as one that costs nothing/);
  });

  it("allows a room where nothing is priced", () => {
    /* "Sell first, then buy" has no figure, and forcing one would invent it. */
    expect(canRelease({ question: "Which order?", options: two }).ok).toBe(true);
  });

  it("refuses figures that describe different things", () => {
    const c = canRelease({
      question: "Which?",
      options: [
        opt({ label: "A", amountCents: 2_340_00, amountLabel: "a month" }),
        opt({ label: "B", amountCents: 18_400_00, amountLabel: "at the table" }),
      ],
    });
    expect(c.ok).toBe(false);
    expect(c.blocks.join(" ")).toMatch(/same kind of number/);
  });

  it("does not mind case or spacing in the figure labels", () => {
    const c = canRelease({
      question: "Which?",
      options: [
        opt({ label: "A", amountCents: 1, amountLabel: "A Month" }),
        opt({ label: "B", amountCents: 2, amountLabel: " a month " }),
      ],
    });
    expect(c.ok).toBe(true);
  });

  it("warns, but does not block, on a one-sided option", () => {
    /* An agent may genuinely have nothing to say either way. Blocking would
       teach him to type a word to get past the check. */
    const c = canRelease({
      question: "Which?",
      options: [
        opt({ label: "A", upside: "Closes fastest" }),
        opt({ label: "B", upside: "More money", downside: "Two weeks longer" }),
      ],
    });
    expect(c.ok).toBe(true);
    expect(c.warns.join(" ")).toMatch(/recommendation wearing a comparison/);
  });
});

describe("balanced", () => {
  it("is true when nobody argued a case either way", () => {
    expect(balanced([opt(), opt()])).toBe(true);
  });

  it("is true when every arguing option argues both ways", () => {
    expect(balanced([
      opt({ upside: "Fast", downside: "Less" }),
      opt({ upside: "More", downside: "Slow" }),
      opt(),
    ])).toBe(true);
  });

  it("is false when an option has only good news", () => {
    expect(balanced([opt({ upside: "Fast" }), opt({ upside: "More", downside: "Slow" })])).toBe(false);
  });

  it("is false when an option has only bad news", () => {
    expect(balanced([opt({ downside: "Risky" })])).toBe(false);
  });

  it("treats whitespace as nothing said", () => {
    expect(balanced([opt({ upside: "Fast", downside: "   " })])).toBe(false);
  });
});

describe("compare", () => {
  it("keeps the agent's order and never sorts by amount", () => {
    /* Sorting by amount would put the largest number first, and the largest
       number is not the best option. That is exactly what headlineTrap in
       lib/core/offers.ts exists to catch, and ordering every room that way
       would commit the mistake everywhere at once. */
    const cheap = opt({ label: "Cheapest", amountCents: 100, sort: 0 });
    const dear = opt({ label: "Priciest", amountCents: 900_000, sort: 1 });
    expect(compare([dear, cheap]).map((o) => o.label)).toEqual(["Cheapest", "Priciest"]);
  });

  it("falls back to the label when the order is tied", () => {
    expect(compare([
      opt({ label: "Beta", sort: 0 }),
      opt({ label: "Alpha", sort: 0 }),
    ]).map((o) => o.label)).toEqual(["Alpha", "Beta"]);
  });

  it("does not modify what it was given", () => {
    const list = [opt({ label: "B", sort: 1 }), opt({ label: "A", sort: 0 })];
    compare(list);
    expect(list.map((o) => o.label)).toEqual(["B", "A"]);
  });
});

describe("spreadOf", () => {
  it("reports what is actually at stake", () => {
    /* The sentence nobody works out for themselves: two offers whose headline
       prices differ by $9,000 may differ by $1,200 in what reaches the
       seller. */
    const s = spreadOf([
      opt({ amountCents: 412_300_00, amountLabel: "would reach you" }),
      opt({ amountCents: 411_100_00, amountLabel: "would reach you" }),
    ]);
    expect(s?.rangeCents).toBe(1_200_00);
    expect(s?.label).toBe("would reach you");
  });

  it("is null rather than zero when there are no figures", () => {
    /* A spread of $0 and no spread at all render identically and mean
       opposite things. */
    expect(spreadOf([opt(), opt()])).toBeNull();
  });

  it("is null when only one option carries a figure", () => {
    expect(spreadOf([opt({ amountCents: 100 }), opt()])).toBeNull();
  });

  it("reports a genuine zero spread as zero", () => {
    const s = spreadOf([
      opt({ amountCents: 500, amountLabel: "a month" }),
      opt({ amountCents: 500, amountLabel: "a month" }),
    ]);
    expect(s?.rangeCents).toBe(0);
  });
});

describe("statusOf", () => {
  it("is a draft until released", () => {
    expect(statusOf({ releasedAt: null, decidedAt: null })).toBe("draft");
  });

  it("is open once released", () => {
    expect(statusOf({ releasedAt: "2026-09-01T00:00:00Z", decidedAt: null })).toBe("open");
  });

  it("is decided once decided, released or not", () => {
    expect(statusOf({ releasedAt: "2026-09-01T00:00:00Z", decidedAt: "2026-09-05T00:00:00Z" })).toBe("decided");
    expect(statusOf({ releasedAt: null, decidedAt: "2026-09-05T00:00:00Z" })).toBe("decided");
  });
});

describe("chosen", () => {
  it("finds the option that was picked", () => {
    const a = opt({ label: "A" });
    const d = room({ options: [a, opt()], chosenOptionId: a.id });
    expect(chosen(d)?.label).toBe("A");
  });

  it("is null when nothing has been decided", () => {
    expect(chosen(room({ options: [opt()] }))).toBeNull();
  });

  it("is null rather than throwing when the chosen option is gone", () => {
    /* An option can be removed after a decision was recorded against it. A
       room that crashes is a worse answer to that than one that says the
       option is no longer here. */
    expect(chosen(room({ options: [opt()], chosenOptionId: "deleted" }))).toBeNull();
  });
});

describe("daysLeft", () => {
  const today = new Date("2026-09-21T12:00:00Z");

  it("counts to the deadline", () => {
    expect(daysLeft({ decideBy: "2026-09-24" }, today)).toBe(3);
    expect(daysLeft({ decideBy: "2026-09-21" }, today)).toBe(0);
    expect(daysLeft({ decideBy: "2026-09-19" }, today)).toBe(-2);
  });

  it("is null when nobody set one", () => {
    expect(daysLeft({ decideBy: null }, today)).toBeNull();
  });
});

describe("the vocabulary", () => {
  it("labels every kind", () => {
    for (const k of Object.keys(KIND_LABEL)) {
      expect(KIND_LABEL[k as keyof typeof KIND_LABEL].length).toBeGreaterThan(3);
    }
  });
});
