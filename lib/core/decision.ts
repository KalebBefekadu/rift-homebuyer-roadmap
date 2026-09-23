/**
 * Decision Rooms: the place a consequential choice gets made and recorded.
 *
 * docs/benchmark.md scores 4.3 at **0** in production. Not weak: absent. The
 * prototype has `/app/decisions` and a decision room; production had no
 * surface at all, and the criterion asks for "Decision Rooms at the moments
 * where clients actually stall, with scenarios and recorded outcomes".
 *
 * docs/product.md lists what a room contains: the decision and deadline,
 * available scenarios, comparable numbers, assumptions, benefits, trade-offs,
 * risks, source documents, review state, agent context, customer questions,
 * and the recorded decision. This module implements the half of that list that
 * can be true today: documents and threaded questions need tables that do not
 * exist, and a heading over a feature that cannot work is worse than its
 * absence.
 *
 * Three rules hold it together.
 *
 * A ROOM NEVER RECOMMENDS. It lays out options with their numbers and their
 * trade-offs and stops. Recommending is licensed advice, it is the agent's to
 * give, and a product that quietly ranks one option above another has given it
 * without saying so. `compare()` below orders options by the AGENT's ordering,
 * never by their amounts.
 *
 * NOTHING REACHES THE CLIENT UNRELEASED. Criterion 2.2 is prepare-then-approve:
 * the agent assembles the room, and it is invisible until he releases it.
 *
 * AN OUTCOME IS A FACT, NOT A STATE. Recording a decision stores which option,
 * when, and in whose words. It does not compute whether the decision was good.
 */

export type Kind = "affordability" | "offers" | "property" | "timing" | "other";

export const KIND_LABEL: Record<Kind, string> = {
  affordability: "What to spend",
  offers: "Which offer",
  property: "Which home",
  timing: "When to move",
  other: "A decision",
};

export interface Option {
  id: string;
  /** What this choice is, in a few words. */
  label: string;
  /** The agent's own explanation. Never generated. */
  detail: string | null;
  /**
   * The number that makes options comparable, in cents.
   *
   * Cents because these are money and a float is not money. Null when the
   * decision is not about an amount: "sell first, then buy" has no figure and
   * forcing one would invent it.
   */
  amountCents: number | null;
  /** What that number IS. "Would reach you", "a month", "at the table". */
  amountLabel: string | null;
  /** What is good about it, in the agent's words. */
  upside: string | null;
  /** What is not. Required alongside upside: see `balanced` below. */
  downside: string | null;
  sort: number;
}

export interface Decision {
  id: string;
  kind: Kind;
  /** The question, as a question. */
  question: string;
  /** The agent's framing. */
  context: string | null;
  /** ISO date by which it has to be answered, if there is one. */
  decideBy: string | null;
  releasedAt: string | null;
  decidedAt: string | null;
  /** The option chosen, once one has been. */
  chosenOptionId: string | null;
  /** Why, in whoever's words recorded it. */
  outcomeNote: string | null;
  options: Option[];
}

/* ------------------------------------------------------------------ *
 * What a room must have before anybody sees it
 * ------------------------------------------------------------------ */

/** The fewest options that make something a decision rather than an instruction. */
export const MIN_OPTIONS = 2;

export interface ReleaseCheck {
  ok: boolean;
  blocks: string[];
  warns: string[];
}

/**
 * Whether this room can go to the client.
 *
 * Modelled on `canPublish` in seam.ts, and for the same reason: the moment a
 * thing becomes visible to somebody outside the business is the moment to
 * check it says something true.
 */
