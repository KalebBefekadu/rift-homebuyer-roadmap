/**
 * Reading the week's mortgage rate out of Freddie Mac's published history.
 *
 * Pure, and deliberately suspicious.
 *
 * The rate is the assumption the most figures in this product depend on. The
 * original decision here was to type it in weekly rather than fetch it, on the
 * grounds that "a wrong rate pulled automatically is worse than a right one
 * typed weekly, because nobody is watching the automatic one". That reasoning
 * is correct and the answer is not to keep typing: it is to make the automatic
 * one watched: refuse on anything it does not fully understand, and say why.
 *
 * So every function here returns a rate OR a refusal, never a best guess. The
 * failure this guards against is not an outage: an outage is loud, and the
 * previous rate simply stays and ages. It is Freddie Mac changing the file's
 * shape and this code confidently recording the fifteen-year rate, or a
 * thousand-separator, or a header row, as the thirty-year number.
 *
 * Source: https://www.freddiemac.com/pmms/docs/PMMS_history.csv
 * Published Thursdays around noon Eastern.
 */

/** The published file. An authoritative CSV, not a page to be scraped. */
export const PMMS_HISTORY_URL = "https://www.freddiemac.com/pmms/docs/PMMS_history.csv";

/** Printed beside every figure the rate touches, so it must name the source. */
export const PMMS_SOURCE = "Freddie Mac PMMS";

/** The column holding the 30-year fixed average. Found by NAME, never position. */
export const PMMS30_COLUMN = "pmms30";
export const PMMS_DATE_COLUMN = "date";

/** Outside this band, it is a parsing error rather than a market event. */
export const MIN_PLAUSIBLE_PCT = 1;
export const MAX_PLAUSIBLE_PCT = 20;

/**
 * How far the newest published row may be behind today before we say so.
 *
 * Publication is weekly, so a fortnight means a missed week: either a holiday
 * or a file that has stopped updating. The rate is still recorded (it is still
 * the real latest rate); the run reports the gap so a file that quietly froze
 * does not read as a series of successful runs.
 */
export const PMMS_LAG_DAYS = 14;

export interface PmmsReading {
  ok: true;
  pct: number;
  /** ISO date the rate was true, from the file: never today's date. */
  asOf: string;
  /** Days between `asOf` and the day of the read. */
  lagDays: number;
  /** True when publication looks to have stalled. Recorded anyway, reported always. */
  lagging: boolean;
}

export interface PmmsRefusal {
  ok: false;
  reason: string;
}

/** Turns Freddie Mac's `M/D/YYYY` into an ISO date, or nothing. */
export function parsePmmsDate(raw: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(raw);
  if (!m) return null;
  const [, mo, d, y] = m;
  const month = Number(mo), day = Number(d), year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  /* Round-tripped through Date so 2/30 is rejected rather than stored. A date
     that does not exist would otherwise become an `as_of` nobody can reconcile
     against the published file. */
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const back = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(back.getTime()) || back.getUTCDate() !== day || back.getUTCMonth() + 1 !== month) return null;
  return iso;
}

/**
 * The newest usable 30-year rate in the file.
 *
 * Refuses rather than guesses when: the file is empty, the header does not name
 * the columns we need, no row carries a plausible rate, or the newest row is
 * dated in the future.
 */
export function readPmms(csv: string, today = new Date()): PmmsReading | PmmsRefusal {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, reason: "the file had no rows" };

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const rateAt = header.indexOf(PMMS30_COLUMN);
  const dateAt = header.indexOf(PMMS_DATE_COLUMN);

  /* The whole point of the guard. Freddie Mac reordering or renaming a column
     is the one change that would otherwise be silent, and taking the wrong
     column means recording the fifteen-year rate as the thirty-year one:
     roughly seventy basis points, on every monthly figure in the product. */
  if (rateAt < 0) return { ok: false, reason: `the file has no "${PMMS30_COLUMN}" column; its shape has changed` };
  if (dateAt < 0) return { ok: false, reason: `the file has no "${PMMS_DATE_COLUMN}" column; its shape has changed` };

  /* Newest last, but read upward rather than trusting that. The trailing rows
     carry blanks for products that have been discontinued, and an ordering
     assumption is a thing that can quietly stop being true. */
  let best: { pct: number; asOf: string } | null = null;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",");
    const asOf = parsePmmsDate(cells[dateAt] ?? "");
    if (!asOf) continue;

    const raw = (cells[rateAt] ?? "").trim();
    if (!raw) continue;
    const pct = Number(raw);
    if (!Number.isFinite(pct) || pct < MIN_PLAUSIBLE_PCT || pct > MAX_PLAUSIBLE_PCT) continue;

    if (!best || asOf > best.asOf) best = { pct, asOf };
  }

  if (!best) return { ok: false, reason: "no row in the file carried a plausible 30-year rate" };

  const lagDays = Math.floor(
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
      new Date(`${best.asOf}T00:00:00Z`).getTime()) / 86_400_000,
  );

  /* A rate dated in the future is not a rate. Recording one would make the
     product's freshness check permanently, wrongly green. */
  if (lagDays < 0) return { ok: false, reason: `the newest row is dated ${best.asOf}, which is in the future` };

  return { ok: true, pct: best.pct, asOf: best.asOf, lagDays, lagging: lagDays > PMMS_LAG_DAYS };
}
