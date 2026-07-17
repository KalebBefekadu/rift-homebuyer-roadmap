export interface RoadmapInputs {
  price: number;
  downPct: number;
  ratePct: number;
  termYears: number;
  taxPct: number;
  insuranceYr: number;
  hoaMo: number;
  closingPct: number;
  pmiPct: number;
  savings: number;
  dpaTotal: number;
}

export interface RoadmapOutputs {
  down: number;
  loan: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  monthlyTotal: number;
  closingCosts: number;
  cashToClose: number;
  covered: number;
  cashGap: number;
  fullyCovered: boolean;
}

export type TimeToBuy = "0-3" | "3-9" | "9+";

export type ClientStage =
  | "lead"
  | "roadmap_done"
  | "working_gap"
  | "mortgage_ready"
  | "shopping"
  | "closed"
  | "nurture";

export interface DpaProgramSelection {
  id?: string;
  name: string;
  amount: number;
  note: string;
}

export interface NextMove {
  text: string;
  dueBy: string;
}

export interface AgentBranding {
  displayName: string;
  brandName: string;
  roleLine: string;
  phone: string;
  email: string;
  markLetter: string;
  brandColor: string;
  accentColor: string;
}

export interface CalcDefaults {
  defaultRate: number;
  defaultTaxPct: number;
  defaultInsuranceYr: number;
  defaultClosingPct: number;
  defaultPmiPct: number;
}

export interface RoadmapFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preparedDate: string;
  timeToBuy: TimeToBuy;
  timeline: string;
  homeType: string;
  beds: string;
  baths: string;
  areas: string;
  features: string[];
  featuresOther: string;
  price: number;
  downPct: number;
  ratePct: number;
  termYears: number;
  taxPct: number;
  insuranceYr: number;
  hoaMo: number;
  closingPct: number;
  pmiPct: number;
  savings: number;
  creditNow: string;
  creditGoal: string;
  creditWhen: string;
  incomeNotes: string;
  dpaPrograms: DpaProgramSelection[];
  moves: NextMove[];
  personalNote: string;
  county: string;
}

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function dpaTotalFromPrograms(programs: DpaProgramSelection[]): number {
  return programs.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

export function formToCalcInputs(form: RoadmapFormState): RoadmapInputs {
  return {
    price: form.price || 0,
    downPct: form.downPct || 0,
    ratePct: form.ratePct || 0,
    termYears: form.termYears || 30,
    taxPct: form.taxPct || 0,
    insuranceYr: form.insuranceYr || 0,
    hoaMo: form.hoaMo || 0,
    closingPct: form.closingPct || 0,
    pmiPct: form.pmiPct || 0,
    savings: form.savings || 0,
    dpaTotal: dpaTotalFromPrograms(form.dpaPrograms),
  };
}
