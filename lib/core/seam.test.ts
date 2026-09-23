import { describe, expect, it } from "vitest";
import { CARRY_CHIP, CARRY_LABEL, CROSSINGS, DRIFT_PCT, canPublish, drift, mustDisclose } from "./seam";
import type { TrustState } from "./review";

/**
 * The moment a stranger becomes a client.
 *
 * This module is the only place where two systems hold an opinion about the
 * same number: the readout somebody was given for free, and the plan they are
 * given after they sign. The product's whole claim is that those two agree, or
 * that the disagreement is said out loud. Nothing tested it.
 */

const ok = {
  hasAgreement: true,
  hasSnapshot: true,
  drifts: [],
  disclosed: false,
  trustStates: ["verified"] as TrustState[],
};

describe("a figure that moved", () => {
  it("is not material inside the threshold", () => {
    const d = drift("Cash to close", 31_190, 31_500, "Rate moved 0.1%.");
    expect(d.deltaPct).toBe(1);
    expect(d.material).toBe(false);
  });

  it("is material at the threshold, not merely past it", () => {
    /* 3% of $31,000 is about $930, which is not a rounding difference to
       somebody saving for a house. The boundary belongs on the strict side. */
    const at = drift("Cash to close", 100_000, 103_000, "Rate.");
    expect(at.deltaPct).toBe(DRIFT_PCT);
    expect(at.material).toBe(true);
  });

  it("is material when it moves down as far as it would have to move up", () => {
    expect(drift("Gap", 100_000, 97_000, "Programme opened.").material).toBe(true);
    expect(drift("Gap", 100_000, 97_500, "Programme opened.").material).toBe(false);
  });

  it("does not move at all when nothing changed", () => {
    const d = drift("Matched assistance", 10_000, 10_000, "Re-checked, no change.");
    expect(d.deltaPct).toBe(0);
    expect(d.material).toBe(false);
  });

  it("keeps the cause, because a drift without one is a bug report", () => {
    expect(drift("Gap", 1, 2, "Rate moved.").cause).toBe("Rate moved.");
  });

  it("rounds to one decimal so the screen does not show sixteen", () => {
    expect(drift("Gap", 31_190, 32_410, "Rate.").deltaPct).toBe(3.9);
  });
});

/**
 * The seller side of this product produces negative figures on purpose:
 * `parseSellerParams` lets a payoff exceed the price because being underwater
 * "is exactly the situation somebody most needs an honest number for".
 */
describe("a figure that was below zero to begin with", () => {
  it("reads positive when the client's position improves", () => {
    /* $113,575 short, improved to $50,000 short. Dividing by the signed
       baseline gave -56%, rendered with its sign beside a cause explaining the
       improvement: the client's screen said their position more than halved
       for the worse. */
    const d = drift("Net proceeds", -113_575, -50_000, "Payoff statement came in lower than the estimate.");
    expect(d.deltaPct).toBeGreaterThan(0);
    expect(d.deltaPct).toBe(56);
    expect(d.material).toBe(true);
  });

  it("reads negative when it gets worse", () => {
    expect(drift("Net proceeds", -100_000, -150_000, "Repairs.").deltaPct).toBe(-50);
  });

  it("reads positive when it crosses zero into the good", () => {
    const d = drift("Net proceeds", -10_000, 5_000, "Price rose.");
    expect(d.deltaPct).toBe(150);
  });

  it("handles no baseline without losing the direction", () => {
    expect(drift("Gap", 0, 0, "-").deltaPct).toBe(0);
    expect(drift("Gap", 0, 5_000, "-").deltaPct).toBe(100);
    expect(drift("Gap", 0, -5_000, "-").deltaPct).toBe(-100);
  });
});

describe("what has to be disclosed", () => {
  it("is exactly the material ones", () => {
    const ds = [
      drift("A", 100, 101, "small"),
      drift("B", 100, 110, "big"),
      drift("C", 100, 85, "big the other way"),
    ];
    expect(mustDisclose(ds).map((d) => d.field)).toEqual(["B", "C"]);
  });

  it("is empty when nothing moved", () => {
    expect(mustDisclose([drift("A", 100, 100, "-")])).toEqual([]);
  });
});

