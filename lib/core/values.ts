/**
 * The values: small tools that each answer one question (Blueprint v5 §5.1).
 *
 * The lead side used to be one long questionnaire producing one crowded
 * readout with several answers mixed together (Kaleb, R2: "very complicated
 * and confusing"). Each value is now its own component with its own few
 * questions, its own answer and its own artifact. Finishing one shows only
 * that answer, then offers the next, reusing everything already answered.
 *
 * The order is decision D20 (24 Sep 2026). The catalogue is the single list
 * every surface reads: the landings, the header, the footer and the "You can
 * also get" block, so a value is added or reordered in one place.
 *
 * Pure: no React, no I/O (lib/core/layers.test.ts).
 */

export type ValueSide = "buy" | "sell" | "abroad";

/** Every answer a value can ask for. One shared vocabulary, so an answer
 *  given to one value is never asked again by the next. */
export type InputKey =
  | "county" | "ownership" | "price" | "downPct" | "savings" | "monthlySaving"
  | "income" | "household" | "credit" | "occupation" | "loanType"
  | "payoff" | "commission" | "yearsOwned" | "homestead" | "age65"
  | "interior" | "kitchen" | "systems" | "debts"
  | "status" | "use";

export interface ValueDef {
  id: string;
  side: ValueSide;
  /** Address of the value's page. */
  href: string;
  /** Short name, for menus and the footer. */
  name: string;
  /** The question the person has, in their words. */
  question: string;
  /** One line on what they get back. */
  gives: string;
  /** The call to action that starts it: a verb about their outcome (§4.4). */
  cta: string;
  /** What it asks, in order. Answers already given are skipped. */
  asks: InputKey[];
  /** False until the page exists. A value that is not built is never linked. */
  live: boolean;
  /** False for a value offered only after another answer, not as a way in. */
  landing?: boolean;
}

