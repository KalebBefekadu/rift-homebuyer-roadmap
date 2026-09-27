/**
 * Who a program alert is for (Blueprint v5 §5.1, D14): somebody who asked,
 * whose saved answers leave the program as a potential match. One rule for
 * the Programs page that lists them and the outbox drafts written to them.
 *
 * Pure: no I/O.
 */

import { checkProgram, type Occupation, type ProgramRecord } from "./assistance";
import { firstTimeFrom, type Ownership } from "./funnel";
import type { SavedPlan } from "./saved-plan";

export function mayFit(p: ProgramRecord, plan: SavedPlan): boolean {
  const a = plan.answers;
  if (typeof a.county !== "string" || typeof a.price !== "number") return false;
  return checkProgram(p, {
    county: a.county,
    firstTime: typeof a.ownership === "string" ? firstTimeFrom(a.ownership as Ownership) : null,
    price: a.price,
    income: typeof a.income === "number" ? a.income : undefined,
    household: a.household !== undefined ? Number(a.household) : undefined,
    occupation: typeof a.occupation === "string" ? (a.occupation as Occupation | "other") : undefined,
  }).potential;
}
