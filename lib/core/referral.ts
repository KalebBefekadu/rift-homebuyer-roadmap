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
 *   2. NOTHING PUBLIC IS ASKED FOR BEFORE A PRIVATE CHECK. Every public review
 *      request is gated behind one private question. An unhappy client is
 *      routed to the agent, never to a review form. This is not review-gating
 *      to manufacture ratings: the private route exists so the complaint gets
 *      answered, and someone who says they are unhappy is never then asked for
 *      a public rating anyway. If they are happy, they are asked plainly and
 *      once.
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
  /** Public reviews require the private satisfaction check first. */
  gated: boolean;
  /** Roughly how strong this moment is, 1–5. Used to order the queue. */
  strength: number;
}

export const MOMENTS: Moment[] = [
  {
    id: "value_delivered", label: "Readout delivered", trigger: "They finished the assessment and got their numbers",
    ask: "Send this to someone it would help",
    why: "They have just been given something for nothing and owe us nothing. The only honest ask here is for the tool, not for a name.",
    gated: false, strength: 2,
  },
  {
    id: "plan_published", label: "Plan published", trigger: "Kaleb reviewed and published their plan",
    ask: "Share the plan with anyone helping you",
    why: "Sharing is genuinely useful to them at this point: a gifting parent or a co-buyer needs it. Reach is a side effect of a real need.",
    gated: false, strength: 2,
  },
  {
    id: "financing_secured", label: "Financing secured", trigger: "Pre-approval or assistance confirmed in writing",
    ask: "Would a friend in the same spot want the assistance check?",
    why: "The single most quotable moment for a first-time buyer. They just found out the money is real. Specific, and specific asks travel.",
    gated: false, strength: 4,
  },
  {
    id: "under_contract", label: "Under contract", trigger: "Binding agreement executed",
    ask: "Nothing. Say congratulations and go quiet.",
    why: "They are about to be busy and anxious for thirty days. Asking here costs more than it earns, and restraint is remembered.",
    gated: false, strength: 1,
  },
  {
    id: "closing_day", label: "Closing day", trigger: "Keys handed over",
    ask: "A public review, and anyone you think I should meet",
    why: "The peak. Gratitude is highest and the memory is complete. If only one ask is ever made, it is this one.",
    gated: true, strength: 5,
  },
  {
    id: "day_30", label: "Thirty days in", trigger: "30 days after closing",
    ask: "Anything gone wrong I can help with?",
    why: "Not an ask at all. It is the check that makes the six-month ask credible, and it catches problems while they are still small.",
    gated: false, strength: 1,
  },
  {
    id: "month_6", label: "Six months in", trigger: "6 months after closing",
    ask: "A review, if you didn't leave one, and an introduction if anyone comes to mind",
    why: "Long enough that the answer is considered rather than euphoric. Reviews written here are the ones that read as real.",
    gated: true, strength: 4,
  },
  {
    id: "anniversary", label: "Anniversary", trigger: "Every year on the closing date, indefinitely",
    ask: "Here's what your home did this year. Anyone you'd send my way?",
    why: "Carries value first (an equity and tax update they did not ask for), so the ask arrives attached to something.",
    gated: true, strength: 3,
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
 * The satisfaction gate
 * ------------------------------------------------------------------ */

export type Mood = "good" | "mixed" | "bad" | null;

export interface GateResult {
  askPublicly: boolean;
  route: string;
  note: string;
}

export function gate(mood: Mood): GateResult {
  if (mood === "good")
    return {
      askPublicly: true,
      route: "Review request sent",
      note: "They said it went well. Asked once, plainly, with a direct link.",
    };
  if (mood === "mixed")
    return {
      askPublicly: false,
      route: "Raised with Kaleb",
      note: "Something is unresolved. A review request now would be asking them to publish a shrug.",
    };
  if (mood === "bad")
    return {
      askPublicly: false,
      route: "Escalated to Kaleb today",
      note: "No public ask, now or later, unless they raise it themselves. The job is to fix it.",
    };
  return { askPublicly: false, route: "Waiting on the check", note: "Nothing public goes out before they answer." };
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
  /** The private satisfaction check. Null means unanswered, not "fine". */
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
 * Financing. The second is a guess, and this is the strongest ungated ask in
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
  /** True when the trigger has fired but the private check has not been answered. */
  needsCheck: boolean;
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
 * THE GATE IS ENFORCED HERE, not at the surface that draws it. A gated moment
 * whose private check is unanswered comes back `needsCheck`, and one whose
 * check came back mixed or bad comes back `held` with the reason attached.
 * Putting that rule in a component would mean the next component to render
 * moments would have to remember it, and a rule that must be remembered is a
 * rule that has already been broken somewhere.
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
      return { moment, state: decided.state, occurrence, needsCheck: false, blockedBecause: null };
    }

    if (!triggered(moment.id, life, now)) {
      return {
        moment,
        state: "waiting" as const,
        occurrence,
        needsCheck: false,
        blockedBecause: OBSERVABLE[moment.id]
          ? null
          : "Nothing in the record says this has happened. Mark it when it has.",
      };
    }

    if (moment.gated) {
      const g = gate(life.mood);
      if (!g.askPublicly) {
        return {
          moment,
          state: life.mood === null ? ("due" as const) : ("held" as const),
          occurrence,
          needsCheck: life.mood === null,
          blockedBecause: g.note,
        };
      }
    }

    return { moment, state: "due" as const, occurrence, needsCheck: false, blockedBecause: null };
  });
}

/**
 * Whether a public ask may go out for this moment, right now.
 *
 * The one function any sending code must call. It answers false for every
 * gated moment whose private check did not come back good: including the
 * unanswered case, which is the one a truthy check on `mood` would get wrong.
 */
export function mayAskPublicly(status: MomentStatus, mood: Mood): boolean {
  if (status.state !== "due") return false;
  if (!status.moment.gated) return true;
  return gate(mood).askPublicly;
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
      /* Something waiting on an answer outranks something merely held back:
         the first is a question nobody has asked, the second is a decision
         already taken. */
      if (a.state !== b.state) return a.state === "due" ? -1 : 1;
      return b.moment.strength - a.moment.strength;
    });
}