describe("what must be true before a plan goes out", () => {
  it("passes when everything is in order", () => {
    const r = canPublish(ok);
    expect(r.ok).toBe(true);
    expect(r.blocks).toEqual([]);
  });

  it("refuses without a snapshot, which is the thing it must be honest about", () => {
    const r = canPublish({ ...ok, hasSnapshot: false });
    expect(r.ok).toBe(false);
    expect(r.blocks.join(" ")).toContain("nothing to be honest about");
  });

  it("refuses without a signed agreement", () => {
    const r = canPublish({ ...ok, hasAgreement: false });
    expect(r.ok).toBe(false);
    expect(r.blocks.join(" ")).toContain("wrong order");
  });

  it("refuses while a material drift is undisclosed, and allows it once shown", () => {
    const drifts = [drift("Cash to close", 100_000, 110_000, "Rate moved.")];
    expect(canPublish({ ...ok, drifts }).ok).toBe(false);
    expect(canPublish({ ...ok, drifts, disclosed: true }).ok).toBe(true);
  });

  it("does not demand disclosure for a drift nobody would notice", () => {
    expect(canPublish({ ...ok, drifts: [drift("Cash to close", 100_000, 101_000, "Rate.")] }).ok).toBe(true);
  });

  it("counts the drifts correctly in what it says", () => {
    const one = canPublish({ ...ok, drifts: [drift("A", 100, 200, "x")] });
    expect(one.blocks.join(" ")).toContain("1 figure has moved");
    const two = canPublish({ ...ok, drifts: [drift("A", 100, 200, "x"), drift("B", 100, 200, "x")] });
    expect(two.blocks.join(" ")).toContain("2 figures have moved");
  });

  it("warns, but does not block, when every figure is still preliminary", () => {
    const r = canPublish({ ...ok, trustStates: ["preliminary", "preliminary"] });
    expect(r.ok).toBe(true);
    expect(r.warns.join(" ")).toContain("preliminary estimate");
  });

  it("says nothing about the figures when there are none", () => {
    /* `[].every()` is true, so an empty plan asserted that every figure in it
       was preliminary: a claim about an empty set, on the first screen of a
       new relationship. */
    expect(canPublish({ ...ok, trustStates: [] }).warns).toEqual([]);
  });

  it("does not warn when one figure has been verified", () => {
    expect(canPublish({ ...ok, trustStates: ["preliminary", "verified"] }).warns).toEqual([]);
  });

  it("reports every reason at once rather than the first", () => {
    const r = canPublish({ ...ok, hasAgreement: false, hasSnapshot: false });
    expect(r.blocks).toHaveLength(2);
  });
});

describe("the crossing table covers the readout", () => {
  it("gives every field a carry rule and a reason", () => {
    expect(CROSSINGS.length).toBeGreaterThan(5);
    for (const c of CROSSINGS) {
      expect(c.field.trim()).not.toBe("");
      expect(c.why.trim().length).toBeGreaterThan(20);
      expect(CARRY_LABEL[c.carry]).toBeTruthy();
      expect(CARRY_CHIP[c.carry]).toBeTruthy();
    }
  });

  it("lists no field twice, which would be two rules for one number", () => {
    const fields = CROSSINGS.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
  });

  /* Rule 3: publishing is not verification. */
  it("freezes the trust state rather than recomputing it", () => {
    const trust = CROSSINGS.find((c) => c.field === "Trust state of each figure");
    expect(trust?.carry).toBe("snapshot");
  });

  /* Rule 1: the readout is theirs. */
  it("freezes the readout itself", () => {
    expect(CROSSINGS.find((c) => c.field === "The readout as they saw it")?.carry).toBe("snapshot");
  });

  it("drops the lead score once they are a client", () => {
    expect(CROSSINGS.find((c) => c.field === "Lead score and band")?.carry).toBe("drop");
  });

  it("recomputes the headline gap, because they will plan against it", () => {
    expect(CROSSINGS.find((c) => c.field === "The headline gap")?.carry).toBe("recompute");
  });
});
