/**
 * Rift prototype — the readout.
 *
 * This is the payoff the front end promises. Everything here is DERIVED from
 * answers the person already gave (docs/product.md rule #8, "Front-end value
 * is computed, not generated"). No model, no copywriter, no per-visitor cost.
 *
 * The readout has a fixed shape on purpose. A person who finishes the
 * assessment should always get: a verdict in one sentence, the single thing
 * standing in their way, what to do next in order, and a question sheet they
 * can carry to anyone — including a lender or agent we have never met.
 */

import {
  cashGap, cashToClose, gapLevers, money, netProceeds, range,
  type BuyerInputs, type SellerInputs,
} from "./compute";
import type { MatchResult } from "./registry";

export type Status = "ready" | "close" | "building" | "exploring";

export interface Blocker {
  title: string;
  body: string;
  /** Who actually resolves it. Never us, unless it really is us. */
  who: string;
}

export interface Step {
  label: string;
  detail: string;
  owner: "You" | "Kaleb" | "Your lender" | "Your county";
  when: string;
}

export interface Readout {
  status: Status;
  statusLabel: string;
  /** One sentence. The thing they would repeat to their partner tonight. */
  verdict: string;
  /** The qualifier. Kept out of the headline so the headline stays readable
      on a phone, where a three-clause sentence becomes a ten-line wall. */
  rider?: string;
  /** The number that changes how they think, and why it isn't the one they were told. */
  reframe: { headline: string; body: string };
  blocker: Blocker;
  steps: Step[];
  questions: string[];
  /** Set only when what they SAID collides with what the arithmetic says. */
  tension?: Tension;
}

/**
 * The collision between a stated intention and a computed timeline.
 *
 * This was the most valuable thing the assessment collected and then threw
 * away: `timing` was asked, was the strongest single signal in the lead score,
 * was passed into this function — and was never read. Somebody could answer
 * "in the next 3 months", be told they are 27 months from closing on savings
 * alone, and never see the two figures put next to each other.
 *
 * That juxtaposition is the entire conversation worth having with that person.
 * Leaving it to them to notice is the polite version of hiding it.
 */
export interface Tension {
  kind: "behind" | "ahead";
  /** The collision, stated in one line. */
  headline: string;
  /** What to do about it, given their actual numbers. */
  body: string;
}

const STATUS_LABEL: Record<Status, string> = {
  ready: "Ready now",
  close: "Close",
  building: "Building",
  exploring: "Early",
};

/* ------------------------------------------------------------------ *
 * Buyer
 * ------------------------------------------------------------------ */

/**
 * Stated timing as a number of months, or null when they did not commit to one.
 *
 * The upper bound of each band, deliberately. Somebody who says "3 to 9 months"
 * and is 10 months out is not in trouble; somebody who says it and is 27 months
 * out is. Using the generous end of their own answer means the product only
 * raises a tension it can actually defend.
 */
function horizonOf(timing: string): number | null {
  const t = timing.toLowerCase();
  if (t.startsWith("in the next")) return 3;
  if (t.startsWith("3 to")) return 9;
  if (t.startsWith("9 to")) return 18;
  return null; /* "Just exploring" — they named no deadline, so there is none to miss */
}

function tensionOf(
  timing: string,
  months: number | null,
  helpMonths: number | null,
  hasHelp: boolean,
  fullyCovered: boolean,
): Tension | undefined {
  const want = horizonOf(timing);
  if (want === null) return undefined;

  if (fullyCovered) {
    return {
      kind: "ahead",
      headline: `You said ${timing.toLowerCase()}, and on the money you already have there is nothing stopping that.`,
      body: "The remaining work is confirmation, not saving — a lender, a pre-approval, and a decision about what you actually want. That is a much shorter list than most people at this stage expect.",
    };
  }

  if (months === null) {
    return {
      kind: "behind",
      headline: `You said ${timing.toLowerCase()}, and we cannot tell you whether that is realistic.`,
      body: "Without a monthly saving figure there is no date to compare against your own. It is one number, and it converts this whole page from an estimate into a plan.",
    };
  }

  /* A month of slack, so a 9-month answer against a 10-month arithmetic does
     not get flagged as a problem. It is not one. */
  if (months <= want + 1) {
    return {
      kind: "ahead",
      headline: `You said ${timing.toLowerCase()}, and the arithmetic agrees — about ${months} month${months === 1 ? "" : "s"} on your own.`,
      body: "Your stated timeline and your actual one are the same timeline, which is rarer than it sounds. The work now is protecting it rather than shortening it.",
    };
  }

  const helpCloses = hasHelp && helpMonths !== null && helpMonths <= want + 1;
  return {
    kind: "behind",
    headline: `You said ${timing.toLowerCase()}. On savings alone the arithmetic says about ${months}.`,
    body: helpCloses
      ? `That is the gap worth talking about — and it may already be closed. If the assistance you matched is approved, ${
          helpMonths === 0
            ? "the gap disappears entirely"
            : `you are back to about ${helpMonths} month${helpMonths === 1 ? "" : "s"}`
        }, inside the window you named. Confirming eligibility is therefore not paperwork, it is the whole timeline.`
      : `We are showing you both numbers rather than the comfortable one. Closing that distance means moving one of three things — the price, the monthly amount you set aside, or the date — and the section below ranks which of them moves it most for your situation.`,
  };
}