export const VALUES: ValueDef[] = [
  /* Buyer, D20: assistance, cash to close, monthly cost, timeline. */
  {
    id: "assistance", side: "buy", href: "/buy/assistance", name: "Assistance",
    question: "What Georgia programs might help me buy?",
    gives: "The programs that may fit you, what each one checks, and the most they could add up to.",
    cta: "Check my programs",
    asks: ["county", "ownership", "price"],
    live: true,
  },
  {
    id: "cash", side: "buy", href: "/buy/cash-to-close", name: "Cash to close",
    question: "How much cash do I really need?",
    gives: "Every line you pay before you get the keys, not just the down payment.",
    cta: "See my cash to close",
    asks: ["price", "downPct", "county"],
    live: true,
  },
  {
    id: "monthly", side: "buy", href: "/buy/monthly-cost", name: "Monthly cost",
    question: "What would I pay each month?",
    gives: "Your all-in monthly payment, and how it moves across three prices.",
    cta: "See my monthly cost",
    asks: ["price", "downPct", "county"],
    live: true,
  },
  {
    id: "timeline", side: "buy", href: "/buy/timeline", name: "Timeline",
    question: "When could I buy?",
    gives: "How many months until you are ready, and the two changes that shorten it most.",
    cta: "See when I could buy",
    asks: ["price", "downPct", "savings", "monthlySaving"],
    live: true,
  },

  /* MONEY-05: its own tested model (lib/core/afford.ts), a planning
     scenario with its disclosures. Not a way in on the landing (see below). */
  {
    id: "afford", side: "buy", href: "/buy/afford", name: "How much home fits",
    question: "How much home fits my budget?",
    gives: "A comfortable price and a stretch price, from your income and debts, as a planning range.",
    cta: "See what fits me",
    asks: ["income", "debts", "downPct"],
    live: true,
    landing: false,
  },
  /* Not one of D20's first four, so not a way in on the landing, where four
     cards keep the grid whole (§4.1). Offered after an answer, where it
     usually needs no more questions, and listed in the footer. */
  {
    id: "lender", side: "buy", href: "/buy/lender-questions", name: "Lender questions",
    question: "What should I ask a lender?",
    gives: "The questions to ask, written for your down payment, credit and first-time status.",
    cta: "See my lender questions",
    asks: ["downPct", "credit", "ownership"],
    live: true,
    landing: false,
  },

  /* Seller, D20: net proceeds, unclaimed money, selling costs, preparation. */
  {
    id: "proceeds", side: "sell", href: "/sell/proceeds", name: "What you'd keep",
    question: "What would I actually keep?",
    gives: "What reaches you after the loan payoff and every cost of selling.",
    cta: "See what I'd keep",
    /* No county: nothing in a seller's costs changes by county yet (transfer
       tax is statewide, prorated tax is one estimate), and a question whose
       answer changes nothing is a question we should not ask. */
    asks: ["price", "payoff", "commission"],
    live: true,
  },
  {
    id: "unclaimed", side: "sell", href: "/sell/unclaimed", name: "Money you may be losing",
    question: "Am I losing money on my home already?",
    gives: "Exemptions you may not have filed, and the appeal deadlines that apply.",
    cta: "Check what I may be missing",
    /* No county: nothing in unclaimedValue varies by county. */
    asks: ["price", "yearsOwned", "homestead", "age65"],
    live: true,
  },
  {
    id: "costs", side: "sell", href: "/sell/costs", name: "Selling costs",
    question: "What will selling cost me?",
    gives: "Each cost of selling, line by line, with commission as your own number.",
    cta: "See my selling costs",
    asks: ["price", "commission"],
    live: true,
  },
  {
    id: "prepare", side: "sell", href: "/sell/prepare", name: "Should I fix it first",
    question: "Should I fix things before I list?",
    gives: "What is worth addressing, what maybe, and what not yet.",
    cta: "See what to fix first",
    asks: ["price", "interior", "kitchen", "systems"],
    live: true,
  },

  /* Abroad, D20: can I buy, what it costs, the return. */
  {
    id: "eligibility", side: "abroad", href: "/abroad/can-i-buy", name: "Can I buy in the US",
    question: "Can I buy a home in the United States from where I live?",
    gives: "What your residency status means for owning, financing and closing.",
    cta: "Check if I can buy",
    /* Use too: the smallest down payment a lender takes depends on whether
       the home is lived in or rented out. */
    asks: ["status", "use"],
    live: true,
  },
  {
    id: "abroad-cost", side: "abroad", href: "/abroad/cost", name: "Cost to buy and own",
    question: "What would buying and owning cost me?",
    gives: "The cash you would send, and what owning costs each year.",
    cta: "See what it would cost",
    asks: ["status", "use", "price"],
    live: true,
  },
  {
    id: "abroad-return", side: "abroad", href: "/abroad/return", name: "The return",
    question: "What would it earn if I rented it out?",
    gives: "Rent, costs and what is left, marked as an estimate.",
    cta: "See the return",
    /* No "use": a return only exists if it is rented. County, because the
       rent estimate is set county by county. */
    asks: ["status", "price", "county"],
    live: true,
  },
];

export const valuesFor = (side: ValueSide) => VALUES.filter((v) => v.side === side && v.live);

/** The values offered as ways in on a landing (§5.1). */
export const waysIn = (side: ValueSide) => valuesFor(side).filter((v) => v.landing !== false);

export const valueById = (id: string) => VALUES.find((v) => v.id === id);

/**
 * What to offer after a value: the others on the same side, in D20 order,
 * cheapest to answer first given what the person has already told us. A value
 * that needs one more question beats one that needs three (§5.1: "often just
 * one more question").
 */
export function nextValues(current: string, answered: ReadonlySet<InputKey>, limit = 3): { value: ValueDef; missing: number }[] {
  const here = valueById(current);
  if (!here) return [];
  return valuesFor(here.side)
    .filter((v) => v.id !== current)
    .map((v, order) => ({ value: v, missing: v.asks.filter((k) => !answered.has(k)).length, order }))
    .sort((a, b) => a.missing - b.missing || a.order - b.order)
    .slice(0, limit)
    .map(({ value, missing }) => ({ value, missing }));
}

/** "One more question", "Two more questions", "Nothing more to answer". */
export function missingPhrase(n: number): string {
  if (n <= 0) return "Nothing more to answer";
  const words = ["", "One", "Two", "Three", "Four", "Five"];
  return `${words[n] ?? String(n)} more question${n === 1 ? "" : "s"}`;
}
