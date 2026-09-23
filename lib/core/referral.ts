/**
 * The referral engine.
 *
 * Referral was a page. A page is the wrong shape for it, because referral is
 * not a thing you ask for once at the end: it is a set of MOMENTS, each with
 * its own trigger, its own ask, and its own reason the ask is reasonable then
 * and unreasonable a week either side.
 *
 * Two rules the design enforces:
 *
 *   1. The ask scales with what they have received. Right after a readout the
 *      ask is "send this to someone it would help": a tool, not a person. On
 *      closing day it can be a name. Asking for a name at moment one is how
 *      you spend goodwill you have not earned.
 *
 *   2. A REVIEW INVITATION IS THE SAME FOR EVERYONE. Whoever reaches a review
 *      moment is asked the same way, plainly and once, whatever they said
 *      about how it went. The private service check is a separate track: an
 *      unhappy answer raises a follow-up for the agent and never decides
 *      whether somebody is asked. Asking only the people who said they were
 *      happy is review gating, which Google's review policy forbids and
 *      docs/product.md already ruled out ("no pre-screening for positive
 *      sentiment"). Decision D12, 23 September 2026 (docs/handoff.md 8.2).
 *
 *      This file used to do exactly that: a `gate()` held every public ask
 *      until the check came back good. It never reached a real client (Rift
 *      had none, and has never sent an email), and it is gone.
 */

export type MomentId =
  | "value_delivered" | "plan_published" | "financing_secured"
  | "under_contract" | "closing_day" | "day_30" | "month_6" | "anniversary";

export type MomentState = "waiting" | "due" | "sent" | "acted" | "declined" | "held";

export interface Moment {
  id: MomentId;
  label: string;
  /** The condition, in words the agent would use. */
  trigger: string;
  /** What we actually ask for. Escalates with what they have received. */
  ask: string;
  /** Why this moment and not another. */
  why: string;
  /** The ask includes a public review. Marked so the screen can say so; it
   *  changes nothing about who is asked (rule 2). */
  review: boolean;
  /** Roughly how strong this moment is, 1–5. Used to order the queue. */
  strength: number;
}

export const MOMENTS: Moment[] = [
  {
    id: "value_delivered", label: "Readout delivered", trigger: "They finished the assessment and got their numbers",
    ask: "Send this to someone it would help",
    why: "They have just been given something for nothing and owe us nothing. The only honest ask here is for the tool, not for a name.",
    review: false, strength: 2,
  },
  {
    id: "plan_published", label: "Plan published", trigger: "Kaleb reviewed and published their plan",
    ask: "Share the plan with anyone helping you",
    why: "Sharing is genuinely useful to them at this point: a gifting parent or a co-buyer needs it. Reach is a side effect of a real need.",
    review: false, strength: 2,
  },
  {
    id: "financing_secured", label: "Financing secured", trigger: "Pre-approval or assistance confirmed in writing",
    ask: "Would a friend in the same spot want the assistance check?",
    why: "The single most quotable moment for a first-time buyer. They just found out the money is real. Specific, and specific asks travel.",
    review: false, strength: 4,
  },
  {
    id: "under_contract", label: "Under contract", trigger: "Binding agreement executed",
    ask: "Nothing. Say congratulations and go quiet.",
    why: "They are about to be busy and anxious for thirty days. Asking here costs more than it earns, and restraint is remembered.",
    review: false, strength: 1,
  },
  {
    id: "closing_day", label: "Closing day", trigger: "Keys handed over",
    ask: "A public review, and anyone you think I should meet",
    why: "The peak. Gratitude is highest and the memory is complete. If only one ask is ever made, it is this one.",
    review: true, strength: 5,
  },
  {
    id: "day_30", label: "Thirty days in", trigger: "30 days after closing",
    ask: "Anything gone wrong I can help with?",
    why: "Not an ask at all. It is the check that makes the six-month ask credible, and it catches problems while they are still small.",
    review: false, strength: 1,
  },
  {
    id: "month_6", label: "Six months in", trigger: "6 months after closing",
    ask: "A review, if you didn't leave one, and an introduction if anyone comes to mind",
    why: "Long enough that the answer is considered rather than euphoric. Reviews written here are the ones that read as real.",
    review: true, strength: 4,
  },
  {
    id: "anniversary", label: "Anniversary", trigger: "Every year on the closing date, indefinitely",
    ask: "Here's what your home did this year. Anyone you'd send my way?",
    why: "Carries value first (an equity and tax update they did not ask for), so the ask arrives attached to something.",
    review: false, strength: 3,
  },
];

