/**
 * Rift prototype — the nurture cadence engine.
 *
 * The gap this closes: leads were being *classified* for nurture and then
 * nothing happened. A band is a label. A label does not follow anybody up, and
 * the majority of a solo agent's revenue is sitting in people who were not
 * ready the week they arrived and were never spoken to again.
 *
 * Four rules are load-bearing here, and each exists because breaking it is how
 * automated follow-up turns into the thing people mute:
 *
 *   1. EVERY TOUCH CARRIES NEW VALUE. Not a nudge, not "just checking in".
 *      If a step has nothing to say, the step should not exist. Each one below
 *      names what it gives the person; a step with no `gives` is a defect.
 *
 *   2. A HUMAN REPLY STOPS THE SEQUENCE. Immediately, not after the current
 *      step. Software that keeps sending after somebody answered is the single
 *      fastest way to prove there was never a person on this end.
 *
 *   3. CONSENT GATES THE CHANNEL, NOT THE SEQUENCE. No written phone consent
 *      means the text step becomes an email step. It does not mean silence,
 *      and it does not mean sending the text anyway.
 *
 *   4. INTERVALS WIDEN. A cadence that repeats at a fixed spacing reads as a
 *      machine by the third touch. Real attention decays and so should this.
 */

import type { Band } from "./lead";

export type Channel = "email" | "text" | "call" | "task";

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  text: "Text",
  call: "Call",
  task: "Task for Kaleb",
};

export interface Step {
  id: string;
  /** Days after the person entered the sequence. */
  day: number;
  channel: Channel;
  /** The subject line, or the first sentence if it is a call. */
  says: string;
  /**
   * What this touch GIVES them. Rule 1. If you cannot fill this in, delete
   * the step rather than writing "checking in" — that is the whole point.
   */
  gives: string;
  /** Sent without the agent, or queued for him. */
  auto: boolean;
}

export interface Sequence {
  band: Band;
  name: string;
  why: string;
  steps: Step[];
  /** What happens after the last step. Sequences must end somewhere. */
  ends: string;
}

/** Any of these stops the sequence dead, mid-flight. Rule 2. */
export const STOPS = [
  { id: "replied", label: "They replied", why: "A conversation started. Everything queued behind it is now noise." },
  { id: "booked", label: "They booked a call", why: "The sequence achieved its purpose. Continuing would undo it." },
  { id: "converted", label: "They became a client", why: "They are on a plan now. The plan is the follow-up." },
  { id: "declined", label: "They said not now", why: "Honour it. One dated re-entry at their own stated horizon, nothing before." },
  { id: "unsubscribed", label: "They opted out", why: "Immediate and total, across every channel, no exceptions." },
  { id: "bounced", label: "Their email bounced", why: "Silence that looks like disinterest but is a dead address. Becomes an agent task." },
] as const;

export type StopId = (typeof STOPS)[number]["id"];

/* ------------------------------------------------------------------ *
 * The sequences
 * ------------------------------------------------------------------ */

