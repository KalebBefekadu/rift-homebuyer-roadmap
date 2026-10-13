import { describe, expect, it } from "vitest";
import { nextHomesteadDeadline, unclaimedChecks, type UnclaimedAnswers } from "./unclaimed";

/* docs/audit/value-depth-2026-10.md §4.8, findings F3 to F6. */
const today = new Date("2026-10-13T15:00:00Z");
const base: UnclaimedAnswers = { homestead: "no", age65: "no", yearsOwned: 8 };
const text = (a: UnclaimedAnswers) => unclaimedChecks(a, today).map((c) => `${c.title} ${c.detail} ${c.figure ?? ""}`).join(" ");

describe("money you may be losing", () => {
  it("quotes nothing the person did not tell us (rule 11): no records, no default years", () => {
    for (const homestead of ["yes", "no", "unsure"] as const) {
      for (const age65 of ["yes", "no"] as const) {
        for (const yearsOwned of [1, 3, 8, 15]) {
          const t = text({ homestead, age65, yearsOwned });
          expect(t).not.toMatch(/records/i);
          expect(t).not.toMatch(/\b11 years\b/);
        }
      }
    }
  });

  it("asks a homeowner who has not filed homestead to file it, by the next April 1", () => {
    const c = unclaimedChecks(base, today).find((x) => x.id === "homestead-file")!;
    expect(c.detail).toMatch(/You told us/);
    expect(c.deadline).toEqual({ day: "2027-04-01", days: 170, label: "File by April 1" });
  });

  it("asks someone unsure to find out, and has nothing to file for someone who has", () => {
    const ids = (homestead: UnclaimedAnswers["homestead"]) => unclaimedChecks({ ...base, homestead }, today).map((c) => c.id);
    expect(ids("unsure")).toContain("homestead-check");
    expect(ids("yes").some((id) => id.startsWith("homestead"))).toBe(false);
  });

  it("raises the senior exemptions only when someone on the deed is 65 or older", () => {
    expect(unclaimedChecks({ ...base, age65: "yes" }, today).some((c) => c.id === "senior")).toBe(true);
    expect(unclaimedChecks(base, today).some((c) => c.id === "senior")).toBe(false);
  });

  it("tells a long-time owner about the home-sale exclusion and a recent buyer about the two-year rule", () => {
    expect(unclaimedChecks(base, today).find((c) => c.id === "exclusion")!.figure).toBe("Up to $250,000 single, $500,000 married filing jointly");
    expect(unclaimedChecks({ ...base, yearsOwned: 1 }, today).some((c) => c.id === "two-years")).toBe(true);
    expect(unclaimedChecks({ ...base, yearsOwned: 1 }, today).some((c) => c.id === "exclusion")).toBe(false);
  });

  it("shows no dollar figure except the ones set in law", () => {
    const allowed = /\$2,000|\$250,000|\$500,000/g;
    for (const homestead of ["yes", "no", "unsure"] as const) {
      for (const age65 of ["yes", "no"] as const) {
        expect(text({ homestead, age65, yearsOwned: 15 }).replace(allowed, "")).not.toMatch(/\$\d/);
      }
    }
  });

  it("always points at the assessment appeal window, without claiming the assessment is high", () => {
    const c = unclaimedChecks({ homestead: "yes", age65: "no", yearsOwned: 15 }, today).find((x) => x.id === "appeal")!;
    expect(c.deadline?.label).toBe("45 days from the date on your notice");
    expect(c.detail).not.toMatch(/\b(looks|is) high\b/i);
  });
});

describe("the homestead deadline", () => {
  it("is the next April 1 in Georgia, today included", () => {
    expect(nextHomesteadDeadline(new Date("2027-03-31T15:00:00Z"))).toEqual({ day: "2027-04-01", days: 1 });
    expect(nextHomesteadDeadline(new Date("2027-04-01T15:00:00Z"))).toEqual({ day: "2027-04-01", days: 0 });
    expect(nextHomesteadDeadline(new Date("2027-04-02T15:00:00Z"))).toEqual({ day: "2028-04-01", days: 365 });
  });
});
