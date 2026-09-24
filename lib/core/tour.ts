/**
 * Tours (blueprint v4, W06; journey contract B06; REQ-SEARCH-07 and 08).
 *
 * A showing is arranged in ShowingTime, not here. Rift has no ShowingTime
 * access for this account (decision D02), so this module is the record of
 * what the agent did there and what came back, and it never claims more than
 * that record says:
 *
 *   - A request is not an appointment. A stop stays "requested" or "waiting
 *     for a time" until the agent records a confirmed time from ShowingTime,
 *     whatever sits in anybody's calendar (AT17).
 *   - Going ahead needs a signed, in-force buyer agreement and the home still
 *     on the list, checked again at every step rather than once at the start.
 *     A stop already confirmed shows as blocked, with the fix, the moment
 *     either stops being true (AT18). Today's rule is lib/core/representation
 *     ("the thing to fix before showing anybody a home"); the broker's answer
 *     on when an agreement is required (decision D06) replaces it, not this.
 *   - Access and lockbox details are never stored. They stay in ShowingTime.
 *
 * Pure, like every rule in lib/core. The history is a list of steps, one row
 * each, never edited; the current state is the latest step.
 */

export type TourStatus =
  | "requested" | "awaiting-confirmation" | "confirmed" | "changed" | "cancelled" | "completed";

export const TOUR_STATUSES: TourStatus[] = [
  "requested", "awaiting-confirmation", "confirmed", "changed", "cancelled", "completed",
];

/** How each status reads to the agent. */
export const TOUR_LABEL: Record<TourStatus, string> = {
  requested: "Requested",
  "awaiting-confirmation": "Asked in ShowingTime, no time yet",
  confirmed: "Confirmed",
  changed: "Time changed, not reconfirmed",
  cancelled: "Cancelled",
  completed: "Seen",
};

/** What the agent can record next from each status. The listing side
 *  proposing a different time is "changed", which needs confirming again. */
export const NEXT: Record<TourStatus, TourStatus[]> = {
  requested: ["awaiting-confirmation", "cancelled"],
  "awaiting-confirmation": ["confirmed", "cancelled"],
  confirmed: ["changed", "completed", "cancelled"],
  changed: ["confirmed", "cancelled"],
  cancelled: [],
  completed: [],
};

export const isOpen = (s: TourStatus) => s !== "cancelled" && s !== "completed";

/** The longest a single showing slot may be. Anything longer is a typo. */
export const MAX_SLOT_MINUTES = 240;
export const AVAILABILITY_MAX = 300;
export const NOTE_MAX = 500;
export const REF_MAX = 200;
/** Rift works in the agent's market. */
export const TOUR_TIMEZONE = "America/New_York";

export interface TourStep {
  seq: number;
  status: TourStatus;
  startsAt: string | null;
  endsAt: string | null;
  ref: string | null;
  note: string | null;
  by: string;
  at: string;
}

export interface StepInput {
  to: TourStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  ref?: string | null;
  note?: string | null;
}

/** What is true about the world when a step is recorded or a stop is shown. */
export interface TourContext {
  /** A signed agreement in force today (lib/core/representation `standingOf`). */
  covered: boolean;
  /** Why not, in the representation module's own words. */
  coverageNote: string;
  /** The home came off the shortlist. */
  homeWithdrawn: boolean;
}

/**
 * Why a step may not be recorded, or null when it may.
 *
 * Moving TOWARD the showing (asking in ShowingTime, confirming a time) needs
 * cover and a home still on the list. Moving AWAY from it (cancelling,
 * recording that it happened, or that the time changed) never does: the
 * record of what happened is always writable, especially when something has
 * gone wrong.
 */
