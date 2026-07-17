export interface SeedDpaProgram {
  id: string;
  name: string;
  amount: number;
  type: "grant" | "forgivable" | "deferred" | "second-lien";
  county: string | null;
  notes: string;
  active: boolean;
}

/** Georgia / metro Atlanta starter list — verify amounts before intake. */
export const SEED_DPA_PROGRAMS: SeedDpaProgram[] = [
  {
    id: "ga-dream",
    name: "Georgia Dream",
    amount: 10000,
    type: "forgivable",
    county: null,
    notes: "Statewide first-time buyer assistance (confirm current amount & eligibility)",
    active: true,
  },
  {
    id: "atlanta-hfa",
    name: "Atlanta Housing Opportunity Bond / City DPA",
    amount: 20000,
    type: "forgivable",
    county: "Fulton",
    notes: "City of Atlanta programs — amount varies by income band",
    active: true,
  },
  {
    id: "dekalb-dpa",
    name: "DeKalb County Homebuyer Assistance",
    amount: 10000,
    type: "forgivable",
    county: "DeKalb",
    notes: "Confirm current DeKalb allocation and income limits",
    active: true,
  },
  {
    id: "gwinnett-dpa",
    name: "Gwinnett County Homebuyer Program",
    amount: 10000,
    type: "forgivable",
    county: "Gwinnett",
    notes: "Confirm current Gwinnett terms",
    active: true,
  },
  {
    id: "cobb-dpa",
    name: "Cobb County Down Payment Assistance",
    amount: 10000,
    type: "forgivable",
    county: "Cobb",
    notes: "Confirm current Cobb terms",
    active: true,
  },
  {
    id: "fhlb-atlanta",
    name: "FHLB Atlanta Affordable Housing Program",
    amount: 15000,
    type: "grant",
    county: null,
    notes: "Via participating lenders — amount and availability vary",
    active: true,
  },
  {
    id: "chfa-style",
    name: "Employer / Nonprofit Gift Funds",
    amount: 5000,
    type: "grant",
    county: null,
    notes: "Placeholder for gift letters and community partners",
    active: true,
  },
];
