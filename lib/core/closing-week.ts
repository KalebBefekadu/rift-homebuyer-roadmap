/**
 * The week before closing, on the client's Today (audit portals-2026-10,
 * item 5).
 *
 * Two days from closing, the portal told a cash buyer "Nothing is waiting on
 * you right now", which is when the questions arrive by text: what do I
 * bring, how do I send the money, what is this document. The answers are the
 * same for everybody, so they are written once, here.
 *
 * The wire warning leads. Closing funds sent to instructions from a forged
 * email are the one mistake in this process nobody can undo.
 *
 * Practical steps only, with no figure, no day count and no rule stated as
 * law: the amount is on their Money tab, computed like every other figure
 * (rule 1), and the statutory timings belong with a source checked on a date,
 * as lib/core/movein.ts does. These were written while the official pages
 * could not be read from here (docs/handoff.md §8), so none is claimed.
 *
 * Pure: no I/O.
 */

import type { Side } from "./journey";
import type { Stage } from "./progress";

export interface ClosingWeekItem { id: string; title: string; body: string }

/** How many days ahead of the closing date the list appears. */
export const CLOSING_WEEK_DAYS = 7;

export function closingWeek(input: { side: Side; stage: Stage; closingInDays: number | null; agentFirst: string }): ClosingWeekItem[] {
  const a = input.agentFirst;
  const near = input.closingInDays !== null && input.closingInDays >= 0 && input.closingInDays <= CLOSING_WEEK_DAYS;
  const open = input.stage === "under-contract" || input.stage === "close";
  if (!open || (input.stage !== "close" && !near)) return [];
  if (input.closingInDays !== null && input.closingInDays < 0) return [];

  const wire: ClosingWeekItem = {
    id: "wire",
    title: input.side === "buy" ? "Before you send any money, call to confirm" : "Confirm where your proceeds go, by phone",
    body: input.side === "buy"
      ? `Call the closing attorney's office at a number you already have, or one ${a} gives you, and confirm the wiring instructions before you send anything. Never use a number, a link or new instructions from an email or a text, even one that looks like it came from them or from ${a}. Instructions do not change at the last minute; a message saying they did is the warning sign.`
      : `If your proceeds will be wired, give your account details to the closing attorney's office by phone or in person, at a number you already have. Never send them in reply to an email or a text, even one that looks like it came from them or from ${a}.`,
  };
  const id: ClosingWeekItem = {
    id: "id",
    title: "Bring a photo ID",
    body: "A current government photo ID for everyone signing. The closing attorney's office will say if they need anything else.",
  };
  if (input.side === "sell") {
    return [
      wire,
      id,
      { id: "keys", title: "Gather keys, codes and manuals", body: `Every key, garage remote and code, and the manuals and warranties for what stays with the house. Hand them to ${a} or leave them where you agree.` },
      { id: "utilities", title: "Set the utilities to end on the right day", body: "Power, gas, water and internet in your name end the day the buyers take possession, not before: the final walkthrough needs them on." },
    ];
  }
  return [
    wire,
    { id: "disclosure", title: "Read your Closing Disclosure", body: `Your lender sends it before closing. Compare it with the Loan Estimate you were given, and ask ${a} or your lender about anything that changed. A cash purchase has a settlement statement from the closing attorney instead.` },
    { id: "funds", title: "Know how much to bring, and how", body: `The amount is on your Money tab and on the attorney's final figures, which win if the two differ. Most closings want a wire or a cashier's check, not a personal check; ask the attorney's office which.` },
    id,
    { id: "walkthrough", title: "Do the final walkthrough", body: `A last look at the house before signing, usually within a day of closing, to check it is as agreed. ${a} will set the time with you.` },
  ];
}
