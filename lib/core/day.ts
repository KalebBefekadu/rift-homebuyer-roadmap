/**
 * The calendar day in Georgia (DATE-01: a date-only value is a day, not
 * midnight UTC).
 *
 * `new Date().toISOString().slice(0, 10)` is the day in London. From eight in
 * the evening in Georgia (seven in winter) it is already tomorrow, so a task
 * due today read as overdue, a date picker's earliest day skipped today, and
 * a plan saved after dinner said it was saved the next day. Every "today"
 * taken from the clock comes from here instead.
 *
 * Pure: no I/O. Works the same on the server and in the browser, whatever
 * zone either runs in.
 */

export const GEORGIA_TZ = "America/New_York";

const formats = new Map<string, Intl.DateTimeFormat>();

/** YYYY-MM-DD in any IANA zone: a contract date keeps its own zone (DATE-01). */
export function dayIn(at: Date, timeZone: string): string {
  let f = formats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formats.set(timeZone, f);
  }
  return f.format(at);
}

const DAY_MS = 86_400_000;
/* Noon UTC is the same calendar day everywhere, so day arithmetic done there never slips one. */
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);

/** A calendar day moved by whole days. */
export const addDays = (day: string, n: number): string => new Date(noon(day) + n * DAY_MS).toISOString().slice(0, 10);

/** Whole calendar days from one day to another, negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number => Math.round((noon(to) - noon(from)) / DAY_MS);

/** YYYY-MM-DD in Georgia for the moment given, moved by whole days when asked. */
export function georgiaDay(at: Date = new Date(), plusDays = 0): string {
  const day = dayIn(at, GEORGIA_TZ);
  return plusDays ? addDays(day, plusDays) : day;
}

/**
 * Whole days from today in Georgia to a calendar day, negative once it has
 * passed. Counted in days, not hours, so something due today is not late by
 * lunchtime; counted from Georgia's day, not London's, so it is not late by
 * eight in the evening either.
 */
export const daysUntil = (day: string, now: Date = new Date()): number => daysBetween(georgiaDay(now), day);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A day for people to read. A date-only value ("2026-09-28") is that
 * calendar day wherever it is shown; a timestamp is the day it was in
 * Georgia. Without this, `new Date("2026-09-28")` is midnight in London and
 * reads as 27 September in any American browser, and a server in UTC dates
 * an evening event in Georgia the next day.
 */
export function showDay(value: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  const dateOnly = DATE_ONLY.test(value);
  return new Date(dateOnly ? `${value}T12:00:00Z` : value).toLocaleDateString("en-US", { ...opts, timeZone: dateOnly ? "UTC" : GEORGIA_TZ });
}

/** A moment for people to read, in Georgia's time, on the server and in the browser alike. */
export function showTime(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }): string {
  return new Date(iso).toLocaleString("en-US", { ...opts, timeZone: GEORGIA_TZ });
}