export const STATE_CHIP: Record<MomentState, { l: string; c: string }> = {
  waiting: { l: "Not yet", c: "chip" },
  due: { l: "Due now", c: "chip-acc" },
  sent: { l: "Sent", c: "chip" },
  acted: { l: "Acted on", c: "chip-pos" },
  declined: { l: "Declined", c: "chip" },
  held: { l: "Held back", c: "chip-warn" },
};

/* ------------------------------------------------------------------ *
 * The private service check
 * ------------------------------------------------------------------ */

export type Mood = "good" | "mixed" | "bad" | null;

export interface ServiceCheck {
  /** Something needs putting right, and the agent should follow up. */
  followUp: boolean;
  label: string;
  note: string;
}

/**
 * What the private "how did it go?" answer means: whether the agent owes this
 * person a follow-up. Nothing else. In particular it has no say over any
 * moment's ask, and `momentsFor` does not read it (rule 2 above).
 */
export function serviceCheck(mood: Mood): ServiceCheck {
  if (mood === "good")
    return { followUp: false, label: "It went well", note: "Nothing to put right." };
  if (mood === "mixed")
    return {
      followUp: true,
      label: "Follow up",
      note: "Something is unresolved. Follow up about it directly. It does not change whether they are asked for a review: everyone is asked the same way.",
    };
  if (mood === "bad")
    return {
      followUp: true,
      label: "Follow up today",
      note: "They are unhappy. Talk to them and put right what you can. That is separate from any review invitation, which goes to everyone the same way.",
    };
  return {
    followUp: false,
    label: "Not asked yet",
    note: "Ask them privately how it went. The answer decides whether you follow up, never whether they are asked for a review.",
  };
}

/* ------------------------------------------------------------------ *
 * Deriving the moments for a real relationship
 * ------------------------------------------------------------------ */

/**
 * What the database can actually see about a relationship.
 *
 * Deliberately narrow, and every field is something a query can answer. A
 * trigger that cannot be observed does not get guessed at: see
 * `OBSERVABLE` below, which is the whole design of this section.
 */
export interface Lifecycle {
  stage: string;
  /** ISO date the relationship closed. Null until it has. */
  closedOn: string | null;
  /** They finished an assessment and were shown their numbers. */
  readoutDelivered: boolean;
  /** A plan exists and its link is open. */
  planPublished: boolean;
  /** The private service check. Null means unanswered, not "fine". It is
   *  carried for the follow-up it may raise; no moment depends on it. */
  mood: Mood;
}

/**
 * A moment the agent has already decided about.
 *
 * `occurrence` matters for exactly one moment and is the reason it is here at
 * all. The anniversary repeats "every year on the closing date, indefinitely",
 * so a record keyed on the moment alone would mark the first anniversary sent
 * and then suppress every anniversary after it: a follow-up cadence that
 * quietly stops after year one and looks, from every screen, exactly like one
 * that is running. Non-recurring moments use 0.
 */
export interface RecordedMoment {
  momentId: MomentId;
  occurrence: number;
  state: MomentState;
}

/**
 * Which triggers the data can actually answer.
 *
 * `financing_secured` is absent on purpose. "Pre-approval or assistance
 * confirmed in writing" is not a column: it is a document in somebody's
 * inbox, and the honest options were to leave the moment waiting until a
 * human says otherwise, or to infer it from the stage having moved past
 * Financing. The second is a guess, and this is the strongest early ask in
 * the set: firing it at somebody whose pre-approval actually fell through is
 * the single most expensive message this product could send.
 *
 * So it waits, visibly, until Kaleb records it. A moment that sits at "not
 * yet" is a small loss. A moment that congratulates the wrong person is not.
 */
const OBSERVABLE: Record<MomentId, true | undefined> = {
  value_delivered: true,
  plan_published: true,
  financing_secured: undefined,
  under_contract: true,
  closing_day: true,
  day_30: true,
  month_6: true,
  anniversary: true,
};

export const DAY_MS = 86_400_000;
/** Thirty days after closing. */
export const DAY_30 = 30;
/** Half a year, counted in days so it needs no calendar arithmetic. */
export const MONTH_6 = 182;

const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const daysBetween = (fromIso: string, now: Date) =>
  Math.floor((Date.parse(now.toISOString().slice(0, 10) + "T00:00:00Z") - dayOf(fromIso)) / DAY_MS);

