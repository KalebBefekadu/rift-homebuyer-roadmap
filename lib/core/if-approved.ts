/**
 * "If approved": what a matched program would do to the cash and the months,
 * shown below an answer and never in it (V3, Kaleb 13 Oct 2026).
 *
 * Rule 3 stands: every headline is computed with assistance at zero. This
 * is the one place an unapproved amount is applied, and only to produce a
 * second, labelled figure under the first. It uses the single largest
 * program the answers place them in (`best`), never a combination: two
 * programs both allowing stacking is a reason to ask a lender, not a number
 * to add up on their behalf.
 *
 * Pure: no I/O. It copies the inputs and never changes the ones passed in.
 */

import { cashGap, cashToClose, type BuyerInputs } from "./compute";
import type { AssistanceResult } from "./assistance";

export function ifApproved(inputs: BuyerInputs, r: AssistanceResult) {
  const best = r.best;
  if (!best || !(best.amount > 0)) return null;
  const base = { ...inputs, assistance: 0 };
  const withIt = { ...base, assistance: best.amount };
  return {
    program: best.program.name,
    administrator: best.program.administrator,
    amount: best.amount,
    /** Cash to close less the program's amount, never below zero. */
    cash: Math.max(cashToClose(base).total - best.amount, 0),
    months: cashGap(withIt).fullyCovered ? 0 : cashGap(withIt).monthsToClose,
    monthsWithout: cashGap(base).fullyCovered ? 0 : cashGap(base).monthsToClose,
  };
}
