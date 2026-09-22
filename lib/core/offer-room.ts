/**
 * The offer room: the agent's take on the offers, and the seller's choice.
 *
 * Benchmark 2.2 is "Rift prepares consequential work; the agent approves; the
 * difference is visible and recorded". The offers already rank themselves by
 * net. What was missing is the two halves a seller actually needs at that
 * table — what their agent thinks, and a way to say "this one" that is
 * recorded alongside the numbers they were looking at when they said it.
 *
 * RIFT DRAFTS THE FACTS AND LEAVES THE JUDGEMENT BLANK. The draft states what
 * is computable — which offer is highest, which leaves the seller most, what
 * paperwork is missing — and ends with a marker the agent must replace with
 * his own recommendation. `canApprove` refuses a take that still contains it.
 * Software that writes "I'd take Whitfield" in the agent's voice and waits for
 * a click has made the recommendation; the click is not approval, it is
 * signing something unread, and the seller would be told a machine's ranking
 * was their agent's advice.
 *
 * A TAKE IS ABOUT A SET OF OFFERS. It is approved for exactly the offers the
 * seller could see at that moment. Release a new one, or withdraw one, and the
 * take no longer describes the table under it: "I would take the Whitfield
 * offer" above an offer that arrived an hour later is advice about a choice
 * that no longer exists. `takeIsCurrent` hides it until he approves again.
 *
 * CHOOSING IS NOT ACCEPTING. A seller clicking a button on a web page has not
 * accepted anything in Georgia; acceptance is a signed document delivered to
 * the other side. The page says so, in those words, because the most expensive
 * misunderstanding available here is a seller who thinks the deal is done.
 */

import { money } from "./compute";
import { rankOffers, headlineTrap, gapsIn, FINANCING_LABEL, type Offer, type SellerCosts } from "./offers";

/** Where the agent's own recommendation goes. Approval is refused while it is still here. */
export const RECOMMENDATION_MARKER = "[What you would do, and why — in your own words]";

export const TAKE_MAX = 2000;
export const CLIENT_NOTE_MAX = 1000;

export interface OfferRoom {
  /** What Rift drafted, exactly as it stood when the agent approved. */
  prepared: string | null;
  /** What the agent approved. The client reads this, never `prepared`. */
  take: string | null;
  approvedAt: string | null;
  /** The released offers the take was approved against. */
  approvedFor: string[];
  chosenOfferId: string | null;
  chosenAt: string | null;
  /** What the seller was shown when they chose. Computed on the server. */
  chosenSeen: ChoiceSnapshot | null;
  clientNote: string | null;
}

export const EMPTY_ROOM: OfferRoom = {
  prepared: null, take: null, approvedAt: null, approvedFor: [],
  chosenOfferId: null, chosenAt: null, chosenSeen: null, clientNote: null,
};

/**
 * The facts, drafted. Null when there is nothing released to talk about.
 *
 * Deliberately flat and deliberately incomplete. Every sentence is one the
 * product can already defend from its own arithmetic; the last line is the
 * agent's to write.
 */
export function draftTake(released: Offer[], costs: SellerCosts | null): string | null {
  if (released.length === 0) return null;

  const lines: string[] = [];

  if (released.length === 1) {
    const o = released[0]!;
    lines.push(`There is one offer in front of you: ${o.from} at ${money(o.price)}.`);
  } else {
    const byPrice = [...released].sort((a, b) => b.price - a.price);
    lines.push(
      `There are ${released.length} offers in front of you. The highest price is ${byPrice[0]!.from} at ${money(byPrice[0]!.price)}.`,
    );
  }

  if (costs) {
    const trap = headlineTrap(released, costs);
    const ranked = rankOffers(released, costs);
    if (trap) {
      lines.push(
        `It is not the one that leaves you most. ${trap.bestNet.from} offered less and would leave you about ${money(trap.difference)} more once everything they ask back comes out.`,
      );
    } else if (released.length > 1) {
      lines.push(`It is also the one that leaves you most, about ${money(ranked[0]!.net)} after costs.`);
    } else {
      lines.push(`After costs it would leave you about ${money(ranked[0]!.net)}.`);
    }
  } else {
    lines.push("What each one leaves you depends on your payoff, which is not recorded yet, so this compares terms rather than money.");
  }

  for (const o of released) {
    const facts: string[] = [FINANCING_LABEL[o.financing]];
    if (o.contingencies.length) facts.push(`conditional on ${o.contingencies.join(", ")}`);
    const gaps = gapsIn(o).map((g) => g.charAt(0).toLowerCase() + g.slice(1));
    lines.push(`${o.from}: ${facts.join(", ")}${gaps.length ? `; ${gaps.join("; ")}` : ""}.`);
  }

  lines.push("", RECOMMENDATION_MARKER);
  return lines.join("\n");
}

