import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { outcomesFrom, weightFor, forecast, evidenceMix, TERMINAL, type Finished } from "./pipeline";

/**
 * The forecast must never be built from invented closings.
 *
 * `HISTORY` in pipeline.ts is forty-one outcomes written to look like a
 * plausible solo agent's record, and it used to be the DEFAULT argument to
 * `weightFor`, `forecast` and `evidenceMix`. Any caller that forgot to pass
 * real data silently got the fixture — and `BASIS_CHIP` labels a result with
 * twelve or more outcomes behind it "His own history" on screen.
 *
 * So the real assertion here is not about arithmetic. It is that no production
 * module can reach the fixture at all.
 */

const ROOT = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the seeded history cannot reach production", () => {
  it("is imported by nothing outside the prototype and its own tests", () => {
    const offenders: string[] = [];

    for (const file of walk(ROOT)) {
      const rel = file.slice(ROOT.length + 1);
      if (rel.startsWith("app/prototype/") || rel.startsWith("lib/prototype/")) continue;
      if (rel === "lib/core/pipeline.ts") continue;
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;

      const src = readFileSync(file, "utf8");
      /* The import, not the word. `PMMS_HISTORY_URL` is a different thing in a
         different module and matching bare "HISTORY" would flag it. */
      if (/\bimport\b[^;]*\bHISTORY\b[^;]*from\s+["'][^"']*pipeline["']/.test(src.replace(/\n/g, " "))) {
        offenders.push(rel);
      }
    }

    expect(offenders, `these reach the invented closings:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("outcomesFrom", () => {
  const closed = (through: string[]): Finished => ({ final: "Closed", through });
  const lost = (through: string[]): Finished => ({ final: "Lost", through });

  it("credits every stage a finished relationship passed through", () => {
    const out = outcomesFrom([closed(["Exploring", "Searching", "Under contract"])]);
    expect(out.map((o) => o.stage).sort()).toEqual(["Exploring", "Searching", "Under contract"]);
    expect(out.every((o) => o.closed)).toBe(true);
  });

  it("counts a stage once however many times it was entered", () => {
    /* Somebody who bounced Financing → Ready to shop → Financing → Ready to
       shop is one outcome per stage. Otherwise an indecisive client outweighs
       a decisive one, and the forecast learns that hesitation predicts
       closing. */
    const out = outcomesFrom([
      closed(["Financing", "Ready to shop", "Financing", "Ready to shop", "Financing"]),
    ]);
    expect(out).toHaveLength(2);
  });

  it("never counts a terminal stage as evidence", () => {
    /* "Of the deals that reached Closed, how many closed" is 100% by
       construction. A forecast that believes it reads every deal in its last
       week as certain. */
    const out = outcomesFrom([closed(["Under contract", "Closing", "Closed"])]);
    expect(out.map((o) => o.stage)).not.toContain("Closed");
    for (const t of TERMINAL) {
      expect(out.map((o) => o.stage)).not.toContain(t);
    }
  });

  it("records a lost relationship against the same stages", () => {
    const out = outcomesFrom([lost(["Exploring", "Searching"])]);
    expect(out).toHaveLength(2);
    expect(out.every((o) => o.closed)).toBe(false);
  });

  it("drops empty stage names rather than inventing a stage called nothing", () => {
    const out = outcomesFrom([{ final: "Closed", through: ["", "Searching", ""] }]);
    expect(out).toEqual([{ stage: "Searching", closed: true }]);
  });

  it("returns nothing for a book of business with no finished relationships", () => {
    expect(outcomesFrom([])).toEqual([]);
  });
});

describe("an empty history is honest, not broken", () => {
  it("reports every stage as assumed", () => {
    const w = weightFor("Searching", []);
    expect(w.basis).toBe("assumed");
    expect(w.n).toBe(0);
    expect(w.note).toMatch(/starting assumption/i);
  });

  it("does not claim his own history in the evidence mix", () => {
    const mix = evidenceMix(["Searching", "Under contract"], []);
    expect(mix.observed).toBe(0);
    expect(mix.assumed).toBe(2);
  });

  it("still produces a forecast, on the stated assumptions", () => {
    const rows = [{ name: "A", stage: "Under contract", value: 400_000 }];
    const buckets = forecast(rows, new Date("2026-09-21T12:00:00Z"), 4, []);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
    /* The bucket holding the row must say it is assuming. A month of guesses
       that renders as evidence is the failure this whole file guards. */
    const held = buckets.find((b) => b.count > 0)!;
    expect(held.basis).toBe("assumed");
  });
});

describe("real history moves the weight, and says so", () => {
  const many = (stage: string, closed: boolean, n: number): Finished[] =>
    Array.from({ length: n }, () => ({ final: closed ? "Closed" : "Lost", through: [stage] }));

  it("stays assumed below the minimum", () => {
    const h = outcomesFrom(many("Searching", true, 3));
    expect(weightFor("Searching", h).basis).toBe("assumed");
  });

  it("blends between the minimum and confident", () => {
    const h = outcomesFrom([...many("Searching", true, 5), ...many("Searching", false, 2)]);
    expect(weightFor("Searching", h).basis).toBe("blended");
  });

  it("becomes his own history at twelve outcomes", () => {
    const h = outcomesFrom([...many("Searching", true, 9), ...many("Searching", false, 5)]);
    const w = weightFor("Searching", h);
    expect(w.basis).toBe("observed");
    expect(w.n).toBe(14);
  });

  it("shrinks a small perfect record toward the assumption rather than believing it", () => {
    /* Five for five is 100%. A forecast that reports 100% from five closings
       is how a solo agent plans a year that does not happen. */
    const h = outcomesFrom(many("Searching", true, 5));
    expect(weightFor("Searching", h).weight).toBeLessThan(1);
  });
});
