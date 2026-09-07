/**
 * What telemetry is allowed to carry.
 *
 * Pure, and in the domain layer rather than beside the database call, for one
 * practical reason: these are the rules that decide whether a stranger's
 * finances end up in an analytics store, and a rule that can only be exercised
 * against a live Postgres is a rule that gets tested once and then trusted.
 *
 * The privacy rule is enforced three times over, deliberately:
 *   1. `EventInput` has no field that could hold an answer.
 *   2. `sanitise()` strips anything answer-shaped before the write.
 *   3. A CHECK constraint on `rift_events` rejects the row outright.
 * The first two are guidance a future caller can route around. Only the third
 * is a guarantee — but the first two are where the mistake gets caught early.
 */

export const EVENT_NAMES = [
  "landing_view", "hero_answer", "assessment_start", "question_view",
  "question_answer", "assessment_abandon", "assessment_resume", "readout_view",
  "email_capture", "share_sent", "booking_start", "booking_complete",
  "review_requested", "data_deleted",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface EventInput {
  sessionId: string;
  name: EventName;
  side?: "buy" | "sell";
  /** Which question, never what was said. */
  questionKey?: string;
  dwellMs?: number;
  /** Counts and flags only. Anything answer-shaped is dropped. */
  meta?: Record<string, string | number | boolean>;
}

/**
 * Keys that would carry an answer, however innocently they got there.
 *
 * `email` and `name` are on this list because they are almost always somebody
 * being helpful — and a stranger's address in an analytics payload is still a
 * stranger's address in an analytics store.
 */
const FORBIDDEN = new Set([
  "value", "answer", "input", "text", "amount", "savings", "price",
  "email", "phone", "name", "address",
]);

export function sanitise(meta: Record<string, unknown> | undefined) {
  const out: Record<string, string | number | boolean> = {};
  if (!meta) return out;
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN.has(k.toLowerCase())) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function isEventName(n: string): n is EventName {
  return (EVENT_NAMES as readonly string[]).includes(n);
}
