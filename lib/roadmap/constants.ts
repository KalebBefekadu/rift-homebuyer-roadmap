export const FEATURE_OPTIONS = [
  "Garage",
  "Fenced yard",
  "Basement",
  "Sunroom",
  "Primary suite",
  "Updated kitchen",
  "Home office",
  "Move-in ready",
] as const;

export const TIMELINE_OPTIONS = [
  "0 to 3 months",
  "3 to 6 months",
  "6 to 9 months",
  "9 to 12 months",
  "12 to 18 months",
  "18 to 24 months",
  "24+ months",
] as const;

export const HOME_TYPE_OPTIONS = [
  "Single-family home",
  "Townhome",
  "Condominium",
  "Duplex / multi-family",
  "Manufactured home",
  "New construction",
] as const;

export const GA_COUNTIES = [
  "Statewide",
  "DeKalb",
  "Fulton",
  "Gwinnett",
  "Cobb",
  "Clayton",
  "Henry",
  "Rockdale",
  "Fayette",
  "Douglas",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  roadmap_done: "Roadmap Done",
  working_gap: "Working the Gap",
  mortgage_ready: "Mortgage Ready",
  shopping: "Actively Shopping",
  closed: "Closed",
  nurture: "Long Nurture",
};

export const BUCKET_LABELS: Record<string, string> = {
  "0-3": "0–3 months",
  "3-9": "3–9 months",
  "9+": "9+ months",
};

import type { AgentBranding, CalcDefaults, RoadmapFormState } from "./types";

export const DEFAULT_BRANDING: AgentBranding = {
  displayName: "Kaleb",
  brandName: "Rift",
  roleLine: "Real Estate Agent, Keller Williams Metro Atlanta",
  phone: "(404) 000-0000",
  email: "you@rift.build",
  markLetter: "R",
  brandColor: "#1F3D2B",
  accentColor: "#B8862F",
};

export const DEFAULT_CALC: CalcDefaults = {
  defaultRate: 6.5,
  defaultTaxPct: 1.0,
  defaultInsuranceYr: 1400,
  defaultClosingPct: 3,
  defaultPmiPct: 0.6,
};

export function emptyForm(defaults: CalcDefaults = DEFAULT_CALC): RoadmapFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preparedDate: new Date().toISOString().slice(0, 10),
    timeToBuy: "3-9",
    timeline: "",
    homeType: "",
    beds: "",
    baths: "",
    areas: "",
    features: [],
    featuresOther: "",
    price: 0,
    downPct: 3.5,
    ratePct: defaults.defaultRate,
    termYears: 30,
    taxPct: defaults.defaultTaxPct,
    insuranceYr: defaults.defaultInsuranceYr,
    hoaMo: 0,
    closingPct: defaults.defaultClosingPct,
    pmiPct: defaults.defaultPmiPct,
    savings: 0,
    creditNow: "",
    creditGoal: "",
    creditWhen: "",
    incomeNotes: "",
    dpaPrograms: [{ name: "", amount: 0, note: "" }],
    moves: [{ text: "", dueBy: "" }],
    personalNote: "",
    county: "DeKalb",
  };
}