export function stepError(current: TourStatus, input: StepInput, ctx: TourContext): string | null {
  if (!NEXT[current].includes(input.to)) {
    return current === "cancelled" || current === "completed"
      ? "This showing is finished. Request a new one instead"
      : `A showing that is "${TOUR_LABEL[current].toLowerCase()}" cannot become "${TOUR_LABEL[input.to].toLowerCase()}"`;
  }
  const forward = input.to === "awaiting-confirmation" || input.to === "confirmed";
  if (forward && ctx.homeWithdrawn) return "That home is off the list. Cancel this showing instead";
  if (forward && !ctx.covered) {
    return `No showing can go ahead without a signed buyer agreement in force. ${ctx.coverageNote}`;
  }
  if (input.to === "confirmed" || input.to === "changed") {
    const bad = slotError(input.startsAt ?? null, input.endsAt ?? null);
    if (bad) return bad;
  }
  if (input.to === "cancelled" && !input.note?.trim()) return "Say why it was cancelled, in a few words";
  if (input.note && input.note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters`;
  if (input.ref && input.ref.length > REF_MAX) return `Keep the reference under ${REF_MAX} characters`;
  return null;
}

export function slotError(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt || !endsAt) return "Give the date and the start and end times from ShowingTime";
  const s = Date.parse(startsAt), e = Date.parse(endsAt);
  if (Number.isNaN(s) || Number.isNaN(e)) return "That time could not be read";
  if (e <= s) return "The end time must be after the start time";
  if ((e - s) / 60_000 > MAX_SLOT_MINUTES) return "A showing slot longer than four hours is probably a typo";
  return null;
}

/**
 * A wall-clock date and time in a time zone, as a UTC instant.
 *
 * The agent types what ShowingTime shows him: "Sat Oct 3, 2:00 PM" in Georgia.
 * Stored as an instant so the buyer's page, a phone abroad, and a summer/winter
 * change all read the same moment. Found by asking Intl what that zone's clock
 * says at a guessed instant and correcting by the difference; twice, so a
 * time on a daylight-saving boundary settles.
 */
export function zonedToUtc(date: string, time: string, timeZone = TOUR_TIMEZONE): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const want = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!);
  if (Number.isNaN(want)) return null;
  const clock = (ms: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!);
  };
  let guess = want;
  for (let i = 0; i < 2; i++) guess += want - clock(guess);
  return new Date(guess).toISOString();
}

/** "Sat, Oct 3, 2:00 to 2:30 PM" in the agent's market, for both screens. */
export function slotLabel(startsAt: string, endsAt: string, timeZone = TOUR_TIMEZONE): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(startsAt));
  const t = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const a = t(startsAt), b = t(endsAt);
  const sameHalf = a.slice(-2) === b.slice(-2);
  return `${day}, ${sameHalf ? a.slice(0, -3) : a} to ${b}`;
}

export interface TourView {
  status: TourStatus;
  /** The latest confirmed or proposed slot, when there is one. */
  slot: { startsAt: string; endsAt: string } | null;
  /** Something stops this showing going ahead as recorded. Null when nothing does. */
  blocked: string | null;
  /** The slot has passed and nobody has said what happened. */
  overdue: boolean;
  /** Where the agent should go next, in his words. */
  nextStep: string;
}

/**
 * What a stop means now, from its steps and the world around it.
 *
 * Like `standingOf`, this derives rather than stores: a confirmed showing on
 * an agreement that lapsed yesterday is blocked today, and nothing needs to
 * have written that down for it to be true.
 */
export function viewOf(steps: TourStep[], ctx: TourContext, now = new Date()): TourView {
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);
  const latest = ordered[ordered.length - 1];
  const status: TourStatus = latest?.status ?? "requested";
  const withSlot = [...ordered].reverse().find((s) => s.startsAt && s.endsAt);
  const slot = isOpen(status) && withSlot ? { startsAt: withSlot.startsAt!, endsAt: withSlot.endsAt! } : null;

  let blocked: string | null = null;
  if (isOpen(status)) {
    if (ctx.homeWithdrawn) blocked = "The home is off the list. Cancel this showing in ShowingTime, then here.";
    else if (!ctx.covered && status !== "requested") {
      blocked = `This showing cannot go ahead: there is no signed buyer agreement in force. ${ctx.coverageNote} Renew it, or cancel the showing.`;
    }
  }

  const overdue = status === "confirmed" && slot !== null && Date.parse(slot.endsAt) < now.getTime();

  const nextStep = blocked
    ? blocked
    : status === "requested"
      ? ctx.covered
        ? "Request it in ShowingTime, then record that you did."
        : `Before asking for a time: ${ctx.coverageNote}`
      : status === "awaiting-confirmation"
        ? "Record the time once ShowingTime confirms it."
        : status === "changed"
          ? "The listing side changed the time. Confirm the new one with the buyer, then record it."
          : status === "confirmed"
            ? overdue ? "The time has passed. Record that it happened, or that it was cancelled." : "Nothing until the showing."
            : status === "completed"
              ? "Ask for their answer: would they consider an offer, or should the search change?"
              : "Nothing. It is cancelled.";

  return { status, slot, blocked, overdue, nextStep };
}

/** How a stop reads on the buyer's page. Never the reason for a block: that
 *  is a conversation for the agent to have, not a line on a screen. */
export function buyerLabel(view: TourView, agentFirst: string): string {
  if (view.blocked) return `On hold. ${agentFirst} will be in touch before this goes ahead.`;
  switch (view.status) {
    case "requested": return `Requested. ${agentFirst} will ask the listing side for a time.`;
    case "awaiting-confirmation": return `${agentFirst} has asked for a time. Not confirmed yet.`;
    case "changed": return `The time changed. ${agentFirst} will confirm the new one with you.`;
    case "confirmed": return view.slot ? `Confirmed: ${slotLabel(view.slot.startsAt, view.slot.endsAt)}.` : "Confirmed.";
    case "completed": return "Seen.";
    case "cancelled": return "Cancelled.";
  }
}

/* ------------------------------------------------------------------ *
 * After the showing (REQ-SEARCH-08)
 * ------------------------------------------------------------------ */

export type OfferInterest = "yes" | "maybe" | "no";

export const OFFER_LABEL: Record<OfferInterest, string> = {
  yes: "Yes, would consider an offer",
  maybe: "Maybe",
  no: "No, not this one",
};

export interface FeedbackInput {
  offer: OfferInterest;
  reason: string | null;
  /** What should change in the search, if anything. A note for the agent,
   *  never an edit to the brief: that is a new revision he approves. */
  searchChange: string | null;
}

export function feedbackError(f: FeedbackInput): string | null {
  if (!["yes", "maybe", "no"].includes(f.offer)) return "Choose an answer";
  if (f.reason && f.reason.length > NOTE_MAX) return `Keep the reason under ${NOTE_MAX} characters`;
  if (f.searchChange && f.searchChange.length > NOTE_MAX) return `Keep it under ${NOTE_MAX} characters`;
  return null;
}