export function canRelease(d: Pick<Decision, "question" | "options">): ReleaseCheck {
  const blocks: string[] = [];
  const warns: string[] = [];

  if (!d.question.trim()) blocks.push("The room has no question. A decision nobody can state is not ready to be shared.");

  if (d.options.length < MIN_OPTIONS) {
    blocks.push(
      `A decision needs at least ${MIN_OPTIONS} options. One option is not a choice. It is an instruction, and presenting it as a decision asks somebody to agree with something they were never given an alternative to.`,
    );
  }

  /* Options that are all money or all not. A room where two options carry a
     figure and a third does not reads as though the third costs nothing. */
  const withAmount = d.options.filter((o) => o.amountCents !== null);
  if (withAmount.length > 0 && withAmount.length < d.options.length) {
    blocks.push(
      `${d.options.length - withAmount.length} of ${d.options.length} options have no figure. Side by side, an option with no number reads as one that costs nothing.`,
    );
  }

  /* Comparable numbers have to be comparable. Two options labelled "a month"
     and "at the table" are different quantities in the same column. */
  const labels = new Set(withAmount.map((o) => (o.amountLabel ?? "").trim().toLowerCase()));
  if (labels.size > 1) {
    blocks.push("The figures do not describe the same thing. Options set side by side have to be the same kind of number.");
  }

  if (!balanced(d.options)) {
    warns.push("Some options name an upside with no trade-off, or the reverse. A room where one option has only good news is a recommendation wearing a comparison's clothes.");
  }

  return { ok: blocks.length === 0, blocks, warns };
}

/**
 * Whether every option that argues a case also argues against itself.
 *
 * Not enforced: an agent may genuinely have nothing to say either way, and
 * blocking on it would teach him to type a word to get past the check. It is
 * warned about, because the failure it guards is subtle: a comparison where
 * one option has an upside and no downside has made a recommendation without
 * anybody deciding to.
 */
export function balanced(options: Option[]): boolean {
  const arguing = options.filter((o) => o.upside?.trim() || o.downside?.trim());
  if (arguing.length === 0) return true;
  return arguing.every((o) => o.upside?.trim() && o.downside?.trim());
}

/* ------------------------------------------------------------------ *
 * Reading a room
 * ------------------------------------------------------------------ */

export type Status = "draft" | "open" | "decided";

export function statusOf(d: Pick<Decision, "releasedAt" | "decidedAt">): Status {
  if (d.decidedAt) return "decided";
  return d.releasedAt ? "open" : "draft";
}

export interface Spread {
  /** The difference between the largest and smallest figure, in cents. */
  rangeCents: number;
  /** What the figures describe, echoed from the options. */
  label: string;
}

/**
 * How much is actually at stake.
 *
 * The single most useful sentence a comparison can carry, and the one nobody
 * works out for themselves: two offers whose headline prices differ by $9,000
 * may differ by $1,200 in what reaches the seller. Null when the options carry
 * no figures, which is honest rather than zero: a spread of $0 and no spread
 * at all render identically and mean opposite things.
 */
export function spreadOf(options: Option[]): Spread | null {
  const amounts = options.map((o) => o.amountCents).filter((c): c is number => c !== null);
  if (amounts.length < 2) return null;
  const label = (options.find((o) => o.amountLabel)?.amountLabel ?? "").trim();
  return {
    rangeCents: Math.max(...amounts) - Math.min(...amounts),
    label,
  };
}

/**
 * The options, in the order they are shown.
 *
 * The agent's own order, always. Sorting by amount would put the largest
 * number first, and the largest number is not the best option: that is the
 * exact mistake `headlineTrap` in lib/core/offers.ts exists to catch, and
 * building it into the ordering of every decision room would be committing it
 * everywhere at once.
 */
export function compare(options: Option[]): Option[] {
  return [...options].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

/** Days until the decision is due, or null when nobody set a date. */
export function daysLeft(d: Pick<Decision, "decideBy">, today = new Date()): number | null {
  if (!d.decideBy) return null;
  const due = new Date(`${d.decideBy}T00:00:00Z`).getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((due - now) / 86_400_000);
}

/**
 * The chosen option, if one was.
 *
 * Returns null rather than throwing on an id that no longer matches an option.
 * An option can be removed after a decision was recorded against it, and a
 * room that crashes rather than saying "the option chosen is no longer here"
 * is a worse answer to a real state.
 */
export function chosen(d: Decision): Option | null {
  if (!d.chosenOptionId) return null;
  return d.options.find((o) => o.id === d.chosenOptionId) ?? null;
}
