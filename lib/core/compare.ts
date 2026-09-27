/**
 * Homes side by side (SEARCH-05, Blueprint v5 §7): the same fields for every
 * home, unknowns said as unknown, a monthly scenario and the cash each would
 * take on the buyer's own terms, and each home against their requirements.
 *
 * Only the facts typed for the home and the buyer's own plan are used: never
 * the agent's notes, showing instructions or access codes, which a home
 * record does not carry to here. Money rows appear only for someone allowed
 * to see price and fees.
 *
 * A monthly figure is a scenario, not a quote: the rate is the week's
 * assumption, tax and insurance are Georgia planning figures, and an HOA nobody
 * recorded is left out and said to be left out. Nothing here ranks the homes
 * or totals a score.
 *
 * Pure: no I/O.
 */

import { cashToClose, money, monthlyCost, type BuyerInputs } from "./compute";
import { describe, fitOf, FIELDS, type Fit, type PropertyFacts, type SearchCriterion } from "./search";

/** More than this and the columns stop being readable on a laptop. */
export const MAX_COMPARED = 4;

export interface CompareHome { id: string; address: string; facts: PropertyFacts }

export interface Cell { text: string; unknown?: boolean; fit?: Fit }
export interface Row { label: string; cells: Cell[]; group: "money" | "facts" | "fit"; note?: string }

const UNKNOWN: Cell = { text: "Not known", unknown: true };
const cell = <T,>(v: T | null, show: (x: T) => string): Cell => (v === null ? UNKNOWN : { text: show(v) });

const TYPE_LABEL: Record<string, string> = { "single-family": "Single-family", townhouse: "Townhouse", condo: "Condo", "multi-family": "Multi-family", land: "Land" };

export function compareHomes(homes: CompareHome[], criteria: SearchCriterion[], plan: { inputs: BuyerInputs; savingsKnown: boolean } | null): Row[] {
  const list = homes.slice(0, MAX_COMPARED);
  const rows: Row[] = [];

  if (plan) {
    const priced = list.map((h) => (h.facts.price === null ? null : { ...plan.inputs, price: h.facts.price, hoaMo: h.facts.hoaMonthly ?? 0 }));
    rows.push({ label: "Price", group: "money", cells: list.map((h) => cell(h.facts.price, money)) });
    rows.push({
      label: "Monthly, as a scenario", group: "money",
      note: `At ${plan.inputs.ratePct.toFixed(2)}% with ${plan.inputs.downPct}% down, Georgia planning figures for tax and insurance. A lender's estimate is the authority.`,
      cells: priced.map((i, n) => {
        if (!i) return UNKNOWN;
        const m = monthlyCost(i);
        return { text: `${money(m.total)}${list[n]!.facts.hoaMonthly === null ? " (HOA not known, not included)" : ""}` };
      }),
    });
    rows.push({
      label: "Of which mortgage insurance", group: "money",
      cells: priced.map((i) => (i ? { text: money(monthlyCost(i).pmi) } : UNKNOWN)),
    });
    rows.push({
      label: "Cash to buy it", group: "money",
      note: "Before closing and at the table together; earnest money counted once.",
      cells: priced.map((i) => (i ? { text: money(cashToClose(i).total) } : UNKNOWN)),
    });
    if (plan.savingsKnown) {
      rows.push({
        label: "Against your savings", group: "money",
        cells: priced.map((i) => {
          if (!i) return UNKNOWN;
          const left = plan.inputs.savings - cashToClose(i).total;
          return { text: left >= 0 ? `${money(left)} left` : `${money(-left)} short` };
        }),
      });
    }
  }

  rows.push({ label: "Bedrooms", group: "facts", cells: list.map((h) => cell(h.facts.bedrooms, String)) });
  rows.push({ label: "Bathrooms", group: "facts", cells: list.map((h) => cell(h.facts.bathrooms, String)) });
  rows.push({ label: "Type", group: "facts", cells: list.map((h) => cell(h.facts.propertyType, (t) => TYPE_LABEL[t] ?? t)) });
  rows.push({ label: "City", group: "facts", cells: list.map((h) => cell(h.facts.city, String)) });
  rows.push({ label: "Lot", group: "facts", cells: list.map((h) => cell(h.facts.lotAcres, (a) => `${a} acres`)) });
  rows.push({ label: "HOA", group: "facts", cells: list.map((h) => cell(h.facts.hoaMonthly, (x) => (x === 0 ? "None" : `${money(x)} a month`))) });
  rows.push({ label: "Basement", group: "facts", cells: list.map((h) => cell(h.facts.basement, (b) => (b === "yes" ? "Yes" : "No"))) });
  rows.push({ label: "Garage", group: "facts", cells: list.map((h) => cell(h.facts.garageSpaces, (g) => `${g} space${g === 1 ? "" : "s"}`)) });

  /* Each requirement as its own row, with the same words as the home card. */
  const fits = list.map((h) => fitOf(h.facts, criteria));
  /* Without price and fees, a price requirement is left out entirely: even
     "misses" would say something about the budget. */
  for (const c of criteria.filter((x) => x.strength === "hard" && (plan !== null || !FIELDS[x.field].money))) {
    rows.push({
      label: FIELDS[c.field].label, group: "fit",
      cells: fits.map((f) => {
        const line = f.lines.find((l) => l.criterionId === c.id);
        const fit = line?.fit ?? "unknown";
        return { text: fit === "meets" ? "✓ Meets" : fit === "misses" ? "✕ Misses" : fit === "manual" ? "Check by hand" : "Not known", fit, unknown: fit === "unknown" };
      }),
      /* A price limit is money: said only to someone who may see it. */
      note: `Must have: ${describe(c, plan !== null)}`,
    });
  }
  return rows;
}

