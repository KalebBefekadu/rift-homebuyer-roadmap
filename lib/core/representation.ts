/**
 * Representation: the gate between a lead and a client.
 *
 * This is the most consequential compliance moment in a residential
 * transaction, and docs/product.md is explicit that it must be "a visible
 * lifecycle state rather than an offline side channel". It was neither. There
 * was no column, which is why `canPublish` in seam.ts carried
 * `hasAgreement: true` as a literal: the one precondition in the product that
 * was asserted rather than read, sitting in a function whose entire job is to
 * refuse to publish when something is not true.
 *
 * Pure, like every rule in lib/core. What a status MEANS, when a journey may
 * advance, and when an agreement is about to lapse are all decidable from a
 * status, two dates and a clock; none of them needs a database, and having
 * them here means the gate cannot be re-implemented slightly differently on
 * the two screens that enforce it.
 *
 * ONE RULE ABOVE THE REST: this module never says an agreement is signed. It
 * reports what is recorded. An agent typing "signed" into a form is the record
 * of a paper event that happened elsewhere, and the product's job is to hold
 * that record accurately and refuse to proceed without it: not to be the
 * authority on it. Rift never signs, and never sends for signature.
 */

export const STATUSES = [
  "none",
  "prepared",
  "sent",
  "signed",
  "expired",
  "declined",
] as const;

export type Status = (typeof STATUSES)[number];

export interface StatusRule {
  status: Status;
  label: string;
  /** How it reads on the agent's screen. */
  chip: string;
  /** What it means, in his words rather than ours. */
  meaning: string;
}

export const STATUS_RULES: Record<Status, StatusRule> = {
  none: {
    status: "none",
    label: "Nothing yet",
    chip: "chip",
    meaning: "No agreement has been prepared. Normal early on, and the thing to fix before showing anybody a home.",
  },
  prepared: {
    status: "prepared",
    label: "Prepared",
    chip: "chip-warn",
    meaning: "Drafted and waiting to go out. It protects nobody until it is sent and signed.",
  },
  sent: {
    status: "sent",
    label: "Sent",
    chip: "chip-warn",
    meaning: "With them and unsigned. This is the state that quietly lasts three weeks.",
  },
  signed: {
    status: "signed",
    label: "Signed",
    chip: "chip-pos",
    meaning: "On file, with dates. The journey can proceed.",
  },
  expired: {
    status: "expired",
    label: "Expired",
    chip: "chip-neg",
    meaning: "It ran out. Everything it covered is uncovered from the day it lapsed, not from the day anybody noticed.",
  },
  declined: {
    status: "declined",
    label: "Declined",
    chip: "chip-neg",
    meaning: "They would not sign. A real answer, and worth recording rather than leaving as silence.",
  },
};

/** The only status that lets a journey past its gate. */
export const isCovered = (status: Status): boolean => status === "signed";

/* ------------------------------------------------------------------ *
 * Expiry
 * ------------------------------------------------------------------ */

/**
 * How far ahead a lapse is worth raising.
 *
 * docs/product.md: "Expiration is a monitored deadline that raises attention
 * before it lapses, not after." Three weeks is enough to have the conversation
 * and get a signature back without it being an emergency.
 */
export const EXPIRY_WARNING_DAYS = 21;

const DAY = 86_400_000;

/** Whole days until a date, negative once it has passed. */
export function daysTo(date: string, today: Date): number {
  const then = new Date(`${date}T00:00:00Z`).getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((then - now) / DAY);
}

export interface Representation {
  status: Status;
  /** ISO date the agreement took effect, if signed. */
  signedOn: string | null;
  /** ISO date it runs out, if it has one. */
  expiresOn: string | null;
}

export interface Standing {
  /** The status as it should be READ today, which is not always as stored. */
  effective: Status;
  covered: boolean;
  /** Days until expiry. Null when nothing is dated. */
  daysLeft: number | null;
  /** True when it is dated, still valid, and close enough to act on. */
  lapsingSoon: boolean;
  /** One sentence for the screen. Never a status name on its own. */
  note: string;
}

