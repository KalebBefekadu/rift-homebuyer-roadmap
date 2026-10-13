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
 * No figure: the amount is on their Money tab, computed like every other
 * figure (rule 1). Where an item states a rule or a warning, it names the
 * official page it came from and the day it was checked, as
 * lib/core/movein.ts does. The CFPB pages could not be opened from the build
 * environment on CLOSING_WEEK_CHECKED; their content was read through a web
 * search of consumerfinance.gov that day, so Kaleb reads them once more
 * before the first real closing (docs/handoff.md §8.3).
 *
 * Pure: no I/O.
 */

import type { Side } from "./journey";
import type { Stage } from "./progress";

export interface ClosingWeekItem { id: string; title: string; body: string; source?: { name: string; url: string } }

export const CLOSING_WEEK_CHECKED = "2026-10-13";

const SCAMS = { name: "CFPB, mortgage closing scams", url: "https://www.consumerfinance.gov/archive/blog/mortgage-closing-scams-how-protect-yourself-and-your-closing-funds/" };
const DISCLOSURE = { name: "CFPB, what is a Closing Disclosure", url: "https://www.consumerfinance.gov/ask-cfpb/what-is-a-closing-disclosure-en-1983/" };

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
      ? `Save the closing attorney's and ${a}'s phone numbers now, from somewhere other than an email. Before you send anything, call the attorney's office on the number you saved and confirm the wiring instructions. Never use a number, a link or new instructions from an email or a text, even one that looks like it came from them or from ${a}: a last-minute change is the warning sign. If money goes somewhere it should not have, call your bank straight away and ask for a wire recall, then report it at ic3.gov.`
      : `If your proceeds will be wired, give your account details to the closing attorney's office by phone or in person, at a number you already have. Never send them in reply to an email or a text, even one that looks like it came from them or from ${a}.`,
    source: SCAMS,
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
    { id: "disclosure", title: "Read your Closing Disclosure", body: `Your lender must give it to you at least three business days before closing. Compare it with the Loan Estimate you were given, and ask ${a} or your lender about anything that changed. A cash purchase has a settlement statement from the closing attorney instead.`, source: DISCLOSURE },
    { id: "funds", title: "Know how much to bring, and how", body: `The amount is on your Money tab and on the attorney's final figures, which win if the two differ. Most closings want a wire or a cashier's check, not a personal check; ask the attorney's office which.` },
    id,
    { id: "walkthrough", title: "Do the final walkthrough", body: `A last look at the house before signing, usually within a day of closing, to check it is as agreed. ${a} will set the time with you.` },
  ];
}