export const SEQUENCES: Sequence[] = [
  {
    band: "now",
    name: "Same-week close of loop",
    why: "They are transacting inside 90 days. The only job is getting a conversation booked before somebody else does. Short, and it stops the moment a human replies.",
    ends: "After day 9, drops to the 'This week' cadence rather than going quiet.",
    steps: [
      { id: "n1", day: 0, channel: "email", auto: true, says: "Your readout, and the one number that decides your timeline", gives: "The readout itself, permanently linked. They keep it whether or not they answer." },
      { id: "n2", day: 1, channel: "text", auto: false, says: "Two windows this week if you want to go through it — Wed 6pm or Thu 12pm.", gives: "Two concrete times. An open-ended 'let me know when' is a decision they have to make alone." },
      { id: "n3", day: 3, channel: "call", auto: false, says: "One call. Voicemail if not — say the gap figure out loud so it lands.", gives: "The actual answer to the thing they asked about, spoken." },
      { id: "n4", day: 6, channel: "email", auto: true, says: "The two programs you matched, and what each would need from you", gives: "The matched assistance, itemised — new information, not a repeat of the readout." },
      { id: "n5", day: 9, channel: "task", auto: false, says: "Decide: still live, or move to the slower cadence?", gives: "An honest reclassification instead of a permanent 'urgent' that stops meaning anything." },
    ],
  },
  {
    band: "soon",
    name: "Three-month readiness",
    why: "They are 3 to 9 months out and genuinely working on it. Value beats urgency here — the person who taught them something is the person they call when they are ready.",
    ends: "Rolls into the long horizon after day 45 unless something changed.",
    steps: [
      { id: "s1", day: 0, channel: "email", auto: true, says: "Your readout, and the one number that decides your timeline", gives: "The readout itself, permanently linked." },
      { id: "s2", day: 2, channel: "email", auto: true, says: "What actually moves your closing date — ranked", gives: "The specific levers from their own numbers, ordered by how much each moves the date." },
      { id: "s3", day: 9, channel: "text", auto: false, says: "Rates moved this week. Here is what it does to your monthly.", gives: "A recomputed monthly figure, only sent when the change is material." },
      { id: "s4", day: 21, channel: "email", auto: true, says: "The assistance programs in your county, and their deadlines", gives: "Deadlines they would otherwise miss. This is the touch that most often gets replied to." },
      { id: "s5", day: 45, channel: "call", auto: false, says: "Checkpoint — are the numbers still the numbers?", gives: "A re-run of their assessment against what has changed since." },
    ],
  },
  {
    band: "later",
    name: "Long horizon",
    why: "Nine months to two years. The failure mode is talking to them monthly until they mute you. Four touches a year, each one worth opening, is worth more than twenty that are not.",
    ends: "Repeats quarterly, indefinitely, until a stop fires.",
    steps: [
      { id: "l1", day: 0, channel: "email", auto: true, says: "Your readout — keep this, it stays live", gives: "The readout itself, permanently linked." },
      { id: "l2", day: 14, channel: "email", auto: true, says: "The savings target that gets you there fastest", gives: "A monthly figure derived from their own gap and their own stated date." },
      { id: "l3", day: 90, channel: "email", auto: true, says: "Quarter check — what changed in your county", gives: "Local price and programme movement, recomputed against their saved position." },
      { id: "l4", day: 180, channel: "email", auto: true, says: "Half-year: your gap, recomputed", gives: "The single figure they cared about, updated, with no ask attached." },
    ],
  },
  {
    band: "nurture",
    name: "Dormant",
    why: "Incomplete assessment, no contact detail, or explicitly not now. Two touches, both useful, then stop. A list you cannot stop sending to is not a list, it is a liability.",
    ends: "Stops. Re-entry only if they come back on their own.",
    steps: [
      { id: "d1", day: 1, channel: "email", auto: true, says: "You were most of the way through — here is what you had so far", gives: "Their partial answers, resumable in one tap. Recovery, not pursuit." },
      { id: "d2", day: 30, channel: "email", auto: true, says: "Still here if it becomes useful. Nothing needed.", gives: "A standing door and an explicit end. Says outright that this is the last one." },
    ],
  },
];

export const sequenceFor = (band: Band) => SEQUENCES.find((s) => s.band === band) ?? SEQUENCES[3];

/* ------------------------------------------------------------------ *
 * Resolving a step for a real person
 * ------------------------------------------------------------------ */

export interface Enrolment {
  leadId: string;
  name: string;
  band: Band;
  /** Days since they entered the sequence. */
  daysIn: number;
  /** Set once any stop fires. A live enrolment has none. */
  stopped: StopId | null;
  /** Written phone consent on file. Gates the text channel — rule 3. */
  phoneConsent: boolean;
  /** Steps already sent. */
  done: string[];
}

export interface Due {
  e: Enrolment;
  step: Step;
  /** The channel after consent is applied, which may differ from the step's. */
  channel: Channel;
  /** Set when the channel was downgraded, so the agent can see why. */
  downgraded: string | null;
  /** Days late. Zero is on time. */
  late: number;
}

/**
 * Consent gates the channel, not the sequence. A text step for somebody with
 * no written consent becomes an email step — it does not get sent as a text
 * and it does not get silently dropped.
 */
export function resolveChannel(step: Step, phoneConsent: boolean) {
  if (step.channel === "text" && !phoneConsent) {
    return { channel: "email" as Channel, downgraded: "No written phone consent on file — sent as email instead." };
  }
  return { channel: step.channel, downgraded: null };
}

export function dueFor(e: Enrolment): Due | null {
  if (e.stopped) return null;
  const seq = sequenceFor(e.band);
  const pending = seq.steps.filter((s) => !e.done.includes(s.id) && s.day <= e.daysIn);
  if (!pending.length) return null;
  const step = pending[0];
  const { channel, downgraded } = resolveChannel(step, e.phoneConsent);
  return { e, step, channel, downgraded, late: e.daysIn - step.day };
}

/** Everything owed today, most overdue first. */
export function queue(rows: Enrolment[]): Due[] {
  return rows.map(dueFor).filter((d): d is Due => d !== null).sort((a, b) => b.late - a.late);
}

export function nextFor(e: Enrolment): { step: Step; inDays: number } | null {
  if (e.stopped) return null;
  const seq = sequenceFor(e.band);
  const ahead = seq.steps.filter((s) => !e.done.includes(s.id) && s.day > e.daysIn);
  return ahead.length ? { step: ahead[0], inDays: ahead[0].day - e.daysIn } : null;
}

export const stopLabel = (id: StopId) => STOPS.find((s) => s.id === id)!;

/** Share of touches that go out without the agent. The leverage number. */
export function autonomy(band: Band) {
  const s = sequenceFor(band).steps;
  return { auto: s.filter((x) => x.auto).length, total: s.length };
}
