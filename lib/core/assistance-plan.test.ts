import { describe, it, expect } from "vitest";
import { matchAssistance, type Profile } from "./assistance";
import { assistancePlan } from "./assistance-plan";

const today = new Date("2026-10-01T12:00:00Z");
const profile: Profile = { county: "DeKalb", firstTime: true, price: 325_000, income: 70_000, household: 2, occupation: "educator" };

describe("my assistance plan (Blueprint v5 §5.1, D14)", () => {
  const r = matchAssistance(profile, { today, windowDays: 90 });
  const plan = assistancePlan(r.matches, profile);

  it("has steps for every potential match, what the answers could not settle first", () => {
    expect(plan.programs.map((p) => p.program.slug)).toEqual(r.matches.map((m) => m.program.slug));
    const homenow = plan.programs.find((p) => p.program.slug === "atl-homenow")!;
    expect(homenow.steps[0]).toMatch(/^Confirm location/);
  });

  it("names the kind of lender from the program's own record", () => {
    expect(plan.programs.find((p) => p.program.slug === "ga-dream-pen")!.lender).toMatch(/Georgia Dream participating lender/);
    expect(plan.programs.find((p) => p.program.slug === "fhlb-community-partners")!.lender).toMatch(/member bank/);
  });

  it("lists each document once, including proof of the job a program asks about", () => {
    expect(new Set(plan.documents).size).toBe(plan.documents.length);
    expect(plan.documents.join(" ")).toMatch(/employer/);
    expect(plan.documents.join(" ")).toMatch(/homebuyer education certificate/);
  });

  it("never says qualify or promises an approval", () => {
    const text = JSON.stringify(plan);
    expect(text).not.toMatch(/qualif|guarantee|you will receive/i);
  });
});
