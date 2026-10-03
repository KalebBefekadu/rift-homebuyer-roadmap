import { describe, it, expect } from "vitest";
import { EQUB_EXAMPLE, EQUB_TIMELINES, equbNote, equbPayout, equbTotalIn, parsePrice } from "./equb";
import { scoreLead } from "./lead";

describe("Equb example", () => {
  it("pays the figure printed on the page", () => {
    expect(equbPayout(EQUB_EXAMPLE)).toBe(48_000);
  });

  it("returns every member exactly what they put in, so being early costs time and not money", () => {
    expect(equbTotalIn(EQUB_EXAMPLE)).toBe(equbPayout(EQUB_EXAMPLE));
  });

  it("gives no figure when the cycle does not match the group, rather than a wrong one", () => {
    expect(equbPayout({ members: 24, monthly: 2_000, months: 12 })).toBeNull();
    expect(equbPayout({ members: 0, monthly: 2_000, months: 0 })).toBeNull();
    expect(equbPayout({ members: 10, monthly: -5, months: 10 })).toBeNull();
    expect(equbPayout({ members: 10.5, monthly: 100, months: 10.5 })).toBeNull();
  });
});

describe("parsePrice", () => {
  it.each([["$350,000", 350_000], ["350000", 350_000], ["350k", 350_000], ["1.2m", 1_200_000], [" $ 425,500 ", 425_500]])(
    "reads %s", (raw, want) => expect(parsePrice(raw)).toBe(want),
  );
  it.each(["", "abc", "$5", "99999999999", "3.5.0k", "-300000"])("refuses %j", (raw) => expect(parsePrice(raw)).toBeNull());
});

describe("a seat request in the lead scorer", () => {
  const lead = (timing: string, note?: string) => ({
    side: "buy" as const, timing, completion: 1, hoursSince: 0, value: 350_000,
    monthsToReady: null, coBuyer: false, contactable: true, source: "equb", note,
  });

  it("offers only timelines the scorer understands", () => {
    /* A timeline spelled any other way scores as the lowest bucket, silently:
       the page would be ranking every Equb lead as "just exploring". */
    const scores = EQUB_TIMELINES.map((t) => scoreLead(lead(t)).score);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[1]).toBeGreaterThan(scores[2]!);
    expect(scores[2]).toBeGreaterThan(scores[3]!);
  });

  it("shows the note to the agent without letting it move the score", () => {
    const plain = scoreLead(lead("3 to 9 months"));
    const noted = scoreLead(lead("3 to 9 months", equbNote({ household: "4", language: "English", price: "$350,000" })));
    expect(noted.score).toBe(plain.score);
    const sig = noted.signals.find((s) => s.label === "In their request");
    expect(sig?.points).toBe(0);
    expect(sig?.note).toBe("Equb seat request · household of 4 · prefers English · target $350,000");
    expect(plain.signals.some((s) => s.label === "In their request")).toBe(false);
  });

  it("leaves out what was not answered", () => {
    expect(equbNote({ household: "", language: "አማርኛ", price: "" })).toBe("Equb seat request · prefers አማርኛ");
  });
});