/** Why a take cannot be approved, or null when it can. */
export function canApprove(take: string, released: Offer[]): string | null {
  const t = take.trim();
  if (released.length === 0) return "Release at least one offer first — a take about nothing the seller can see is not advice";
  if (!t) return "Write something first";
  if (t.includes(RECOMMENDATION_MARKER)) return "Replace the bracketed line with what you would do — that part is yours to write, not Rift's";
  if (t.length > TAKE_MAX) return `Keep it under ${TAKE_MAX} characters — it is read on a phone`;
  return null;
}

const sameSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
};

/** Whether the approved take still describes the offers the seller can see. */
export function takeIsCurrent(room: OfferRoom, released: Offer[]): boolean {
  return Boolean(room.take && room.approvedAt) && sameSet(room.approvedFor, released.map((o) => o.id));
}

/** Whether the agent sent Rift's draft as it was, or rewrote any of it. */
export function wasEdited(room: OfferRoom): boolean | null {
  if (!room.take || room.prepared === null) return null;
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  /* The marker is always replaced, so compare everything above it. */
  const draftFacts = norm(room.prepared.split(RECOMMENDATION_MARKER)[0] ?? "");
  return !norm(room.take).startsWith(draftFacts);
}

/**
 * What the seller saw when they chose, frozen.
 *
 * Built on the server from the database rows, never from anything the browser
 * sends: a snapshot the client can write is a record of what they typed, not
 * of what they were shown.
 */
export interface ChoiceSnapshot {
  from: string;
  price: number;
  /** Null when the seller's costs were not recorded, so no net was shown. */
  net: number | null;
  askedBack: number;
  financing: string;
  closeOn: string | null;
  gaps: string[];
  /** How many offers were on the table, and whether this was the best net. */
  of: number;
  bestNet: boolean | null;
  /** Whether the agent's take was on screen, and what it said. */
  take: string | null;
}

export function snapshotOf(
  chosen: Offer, released: Offer[], costs: SellerCosts | null, take: string | null,
): ChoiceSnapshot {
  const ranked = costs ? rankOffers(released, costs) : [];
  const mine = ranked.find((n) => n.offerId === chosen.id);
  return {
    from: chosen.from,
    price: chosen.price,
    net: mine ? Math.round(mine.net) : null,
    askedBack: chosen.concessions + chosen.repairCredit,
    financing: FINANCING_LABEL[chosen.financing],
    closeOn: chosen.closeOn,
    gaps: gapsIn(chosen),
    of: released.length,
    bestNet: mine ? mine.behindBy === 0 : null,
    take,
  };
}

/** Why the seller cannot choose this offer, or null when they can. */
export function canChoose(offerId: string, released: Offer[], room: OfferRoom): string | null {
  if (room.chosenOfferId) return "You have already told your agent which offer you want. Ask them if you have changed your mind";
  if (!released.some((o) => o.id === offerId)) return "That offer is no longer in front of you. Refresh the page to see the current ones";
  return null;
}

/** The sentence that stands between a click and a seller who thinks the deal is done. */
export const NOT_ACCEPTANCE =
  "This tells your agent which offer you want to go ahead with. Nothing is accepted or signed until you sign the acceptance itself.";
