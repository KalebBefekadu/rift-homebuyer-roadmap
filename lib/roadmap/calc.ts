import type { RoadmapInputs, RoadmapOutputs } from "./types";

/** Pure calculation engine. Source of truth: docs/04-calculation-spec.md */
export function computeRoadmap(i: RoadmapInputs): RoadmapOutputs {
  const down = (i.price * i.downPct) / 100;
  const loan = Math.max(i.price - down, 0);
  const r = i.ratePct / 100 / 12;
  const n = i.termYears * 12;
  const monthlyPI =
    loan <= 0 ? 0 : r === 0 ? loan / n : (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const monthlyTax = (i.price * i.taxPct) / 100 / 12;
  const monthlyInsurance = i.insuranceYr / 12;
  const monthlyPMI = i.downPct < 20 && i.pmiPct > 0 ? (loan * i.pmiPct) / 100 / 12 : 0;
  const monthlyHOA = i.hoaMo;
  const monthlyTotal = monthlyPI + monthlyTax + monthlyInsurance + monthlyPMI + monthlyHOA;
  const closingCosts = (i.price * i.closingPct) / 100;
  const cashToClose = down + closingCosts;
  const covered = i.savings + i.dpaTotal;
  const cashGap = Math.max(cashToClose - covered, 0);
  return {
    down,
    loan,
    monthlyPI,
    monthlyTax,
    monthlyInsurance,
    monthlyPMI,
    monthlyHOA,
    monthlyTotal,
    closingCosts,
    cashToClose,
    covered,
    cashGap,
    fullyCovered: covered >= cashToClose,
  };
}
