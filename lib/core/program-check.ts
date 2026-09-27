/**
 * Keeping the assistance records current (Blueprint v5 §6.5).
 *
 * A scheduled job reads each program's official page and compares it with
 * the last reading. The rules for what that means live here; the fetching
 * and storing live in lib/db/program-checks.ts.
 *
 *   unchanged   → the record still matches its source: it counts as checked
 *                 that day ("Page unchanged? Do nothing", with no staff).
 *   changed     → flagged for a person. Until someone reviews it, the record
 *                 is NOT renewed, so an unreviewed change ages out and is
 *                 withheld rather than shown against a page that says
 *                 something else.
 *   unreachable → flagged the same way. A page that is gone is a stronger
 *                 signal than a page that moved a comma.
 *   baseline    → the first reading of a page. There is nothing to compare
 *                 it with, so it proves nothing and renews nothing.
 *
 * A review names the person (handoff §4.13). "Still right" renews the record
 * on the day of the review; "Needs updating" withholds it at once, because a
 * person has just said it is wrong, and a record a person has called wrong is
 * never shown to a buyer while engineering catches up.
 *
 * Pure: no I/O. Hashing is the caller's; this only decides.
 */

import type { ProgramRecord } from "./assistance";

export type CheckOutcome = "baseline" | "unchanged" | "changed" | "unreachable";
export type ReviewOutcome = "still-right" | "needs-update";

export interface SourceCheck {
  id: string;
  sourceUrl: string;
  checkedAt: string;
  outcome: CheckOutcome;
  httpStatus: number | null;
  fingerprint: string | null;
  /** The page's readable text, kept so a reviewer can see what changed. Null for a PDF. */
  text: string | null;
  detail: string | null;
}

export interface SourceReview {
  checkId: string;
  outcome: ReviewOutcome;
  reviewedBy: string;
  reviewedAt: string;
  note: string | null;
}

/** Longest text kept per reading. A program page is a few thousand characters. */
export const MAX_TEXT = 60_000;

/**
 * The words on a page, without the parts that change on every load.
 *
 * Scripts, styles and comments go first: a session token or a cache-busting
 * query string in a script tag would otherwise make every reading "changed",
 * and a monitor that always cries wolf gets ignored inside a month. Then the
 * tags, then the entities the pages actually use, then whitespace.
 */
export function readableText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[nm]dash;/g, "-")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
}

/** What a new reading means against the last good one for the same page. */
export function classify(previous: SourceCheck | null, reading: { ok: boolean; fingerprint: string | null }): CheckOutcome {
  if (!reading.ok || !reading.fingerprint) return "unreachable";
  const last = previous?.fingerprint ?? null;
  if (!last) return "baseline";
  return last === reading.fingerprint ? "unchanged" : "changed";
}

/** The newest reading that had content, to compare the next one against. */
export function lastGood(checks: SourceCheck[], sourceUrl: string): SourceCheck | null {
  return checks
    .filter((c) => c.sourceUrl === sourceUrl && c.fingerprint)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0] ?? null;
}

/** Every distinct official page behind the records that are shown. */
export function sourcesToCheck(programs: ProgramRecord[]): string[] {
  return [...new Set(programs.filter((p) => p.status === "active").map((p) => p.sourceUrl))].sort();
}

export const needsReview = (c: SourceCheck) => c.outcome === "changed" || c.outcome === "unreachable";

export interface Flag {
  check: SourceCheck;
  /** The reading before it, for the side-by-side. */
  before: SourceCheck | null;
  programs: ProgramRecord[];
}

/** Changed or unreachable readings nobody has reviewed yet, newest first. */
export function openFlags(programs: ProgramRecord[], checks: SourceCheck[], reviews: SourceReview[]): Flag[] {
  const reviewed = new Set(reviews.map((r) => r.checkId));
  const byUrl = new Map<string, ProgramRecord[]>();
  for (const p of programs) byUrl.set(p.sourceUrl, [...(byUrl.get(p.sourceUrl) ?? []), p]);
  /* Only the newest open reading per page: three weekly "changed" readings
     of one page are one thing to review, not three. */
  const newest = new Map<string, SourceCheck>();
  const sorted = [...checks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  for (const c of sorted) {
    if (!needsReview(c) || reviewed.has(c.id) || newest.has(c.sourceUrl)) continue;
    /* A page that could not be read and has been read since was a slow
       morning, not a change. Nobody needs to look at it. */
    if (c.outcome === "unreachable" && sorted.some((x) => x.sourceUrl === c.sourceUrl && x.fingerprint && x.checkedAt > c.checkedAt)) continue;
    newest.set(c.sourceUrl, c);
  }
  return [...newest.values()].map((check) => ({
    check,
    before: checks
      .filter((c) => c.sourceUrl === check.sourceUrl && c.fingerprint && c.checkedAt < check.checkedAt)
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0] ?? null,
    programs: byUrl.get(check.sourceUrl) ?? [],
  })).filter((f) => f.programs.length);
}

/**
 * The records as the buyer should see them, after the checks.
 *
 * `checkedOn` moves forward to the latest day the source was confirmed, by an
 * unchanged reading or a "still right" review, but never past an open flag:
 * once a page has changed, later readings that match the changed page do not
 * make the old record right. An unreachable page is different: a later
 * reading that finds it again, unchanged, clears it without anyone, because
 * the page came back saying what it said before. A "needs updating" review
 * withholds the record until the record itself is newer than that review
 * (someone edited it).
 */
export function applyChecks(programs: ProgramRecord[], checks: SourceCheck[], reviews: SourceReview[]): ProgramRecord[] {
  const reviewOf = new Map(reviews.map((r) => [r.checkId, r]));
  return programs.map((p) => {
    const mine = checks.filter((c) => c.sourceUrl === p.sourceUrl && c.checkedAt.slice(0, 10) >= p.checkedOn)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
    let checkedOn = p.checkedOn;
    /* What is stopping renewal: a change nobody has reviewed, which only a
       person clears, or a failed read, which the page clears by coming back. */
    let blocked: "changed" | "unreachable" | null = null;
    let withdrawn = false;
    for (const c of mine) {
      const r = reviewOf.get(c.id);
      if (needsReview(c)) {
        if (!r) { if (blocked !== "changed") blocked = c.outcome as "changed" | "unreachable"; continue; }
        if (r.outcome === "needs-update") { withdrawn = true; blocked = "changed"; continue; }
        /* Still right: the person confirmed the record against the page as it
           now is, which clears the flag. */
        blocked = null;
        withdrawn = false;
        const day = r.reviewedAt.slice(0, 10);
        if (day > checkedOn) checkedOn = day;
        continue;
      }
      if (blocked === "unreachable") blocked = null;
      if (c.outcome === "unchanged" && !blocked) {
        const day = c.checkedAt.slice(0, 10);
        if (day > checkedOn) checkedOn = day;
      }
    }
    if (withdrawn) return { ...p, checkedOn, status: "unverified" as const, withheldReason: "A change on the official page is being written up" };
    return checkedOn === p.checkedOn ? p : { ...p, checkedOn };
  });
}

/** A short, line-level difference for the reviewer: what left and what arrived. */
export function textDiff(before: string | null, after: string | null, limit = 40): { removed: string[]; added: string[] } {
  if (before === null || after === null) return { removed: [], added: [] };
  const a = before.split("\n");
  const b = after.split("\n");
  const inA = new Set(a);
  const inB = new Set(b);
  return {
    removed: a.filter((l) => !inB.has(l)).slice(0, limit),
    added: b.filter((l) => !inA.has(l)).slice(0, limit),
  };
}