/**
 * `i.assistance` MUST be zero here. The gap we lead with is the one that is
 * true today; assistance is shown as upside, conditional on a lender saying
 * yes. Folding unconfirmed money into the headline figure would tell someone
 * they are ready to buy when they are not, which is the single worst thing
 * this product could do to a person.
 */
export function buyerReadout(i: BuyerInputs, m: MatchResult, timing: string): Readout {
  const cash = cashToClose(i);
  const own = cashGap({ ...i, assistance: 0 });
  const help = Math.round((m.openMin + m.openMax) / 2);
  const withHelp = cashGap({ ...i, assistance: help });
  const levers = gapLevers({ ...i, assistance: 0 });
  const months = own.monthsToClose;
  const helpMonths = withHelp.monthsToClose;
  const hasHelp = m.matched.length > 0 && help > 0;

  const status: Status =
    own.fullyCovered ? "ready"
    : months !== null && months <= 6 ? "close"
    : months !== null && months <= 18 ? "building"
    : "exploring";

  const helped = hasHelp && helpMonths !== null && helpMonths < (months ?? 0);
  const verdict =
    own.fullyCovered
      ? `On your savings alone you already have the ${money(cash.total)} it takes to close in ${i.county} County.`
    : months === null
      ? `You would need ${money(cash.total)} at the table and you have ${money(i.savings)}.`
      : `On your own you are about ${months} month${months === 1 ? "" : "s"} from closing on a ${money(i.price)} home in ${i.county} County.`;

  const rider =
    own.fullyCovered
      ? "What is left is confirming it with a lender, not saving for it."
    : months === null
      ? "Without a monthly saving figure we cannot put a date on it — that is the first thing worth deciding."
    : helped
      ? `The ${range(m.openMin, m.openMax)} of assistance you may qualify for would ${helpMonths === 0 ? "close that gap entirely" : `bring it to about ${helpMonths} month${helpMonths === 1 ? "" : "s"}`} — if a lender confirms it.`
      : undefined;

  const tension = tensionOf(timing, months, helpMonths, hasHelp, own.fullyCovered);

  const reframe = {
    headline: `${money(cash.total)}, not ${money(cash.down)}`,
    body: `The ${money(cash.down)} down payment is the figure you were given. The number that actually has to be in an account is ${money(cash.total)} — the difference is closing costs, prepaid escrow and inspections. This gap is the most common reason a purchase falls apart in its last three weeks, and it is entirely avoidable by knowing it now.`,
  };

  const blocker: Blocker = hasHelp
    ? {
        title: "Confirming which assistance you actually qualify for",
        body: `${m.matched.length} Georgia program${m.matched.length === 1 ? "" : "s"} may fit your answers, worth ${range(m.usableMin, m.usableMax)}. None of it is counted in your figures above, because none of it is real until a participating lender checks your income against the limits${
          months !== null && helpMonths !== null ? `. It is the difference between about ${months} months and ${helpMonths}` : ""
        }.`,
        who: "A participating lender, not us",
      }
    : own.gap > 0 && i.monthlySaving <= 0
    ? {
        title: "You have no saving rate set",
        body: `Your gap is ${money(own.gap)}. Without a monthly figure there is no timeline, and without a timeline none of the rest of this can be scheduled. Deciding on a number — even a small one — is what turns this from a wish into a plan.`,
        who: "You, this week",
      }
    : own.gap > 0
    ? {
        title: `The ${money(own.gap)} still to find`,
        body: `Nothing structural is wrong. ${levers.length ? `The fastest change available to you is "${levers[0].label}", which moves your date forward by about ${levers[0].saved} month${levers[0].saved === 1 ? "" : "s"}.` : "Steady saving closes it."}`,
        who: "You, with a lender to confirm the target",
      }
    : {
        title: "Nothing structural is in your way",
        body: "Your own savings cover what closing requires. The remaining risk is timing and documentation, both of which are managed rather than solved.",
        who: "You and a lender, together",
      };

  const steps: Step[] = [
    hasHelp && {
      label: `Ask a lender about ${m.matched[0].name}`,
      detail: "Not every lender is approved for every program. Ask before you apply, not after.",
      owner: "You" as const,
      when: "This week",
    },
    i.monthlySaving <= 0 && {
      label: "Decide what you can set aside each month",
      detail: "Any honest number beats no number. It is what puts a date on everything else.",
      owner: "You" as const,
      when: "This week",
    },
    {
      label: "Take the question sheet into two lender conversations",
      detail: "Two, not one. The second conversation is where the first one's answers get tested.",
      owner: "You" as const,
      when: "Next two weeks",
    },
    hasHelp && {
      label: "Start homebuyer education if a program requires it",
      detail: "Most assistance programs require a certificate, and the course takes longer than people expect.",
      owner: "You" as const,
      when: "This month",
    },
    {
      label: "Get the assistance eligibility confirmed in writing",
      detail: "A verbal yes from a loan officer is not a confirmation. Ask for it on paper.",
      owner: "Your lender" as const,
      when: "Before you make an offer",
    },
  ].filter(Boolean) as Step[];

  const questions = [
    ...(hasHelp ? [
      `Are you an approved participating lender for ${m.matched[0].name}?`,
      `Have you actually closed one of these in the last year, and how long did the assistance side take?`,
      `Can ${m.matched.length > 1 ? "these programs" : "this program"} be combined with anything else I qualify for?`,
    ] : []),
    `What is my real rate today with my credit profile, and what would a lock cost?`,
    `What is the total cash I bring to the table on your worksheet — every line, not the down payment?`,
    `How much could a seller contribute toward my closing costs without breaking a program rule?`,
    `What is your PMI estimate, and at what point does it come off?`,
    `Which documents do you need from me, and how long do they stay valid?`,
    `If assistance approval runs late, what happens to my closing date?`,
    `What could disqualify me between today and closing?`,
    `Can I see your fee sheet line by line?`,
  ];

  return { status, statusLabel: STATUS_LABEL[status], verdict, rider, reframe, blocker, steps, questions, tension };
}

