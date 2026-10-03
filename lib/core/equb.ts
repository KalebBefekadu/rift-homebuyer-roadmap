/**
 * The Equb page's example group.
 *
 * The page shows "24 families, $2,000 a month, 24 months, about $48,000 each".
 * A figure typed into JSX is a figure that stops agreeing with its neighbours
 * the first time somebody edits one of them, so the payout is computed here
 * from the other three, and the test pins the arithmetic. Same rule as every
 * other number a visitor sees: computed, never written by hand.
 *
 * It is an illustration of how a rotating savings group works and nothing
 * more. It promises no outcome, and it does not model fees, interest, or what
 * happens when somebody misses a month, because none of those are decided.
 */

export interface EqubExample {
  members: number;
  monthly: number;
  months: number;
}

export const EQUB_EXAMPLE: EqubExample = { members: 24, monthly: 2_000, months: 24 };

/**
 * What one member receives in their turn: everybody's contribution for one
 * month. In a classic Equb every member is paid once, so the cycle is as many
 * months as there are members; a group where those differ is not an Equb
 * and gets no payout figure rather than a wrong one.
 */
export function equbPayout(e: EqubExample): number | null {
  const ok = [e.members, e.monthly, e.months].every((n) => Number.isFinite(n) && n > 0 && Number.isInteger(n));
  if (!ok || e.members !== e.months) return null;
  return e.members * e.monthly;
}

/** What one member puts in over the whole cycle. Equal to the payout: nobody gains or loses money by being early or late, only time. */
export function equbTotalIn(e: EqubExample): number {
  return e.monthly * e.months;
}

/** The two options a seat request can pick for a timeline, spelled the way the lead scorer reads them. */
export const EQUB_TIMELINES = ["In the next 3 months", "3 to 9 months", "9 to 18 months", "Just exploring"] as const;

/**
 * The one-line note the agent sees beside an Equb lead. Household and language
 * are not scored and not telemetry: they exist so the first call is in the
 * right language to the right-sized family.
 */
export function equbNote(a: { household: string; language: string; price: string }): string {
  return ["Equb seat request", a.household && `household of ${a.household}`, `prefers ${a.language}`, a.price && `target ${a.price}`]
    .filter(Boolean)
    .join(" · ");
}

/** "$350,000", "350000" or "350k" to dollars; null when it cannot be read as a plausible price. */
export function parsePrice(raw: string): number | null {
  const m = raw.trim().toLowerCase().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return n >= 10_000 && n <= 20_000_000 ? Math.round(n) : null;
}
