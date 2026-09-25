/**
 * Value: what should I ask a lender? (Blueprint v5 §5.2). Pure.
 *
 * Questions written for the person's own situation, from answers they have
 * already given. No answer is supplied: a lender's rate, fees and approval
 * are the lender's to state, and this page's job is to make sure they are
 * asked, in writing, before anything is signed. Nothing here is a figure.
 */

import type { Answers } from "./asks";

export interface LenderQuestion { q: string; why: string }

export function lenderQuestions(a: Answers): LenderQuestion[] {
  const down = Number(a.downPct);
  const credit = Number(a.credit);
  const firstTime = a.ownership === "none" || a.ownership === "investment";
  const out: LenderQuestion[] = [
    { q: "What is my rate today with my credit, and what would it cost to lock it, for how long?", why: "A quoted rate is not a locked rate. The lock decides what you actually pay." },
    { q: "What is the total cash I bring to closing on your worksheet, every line, not only the down payment?", why: "The down payment is usually well under the full amount." },
    { q: "Can I have your fee sheet, line by line, and your Loan Estimate as soon as I apply?", why: "Lenders must give a Loan Estimate within three business days of an application. Compare them line by line." },
  ];

  if (down === 3.5) {
    out.push({ q: "On FHA, what is the mortgage insurance, up front and monthly, and does it ever come off for me?", why: "With less than 10% down, FHA mortgage insurance usually stays for the life of the loan." });
  } else if (down === 3 || down === 5 || down === 10) {
    out.push({ q: `With ${down}% down on a conventional loan, what is my private mortgage insurance, and when can it be removed?`, why: "Conventional mortgage insurance can come off as you build equity; ask how and when." });
  } else if (down >= 20) {
    out.push({ q: "With 20% down, am I free of mortgage insurance, and is there anything I lose by putting that much in?", why: "Keeping some cash back for repairs and reserves is often worth weighing." });
  }
  if (down > 0 && down <= 3) {
    out.push({ q: "Do I qualify for a 3% down conventional program, and what are its income limits?", why: "Some 3% down programs have income limits and require homebuyer education." });
  }

  if (credit > 0 && credit < 620) {
    out.push({ q: "Is my credit score above your minimum for this loan, and what would it take to get me to the next pricing tier?", why: "Many lenders set minimums above the loan program's own, and small score changes can move the price." });
  } else if (credit === 0) {
    out.push({ q: "Can you tell me which credit tier I am in before a full application, and does checking it affect my score?", why: "Knowing the tier early tells you whether to fix anything before you apply." });
  }

  if (firstTime) {
    out.push({ q: "Are you an approved lender for Georgia down payment assistance programs, and have you closed one this year?", why: "Assistance only works through participating lenders, and experience with the program decides how long it takes." });
    out.push({ q: "If I use assistance, how does it change my closing date and my cash to close?", why: "Assistance approval can add time; ask before you agree a closing date with a seller." });
  }

  out.push(
    { q: "How much can a seller contribute toward my closing costs on this loan?", why: "Each loan type caps seller contributions; above the cap the money cannot be used." },
    { q: "Which documents do you need from me, and how long does each stay valid?", why: "Pay stubs and bank statements expire; knowing when saves a scramble near closing." },
    { q: "What could change my approval between now and closing?", why: "New debt, a job change or large unexplained deposits are the usual reasons. Ask what to avoid." },
  );
  return out;
}