/**
 * How many anniversaries have come round, and none until a full year has.
 *
 * Counted in whole days rather than by comparing year numbers, because
 * comparing years makes a 2 January closing have its "first anniversary" on 1
 * January eleven months later.
 */
export function anniversariesPassed(closedOn: string, now: Date): number {
  const days = daysBetween(closedOn, now);
  if (days < 365) return 0;
  /* 365.25 so the count does not drift a day early every fourth year and fire
     the anniversary before the date it is named after. */
  return Math.floor(days / 365.25);
}

/** Whether a moment's trigger condition has happened yet. */
function triggered(id: MomentId, life: Lifecycle, now: Date): boolean {
  if (!OBSERVABLE[id]) return false;
  switch (id) {
    case "value_delivered":
      return life.readoutDelivered;
    case "plan_published":
      return life.planPublished;
    case "under_contract":
      return life.stage === "Under contract";
    case "closing_day":
      return life.closedOn !== null;
    case "day_30":
      return life.closedOn !== null && daysBetween(life.closedOn, now) >= DAY_30;
    case "month_6":
      return life.closedOn !== null && daysBetween(life.closedOn, now) >= MONTH_6;
    case "anniversary":
      return life.closedOn !== null && anniversariesPassed(life.closedOn, now) >= 1;
    default:
      return false;
  }
}

/** The occurrence number a moment is currently on. */
export function currentOccurrence(id: MomentId, life: Lifecycle, now: Date): number {
  if (id !== "anniversary") return 0;
  return life.closedOn ? anniversariesPassed(life.closedOn, now) : 0;
}

export interface MomentStatus {
  moment: Moment;
  state: MomentState;
  occurrence: number;
  /** Why this is not actionable, in words the agent would use. Null when it is. */
  blockedBecause: string | null;
}

/**
 * The state of every moment for one relationship.
 *
 * A recorded decision always wins over a derived one: once Kaleb has said
 * "sent", "acted on", "declined" or "held back", that is the answer, and a
 * later run does not quietly reopen it.
 *
 * `life.mood` is deliberately not read here. Whether a moment is due depends
 * on what has happened, never on what the person said about how it went
 * (rule 2 at the top of this file). The test that walks every moment against
 * every mood holds that in place.
 */
export function momentsFor(
  life: Lifecycle,
  recorded: RecordedMoment[],
  now: Date = new Date(),
): MomentStatus[] {
  return MOMENTS.map((moment) => {
    const occurrence = currentOccurrence(moment.id, life, now);
    const decided = recorded.find(
      (r) => r.momentId === moment.id && r.occurrence === occurrence,
    );

    if (decided) {
      return { moment, state: decided.state, occurrence, blockedBecause: null };
    }

    if (!triggered(moment.id, life, now)) {
      return {
        moment,
        state: "waiting" as const,
        occurrence,
        blockedBecause: OBSERVABLE[moment.id]
          ? null
          : "Nothing in the record says this has happened. Mark it when it has.",
      };
    }

    return { moment, state: "due" as const, occurrence, blockedBecause: null };
  });
}

/**
 * Whether this moment's ask may go out, right now.
 *
 * The one function any sending code must call. It takes no mood, on purpose:
 * a review invitation is the same for everyone (rule 2), so the only question
 * is whether the moment is due and nobody has decided about it yet.
 */
export function mayAsk(status: MomentStatus): boolean {
  return status.state === "due";
}

/**
 * What wants doing for this relationship, strongest first.
 *
 * `under_contract` is filtered out, and that is the point of it. Its ask is
 * "Nothing. Say congratulations and go quiet", so a queue that listed it as
 * work would be inviting exactly the contact the moment exists to prevent. It
 * is still returned by `momentsFor`: the agent should be able to see that the
 * restraint is deliberate rather than an omission.
 */
export const SILENT_MOMENTS: MomentId[] = ["under_contract"];

export function actionable(statuses: MomentStatus[]): MomentStatus[] {
  return statuses
    .filter((s) => (s.state === "due" || s.state === "held") && !SILENT_MOMENTS.includes(s.moment.id))
    .sort((a, b) => {
      /* Something due outranks something the agent chose to hold back: the
         first is waiting on him, the second is a decision already taken. */
      if (a.state !== b.state) return a.state === "due" ? -1 : 1;
      return b.moment.strength - a.moment.strength;
    });
}
