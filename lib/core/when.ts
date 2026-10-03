import { daysBetween, georgiaDay } from "./day";

/**
 * A number of days away from today, said the way a person says it.
 *
 * Today and the calendar used to print a raw date (`2026-09-28`) in one place
 * and "Due Mon, Sep 28, 2 days ago" in another, and "40 days ago" for a thing
 * that is really "six weeks late". Past two weeks days stop being the unit a
 * person thinks in, so it becomes weeks, and past two months, months. Negative
 * is the past, matching `daysUntil`.
 *
 * Pure: no I/O.
 */
export function relativeDay(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${spanOf(days)}` : `${spanOf(days)} ago`;
}

/**
 * How long ago a moment was, for a feed: "12 minutes ago", "3 hours ago",
 * "yesterday". A clock time ("Tue 11:04 PM") makes the agent do the
 * subtraction, and on a morning page the subtraction is the whole question.
 * Past today it counts Georgia's calendar days, so something at 11 PM last
 * night is "yesterday" at 8 AM and not "9 hours ago".
 */
export function agoFrom(at: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const days = daysBetween(georgiaDay(at), georgiaDay(now));
  if (days === 0) {
    const h = Math.floor(mins / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  return relativeDay(-days);
}

/** The same count as a length of time with no direction: "6 weeks", for "6 weeks behind". */
export function spanOf(days: number): string {
  const n = Math.abs(days);
  if (n === 1) return "1 day";
  return n < 14 ? `${n} days` : n < 60 ? `${Math.round(n / 7)} weeks` : `${Math.round(n / 30)} months`;
}
