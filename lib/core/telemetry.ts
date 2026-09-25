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
 *   2. `sanitise()` keeps only the keys on ALLOWED_META.
 *   3. A CHECK constraint on `rift_events` enforces the same list in the
 *      database, so a row written by anything other than this module is
 *      rejected outright.
 * Layers 2 and 3 were both blocklists and both failed open on the same key.
 * They are allowlists now, and they are kept identical on purpose: see
 * telemetry.test.ts, which fails when the migration and this file disagree.
 */

export const EVENT_NAMES = [
  "landing_view", "hero_answer", "assessment_start", "question_view",
  "question_answer", "assessment_abandon", "assessment_resume", "readout_view",
  "email_capture", "share_sent", "booking_start", "booking_complete",
  "review_requested", "data_deleted",
  /* Blueprint v5 §5.1: one value (small tool) opened, and its answer shown. */
  "value_view", "value_answer",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface EventInput {
  sessionId: string;
  name: EventName;
  side?: "buy" | "sell";
  /** Which question, never what was said. */
  questionKey?: string;
  dwellMs?: number;
  /** Counts and flags only. Anything not on ALLOWED_META is dropped. */
  meta?: Record<string, string | number | boolean>;
}

/**
 * The keys telemetry is allowed to carry. Everything else is dropped.
 *
 * This was a blocklist: `value`, `answer`, `input`, `email`, `phone` and a
 * few more, and a blocklist fails open, which is a property you find out
 * about afterwards. The buyers-abroad landing page sent
 * `{ page, status, use }` on every view, and `status` there is the visitor's
 * residency situation: citizen, resident, ITIN, or no U.S. status at all. It
 * was not on the list, so it went through `sanitise`, through a type that
 * "has no field that could hold an answer", and through a CHECK constraint
 * that only rejected three literal key names: all three layers, into an
 * analytics table keyed on a session that joins to a lead.
 *
 * Residency status is about as close a proxy for national origin as this
 * product could collect, and national origin is a protected class under the
 * Fair Housing Act. The page was carefully designed to target a situation
 * rather than an ethnicity, and then logged the situation.
 *
 * An allowlist cannot fail that way. Adding a key is now a deliberate act
 * with a diff, which is exactly the moment somebody should have to think
 * about whether it is an answer.
 *
 * Note what is NOT here: `status`. In this product that word means somebody's
 * situation, and the one legitimate use: the readout's computed readiness
 * band: is called `band` precisely so the ambiguous word never appears in a
 * payload again.
 */
export const ALLOWED_META = [
  /* Which surface, which question, how far through. */
  "page", "qid", "step", "of", "from", "via",
  /* Counts and flags about what the product did, not what the person said. */
  "answered", "matched", "source", "band", "prefilled", "live",
  "hasTopic", "delivered", "consent", "slot",
  /* Which value (small tool), by id. Never an answer to it. */
  "tool",
] as const;

const ALLOWED = new Set<string>(ALLOWED_META);

export function sanitise(meta: Record<string, unknown> | undefined) {
  const out: Record<string, string | number | boolean> = {};
  if (!meta) return out;
  for (const [k, v] of Object.entries(meta)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function isEventName(n: string): n is EventName {
  return (EVENT_NAMES as readonly string[]).includes(n);
}
