/**
 * The move-in handoff (Blueprint v5 §7.2, journey contract B19). Pure.
 *
 * The practical list for the first weeks in a home, added to the client's
 * plan in one go after a confirmed closing, then edited like any other step.
 * Every step has an owner (lib/core/plan.ts) and NO date: B19 requires tax
 * and homestead dates to come from maintained official sources for the
 * actual county, and there is no such source in Rift yet. So the homestead
 * step names who holds the date instead of guessing it; the agent adds the
 * date once he has checked it.
 */

import type { Owner } from "./plan";

export interface MoveInStep { title: string; owner: Owner; ownerName: string | null }

export function moveInSteps(county: string | null): MoveInStep[] {
  const commissioner = county ? `${county} County tax commissioner` : "Your county tax commissioner";
  return [
    { title: "Put power, water, gas and internet in your name from closing day", owner: "client", ownerName: null },
    { title: "Change the locks, and the garage and alarm codes, once the keys are yours", owner: "client", ownerName: null },
    { title: "Send USPS your change of address, and update your Georgia driver's licence", owner: "client", ownerName: null },
    { title: "Hand over the closing papers and any warranties for your records", owner: "agent", ownerName: null },
    { title: "File for the homestead exemption: the tax commissioner has the form and the deadline", owner: "other", ownerName: commissioner },
    { title: "If there is an HOA, check they have you as the owner and how dues are paid", owner: "client", ownerName: null },
  ];
}

/** Steps not already on the plan, by title, so pressing twice adds nothing. */
export const missingSteps = (steps: MoveInStep[], existingTitles: string[]) => {
  const have = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return steps.filter((s) => !have.has(s.title.toLowerCase()));
};