/**
 * What the record actually says today.
 *
 * A stored status of `signed` against an expiry date in the past is not
 * signed, and reading it as signed is how somebody shows a house on a lapsed
 * agreement. The stored value is what an agent last typed; this is what it
 * means now. Nothing writes the expiry back: a derived truth stored twice is
 * two truths, and the clock is not something we need to remember for.
 */
export function standingOf(rep: Representation, today = new Date()): Standing {
  const daysLeft = rep.expiresOn ? daysTo(rep.expiresOn, today) : null;
  const lapsed = rep.status === "signed" && daysLeft !== null && daysLeft < 0;
  const effective: Status = lapsed ? "expired" : rep.status;
  const covered = isCovered(effective);

  const lapsingSoon = covered && daysLeft !== null && daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS;

  let note: string;
  if (lapsed) {
    note = `The agreement expired ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) === 1 ? "" : "s"} ago. It is recorded as signed and is not in force.`;
  } else if (lapsingSoon) {
    note = daysLeft === 0
      ? "The agreement runs out today."
      : `The agreement runs out in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
  } else if (covered) {
    note = rep.expiresOn
      ? `Signed and in force until ${rep.expiresOn}.`
      : "Signed, with no end date recorded.";
  } else {
    note = STATUS_RULES[effective].meaning;
  }

  return { effective, covered, daysLeft, lapsingSoon, note };
}

/* ------------------------------------------------------------------ *
 * The lifecycle gate
 * ------------------------------------------------------------------ */

/**
 * The last stage a journey may reach without a signed agreement.
 *
 * From docs/product.md: a buyer cannot advance past **Ready to shop**, a
 * seller cannot advance past pricing and launch, which in this product's
 * stage vocabulary is **Preparing the property**.
 *
 * The stages before the gate are the ones where an agent is establishing
 * whether there is anything to represent. Everything after involves acting on
 * somebody's behalf.
 */
export const GATE: Record<"buy" | "sell", string> = {
  buy: "Ready to shop",
  sell: "Preparing the property",
};

/**
 * The stage order each side actually moves through.
 *
 * Declared rather than derived from STAGES, because the two sides share one
 * list and a buyer never enters "Preparing the property" while a seller never
 * enters "Financing". Deriving the gate from a position in the shared list
 * would put a seller's gate in the wrong place.
 */
export const JOURNEY: Record<"buy" | "sell", string[]> = {
  buy: [
    "Exploring", "Building readiness", "Financing", "Ready to shop",
    "Searching", "Reviewing offers", "Under contract", "Closing",
  ],
  sell: [
    "Exploring", "Preparing the property",
    "Reviewing offers", "Under contract", "Closing",
  ],
};

export interface GateCheck {
  allowed: boolean;
  /** Present only when refused. Explains rather than announcing. */
  because?: string;
}

/**
 * Whether a journey may move to a stage.
 *
 * Refuses rather than warns, and says why: docs/product.md: "Rift blocks the
 * advance and explains why rather than silently allowing it."
 *
 * The terminal stages are always allowed. A relationship that ended without an
 * agreement still ended, and a product that will not let an agent record
 * "Lost" until paperwork exists is a product that stops being a record of what
 * happened.
 */
export function mayAdvance(
  side: "buy" | "sell",
  to: string,
  rep: Representation,
  today = new Date(),
): GateCheck {
  if (to === "Closed" || to === "Lost") return { allowed: true };

  const order = JOURNEY[side];
  const gateAt = order.indexOf(GATE[side]);
  const target = order.indexOf(to);

  /* A stage this side does not use is not this gate's business to judge. */
  if (target === -1 || gateAt === -1) return { allowed: true };
  if (target <= gateAt) return { allowed: true };

  const standing = standingOf(rep, today);
  if (standing.covered) return { allowed: true };

  const what = standing.effective === "expired"
    ? "the agreement on file has expired"
    : standing.effective === "declined"
      ? "they declined to sign"
      : standing.effective === "none"
        ? "no agreement has been prepared"
        : `the agreement is ${STATUS_RULES[standing.effective].label.toLowerCase()} and not signed`;

  return {
    allowed: false,
    because: `${to} is past ${GATE[side]}, and ${what}. Representation has to be signed before acting on somebody's behalf.`,
  };
}
