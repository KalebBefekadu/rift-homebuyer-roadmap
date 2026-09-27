/**
 * What to ask a lender (Blueprint v5 §5.2): questions written for the
 * person's own situation, from answers they already gave. It produces no
 * figure; every question is one a lender answers.
 *
 * Carried from the retired readout's question sheet (lib/core/results.ts),
 * which asked the same eight questions of everybody plus three about
 * programs. Here each question is included because an answer makes it
 * relevant, and says why.
 *
 * Pure: no I/O.
 */

import type { Match } from "./assistance";
import { money } from "./compute";

export interface Question { q: string; why: string }
export interface QuestionGroup { title: string; questions: Question[] }

export interface LenderContext {
  price: number;
  downPct: number;
  firstTime: boolean | null;
  /** Potential assistance matches, when the person has checked programs. */
  matches: Match[];
  /** The one combination both programs' rules allow, if any. */
  combination: [Match, Match] | null;
}

export function lenderQuestions(c: LenderContext): QuestionGroup[] {
  const groups: QuestionGroup[] = [];

  groups.push({
    title: "Your rate and what it costs",
    questions: [
      { q: `What rate would you quote me today on a ${money(c.price)} home with ${c.downPct}% down, and what would locking it cost?`, why: "Rates are quoted for a profile and a day; a lock is what makes one real." },
      { q: "Can I see your fee sheet, line by line, and what each fee pays for?", why: "Fees differ from lender to lender, and the fee sheet is where to compare them." },
      ...(c.downPct < 20 ? [{ q: `What is your mortgage insurance estimate at ${c.downPct}% down, and exactly when does it come off?`, why: "Below 20% down it is part of every payment until it is removed." }] : []),
    ],
  });

  groups.push({
    title: "The cash you bring",
    questions: [
      { q: "What is the total cash I bring to closing on your worksheet, every line, not only the down payment?", why: "The down payment is only part of it; the rest is closing costs and prepaid taxes and insurance." },
      { q: "How much can a seller contribute toward my closing costs on this loan?", why: "The limit depends on the loan type and the down payment." },
    ],
  });

  if (c.matches.length) {
    const names = c.matches.slice(0, 3).map((m) => m.program.name);
    groups.push({
      title: "The programs you may fit",
      questions: [
        ...names.map((n) => ({ q: `Are you approved to lend with ${n}, and have you closed one in the last year?`, why: "Not every lender takes part in every program, and experience with one decides how smoothly it goes." })),
        ...(c.combination ? [{ q: `Can ${c.combination[0].program.name} and ${c.combination[1].program.name} be used together on my loan?`, why: "Both programs' rules allow combining; the lender confirms it works on your file." }] : []),
        { q: "How long does the program's approval take, and what happens to my closing date if it runs late?", why: "Assistance approval is a separate step with its own timeline." },
        { q: "Will you confirm my program eligibility in writing before I make an offer?", why: "A verbal yes is not a confirmation." },
      ],
    });
  }

  groups.push({
    title: "Timing and risk",
    questions: [
      ...(c.firstTime === true ? [{ q: "Which first-time buyer loans do you offer, and which would you choose for me and why?", why: "First-time status opens loans and programs that others cannot use." }] : []),
      { q: "Which documents do you need from me, and how long does each stay valid?", why: "Pay stubs and bank statements expire during a long search." },
      { q: "What could change my approval between now and closing?", why: "New debt, a job change or a large deposit can all reopen the file." },
    ],
  });

  return groups;
}