/* ------------------------------------------------------------------ *
 * Seller
 * ------------------------------------------------------------------ */

export function sellerReadout(s: SellerInputs, timing: string): Readout {
  const r = netProceeds(s);
  const equityPct = Math.round((r.net / s.price) * 100);
  const thin = equityPct < 12;

  const status: Status =
    timing.startsWith("In the next") ? "ready"
    : timing.startsWith("3 to") ? "close"
    : timing.startsWith("9 to") ? "building"
    : "exploring";

  const verdict = `On a ${money(s.price)} sale you would walk away with about ${money(r.net)}.`;
  const rider = thin
    ? `That is ${equityPct}% of the price — thin enough that the order you do things in matters more than the price you list at.`
    : `${money(r.totalCosts)} goes to your payoff and the cost of selling. What reaches you is ${equityPct}% of the price.`;

  const reframe = {
    headline: `${money(r.net)}, not ${money(s.price)}`,
    body: `Every valuation you have been given is a list price. The figure that decides what you can afford next is what survives the payoff, the commission, the concessions, the repairs and the prorations — ${money(r.net)}. Sellers who plan against the list price are the ones who find out too late that the move does not work.`,
  };

  const blocker: Blocker = !s.homesteadFiled
    ? {
        title: "Value you may be losing every year you still own this",
        body: "Our records question suggests no homestead exemption on this parcel. If this is your primary residence, that is money going out annually whether or not you sell — and it is worth fixing before anything else on this page.",
        who: "Your county tax commissioner",
      }
    : s.assessedValue > s.price * 0.96
    ? {
        title: "Your assessment looks high against a realistic sale price",
        body: `The county has this parcel at ${money(s.assessedValue)} while the market suggests nearer ${money(s.price)}. Appeal windows are short and strictly enforced, and a successful appeal helps you whether or not you end up selling.`,
        who: "Your county board of assessors",
      }
    : {
        title: "Your payoff figure is an estimate, and everything else depends on it",
        body: `Every number on this page moves with your payoff. A lender payoff statement is the one document that makes ${money(r.net)} real rather than approximate, and it costs nothing to request.`,
        who: "Your lender",
      };

  const steps: Step[] = [
    !s.homesteadFiled && {
      label: "Check whether homestead exemption was ever filed",
      detail: "One call to the county. It is worth doing today regardless of what you decide about selling.",
      owner: "You" as const,
      when: "This week",
    },
    {
      label: "Request a written payoff statement",
      detail: "Free, takes a few days, and it turns every figure on this page from estimate into fact.",
      owner: "You" as const,
      when: "This week",
    },
    {
      label: "Do only the repairs that pay back",
      detail: "The table below separates what a buyer pays more for from what only helps the photographs.",
      owner: "You" as const,
      when: "Next two weeks",
    },
    s.assessedValue > s.price * 0.96 && {
      label: "Find your appeal deadline before it passes",
      detail: "The window runs from the annual notice date and is not extended for any reason.",
      owner: "Your county" as const,
      when: "Before the window closes",
    },
    {
      label: "Confirm the capital gains position with a tax professional",
      detail: "The exclusion is large enough that guessing at it is expensive. We are not the ones to answer it.",
      owner: "You" as const,
      when: "Before you commit to a date",
    },
  ].filter(Boolean) as Step[];

  const questions = [
    "What is my exact payoff, including per-day interest and any recording fees?",
    "Is there a prepayment penalty on this loan?",
    "What commission structure are you proposing, and what exactly does it cover?",
    "What are you assuming about buyer concessions in this market right now?",
    "What did comparable homes actually close at, not list at?",
    "What repairs do you expect an inspector to raise on a home this age?",
    "How would the number change if I listed 60 days later?",
    "What happens to my proceeds if the buyer's financing falls through late?",
    "Who pays for what at closing in this county?",
    "What is your plan if we get no offer in the first three weeks?",
  ];

  return { status, statusLabel: STATUS_LABEL[status], verdict, rider, reframe, blocker, steps, questions };
}
