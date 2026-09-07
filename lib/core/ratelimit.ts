/**
 * A fixed-window rate limiter.
 *
 * The public endpoints write to the database without an account, which is the
 * product's central promise and also its most obvious abuse surface. Somebody
 * with curl and a loop can fill `rift_events` in an afternoon, and the damage
 * is not the storage bill — it is that the funnel report becomes fiction, and
 * an agent makes decisions from it without knowing.
 *
 * Deliberately simple, and deliberately honest about what that costs:
 *
 *   * In-memory, so each serverless instance keeps its own count. The real
 *     limit is therefore the configured one times the number of instances. That
 *     is fine for stopping a script and useless against a distributed attacker,
 *     which is the correct trade at this scale — a Redis dependency to defend
 *     against an adversary nobody has is a worse deal.
 *   * A fixed window rather than a sliding one. A burst can straddle a boundary
 *     and get double the allowance. Also fine, and stated rather than hidden.
 *
 * When either of those stops being acceptable, the shape here is the same: swap
 * the map for a shared store and keep the interface.
 */

export interface Limit {
  /** Requests permitted per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface Verdict {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. For the Retry-After header. */
  retryAfter: number;
}

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();

/* Bounded, so a flood of unique keys cannot become the memory leak that takes
   the process down — which would hand an attacker exactly what the limiter
   exists to prevent. */
const MAX_KEYS = 10_000;

export function check(key: string, limit: Limit, now = Date.now()): Verdict {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_KEYS) {
      /* Evict expired entries first; if none are, drop the oldest. Either way
         the map cannot grow without bound. */
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
        if (buckets.size < MAX_KEYS) break;
      }
      if (buckets.size >= MAX_KEYS) buckets.delete(buckets.keys().next().value as string);
    }
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.max - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit.max - existing.count);
  return {
    allowed: existing.count <= limit.max,
    remaining,
    retryAfter: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Test seam. Nothing in the product should need this. */
export function reset() { buckets.clear(); }

/**
 * The limits, per endpoint.
 *
 * Set from what a real person plausibly does, with headroom, rather than from
 * a round number. Telemetry is generous because a single assessment legitimately
 * sends a batch every second and a half; capture is tight because submitting a
 * form forty times an hour is not a person.
 */
export const LIMITS = {
  events: { max: 120, windowMs: 60_000 },
  attribution: { max: 20, windowMs: 60_000 },
  assessment: { max: 90, windowMs: 60_000 },
  capture: { max: 8, windowMs: 60_000 },
  review: { max: 5, windowMs: 60_000 },
  readout: { max: 10, windowMs: 60_000 },
  forget: { max: 10, windowMs: 60_000 },
} as const;
