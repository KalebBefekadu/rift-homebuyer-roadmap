/**
 * "My assistance plan" (Blueprint v5 §5.1, D14): what to do about each
 * program that may fit, in order, the documents to gather, and which kind of
 * lender takes part. It asks for details because it is kept and acted on;
 * the matches themselves stay free on /buy/assistance.
 *
 * Built only from each program's own record and the person's answers. It
 * does not decide eligibility: every step that the answers could not settle
 * is written as "Confirm", with who confirms it.
 *
 * Pure: no React, no I/O.
 */

import type { Match, ProgramRecord, Profile } from "./assistance";

export interface ProgramSteps {
  program: ProgramRecord;
  amount: number;
  /** The kind of lender that takes part, in words. */
  lender: string;
  /** In the order they happen. */
  steps: string[];
}

export interface AssistancePlan {
  programs: ProgramSteps[];
  /** Documents to gather, once, whichever programs they pursue. */
  documents: string[];
}

const has = (p: ProgramRecord, re: RegExp) => p.conditions.some((c) => re.test(c));

/** Which lender takes part, and where to find one when the record does not name a list. */
function lenderFor(p: ProgramRecord): { who: string; find: string | null } {
  if (p.sourceType === "bank") return { who: "an FHLBank Atlanta member bank or credit union", find: null };
  const named = p.conditions.find((c) => /participating lender/i.test(c));
  if (named) {
    const who = named.replace(/^Use an? /i, "").split(",")[0];
    return { who: `a ${who.replace(/^a /i, "")}`, find: null };
  }
  if (p.conditions.some((c) => /HUD-certified lender/i.test(c))) return { who: "a HUD-certified lender", find: null };
  return { who: `a lender who works with ${p.administrator}`, find: `Ask ${p.administrator} for its list of lenders.` };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function assistancePlan(matches: Match[], profile: Profile): AssistancePlan {
  const programs: ProgramSteps[] = matches.map((m) => {
    const p = m.program;
    const steps: string[] = [];
    /* What the answers could not settle comes first: no point gathering
       paperwork for a program the home or the job turns out not to fit. */
    for (const c of m.checks.filter((x) => x.state === "check")) {
      steps.push(`Confirm ${c.label.toLowerCase()}: ${c.note}`);
    }
    if (has(p, /education|counsel/i)) {
      const edu = p.conditions.find((c) => /education|counsel/i.test(c))!;
      steps.push(`Book and finish the course (${edu.replace(/\.$/, "")}), and keep the certificate.`);
    }
    const lender = lenderFor(p);
    if (lender.find) steps.push(lender.find);
    steps.push(`Talk to ${lender.who} about using ${p.name} with your loan.`);
    for (const c of p.conditions.filter((x) => !/education|counsel|participating lender|HUD-certified lender|member bank/i.test(x))) {
      steps.push(c.endsWith(".") ? c : `${c}.`);
    }
    /* Programs differ on when to apply (some reserve funds only once there
       is a contract), so the step is the question, not an answer. */
    steps.push("Ask the lender when to apply and how long approval takes, so it fits your closing date.");
    return { program: p, amount: m.amount, lender: cap(lender.who), steps };
  });

  const docs = new Set<string>(["A government photo ID for everyone on the loan"]);
  if (matches.some((m) => m.program.income.kind !== "not-stated")) {
    docs.add("Your last 30 days of pay stubs, and two years of W-2s or tax returns, for everyone in the household with income");
  }
  if (matches.some((m) => m.program.firstTime === "required")) {
    docs.add("Anything that shows where you have lived for the last three years, such as leases");
  }
  if (matches.some((m) => has(m.program, /own money/i))) {
    docs.add("Two months of bank statements, to show the money you are putting in");
  }
  if (matches.some((m) => has(m.program, /education|counsel/i))) docs.add("Your homebuyer education certificate, once you have it");
  if (matches.some((m) => m.program.onlyFor || m.program.amount.occupations) && profile.occupation && profile.occupation !== "other") {
    docs.add(profile.occupation === "military"
      ? "Proof of service, such as a DD-214 or a statement of service"
      : "A letter or recent pay stub from your employer showing your role");
  }
  docs.add("A pre-approval letter from the lender, once you have one");

  return { programs, documents: [...docs] };
}
