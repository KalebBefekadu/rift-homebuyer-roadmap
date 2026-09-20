import { describe, it, expect } from "vitest";
import { BUY_FUNNEL, SELL_FUNNEL, applyWording, wordingChanges, type Wording } from "./funnel";

/**
 * What an agent is allowed to change about his own questions.
 *
 * The answer is: the words, and only the words. These tests exist to make that
 * enforceable rather than remembered, because the failure mode of getting it
 * wrong is silent and total.
 *
 * `county` feeds the programme registry. `savings` and `monthlySaving` feed
 * the months-to-close arithmetic that the entire buyer readout is built
 * around. `own` decides first-time-buyer eligibility, which decides which
 * assistance programmes somebody is shown. An editor that could drop one of
 * those, or change the machine value behind "No, I haven't owned anything",
 * would not throw. It would produce a readout computed against a default —
 * perfectly rendered, and about nobody.
 */

const wording = (w: Record<string, Wording>) => applyWording(BUY_FUNNEL, w);
const q = (f: typeof BUY_FUNNEL, id: string) => f.questions.find((x) => x.id === id)!;

describe("what it changes", () => {
  it("replaces a question's words", () => {
    const f = wording({ county: { title: "Whereabouts in Georgia?" } });
    expect(q(f, "county").title).toBe("Whereabouts in Georgia?");
  });

  it("replaces the note underneath", () => {
    const f = wording({ county: { description: "Programmes differ by county." } });
    expect(q(f, "county").description).toBe("Programmes differ by county.");
  });

  it("renames an option without moving what it means", () => {
    const own = q(BUY_FUNNEL, "ownership");
    const first = own.options![0]!;
    const f = wording({ ownership: { optionLabels: { [first.value]: "Never owned one" } } });
    const after = q(f, "ownership").options![0]!;

    expect(after.label).toBe("Never owned one");
    expect(after.value).toBe(first.value);
  });

  it("trims, because a trailing space in a heading is not a decision", () => {
    expect(q(wording({ county: { title: "  Which county?  " } }), "county").title).toBe("Which county?");
  });
});

describe("what it cannot change, whatever it is handed", () => {
  /* Every one of these is a structural field. None is readable from the
     input by construction — these assert that the construction holds. */
  const hostile = {
    county: {
      title: "Still fine to rename",
      id: "somethingElse",
      key: "somethingElse",
      bound: null,
      type: "text",
      required: false,
      enabled: false,
      options: [{ label: "Anywhere", value: "anywhere" }],
      min: 0, max: 0, step: 0,
    },
  } as unknown as Record<string, Wording>;

  const before = q(BUY_FUNNEL, "county");
  const after = q(applyWording(BUY_FUNNEL, hostile), "county");

  it("keeps the key", () => expect(after.id).toBe(before.id));
  it("keeps what it is bound to", () => expect(after.bound).toBe(before.bound));
  it("keeps the field type", () => expect(after.type).toBe(before.type));
  it("keeps whether it is required", () => expect(after.required).toBe(before.required));
  it("keeps whether it is asked at all", () => expect(after.enabled).toBe(before.enabled));

  it("keeps every option and every machine value", () => {
    expect(after.options?.map((o) => o.value)).toEqual(before.options?.map((o) => o.value));
    expect(after.options?.length).toBe(before.options?.length);
  });

  it("still applies the part that was allowed", () => {
    /* A hostile payload is not a reason to discard the legitimate edit inside
       it — the rule is that structure is unreachable, not that a suspicious
       object is rejected wholesale. */
    expect(after.title).toBe("Still fine to rename");
  });
});

describe("it never produces a broken funnel", () => {
  for (const [name, funnel] of [["buyer", BUY_FUNNEL], ["seller", SELL_FUNNEL]] as const) {
    it(`keeps every ${name} question, in order, whatever is stored`, () => {
      const junk = {
        nosuchquestion: { title: "ignored" },
        county: { title: "" },
        savings: { title: "   " },
      } as Record<string, Wording>;
      const f = applyWording(funnel, junk);

      expect(f.questions.map((x) => x.id)).toEqual(funnel.questions.map((x) => x.id));
      /* Blank falls back to the code's own words rather than rendering a
         question with no text. */
      for (const x of f.questions) expect(x.title.trim()).not.toBe("");
    });

    it(`is the identity on ${name} when nothing is stored`, () => {
      expect(applyWording(funnel, {})).toEqual(funnel);
    });
  }

  it("ignores a key that is not a question", () => {
    expect(applyWording(BUY_FUNNEL, { nothingLikeThis: { title: "x" } })).toEqual(BUY_FUNNEL);
  });

  it("survives null and undefined inside a stored record", () => {
    const f = applyWording(BUY_FUNNEL, {
      county: { title: undefined, description: null as unknown as string },
    });
    expect(q(f, "county").title).toBe(q(BUY_FUNNEL, "county").title);
  });
});

describe("the diff the agent reads before publishing", () => {
  it("says nothing when nothing changed", () => {
    expect(wordingChanges(BUY_FUNNEL, {})).toEqual([]);
  });

  it("quotes both the old words and the new", () => {
    const [line] = wordingChanges(BUY_FUNNEL, { county: { title: "Whereabouts?" } });
    expect(line).toContain(q(BUY_FUNNEL, "county").title);
    expect(line).toContain("Whereabouts?");
  });

  it("reports a renamed option", () => {
    const own = q(BUY_FUNNEL, "ownership");
    const first = own.options![0]!;
    const lines = wordingChanges(BUY_FUNNEL, { ownership: { optionLabels: { [first.value]: "Never owned one" } } });
    expect(lines.join(" ")).toContain("Never owned one");
  });

  it("does not report an edit that resolved back to the original", () => {
    const county = q(BUY_FUNNEL, "county");
    expect(wordingChanges(BUY_FUNNEL, { county: { title: county.title } })).toEqual([]);
    /* Blank is not a change either — it falls back to the same words. */
    expect(wordingChanges(BUY_FUNNEL, { county: { title: "  " } })).toEqual([]);
  });
});
