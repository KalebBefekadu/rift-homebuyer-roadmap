import "server-only";
import { createHash } from "node:crypto";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { captureOpError } from "@/lib/monitoring/capture";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";
import { GEORGIA_PROGRAMS, isCurrent, type ProgramRecord } from "@/lib/core/assistance";
import {
  applyChecks, classify, lastGood, openFlags, readableText, sourcesToCheck,
  type CheckOutcome, type Flag, type ReviewOutcome, type SourceCheck, type SourceReview,
} from "@/lib/core/program-check";

/**
 * The only reader and writer of rift_program_checks and rift_program_reviews
 * (Blueprint v5 §6.5). The rules are lib/core/program-check.ts.
 */

const MISSING = /rift_program_(checks|reviews)|does not exist|schema cache/;

type CheckRow = {
  id: string; source_url: string; checked_at: string; outcome: CheckOutcome;
  http_status: number | null; fingerprint: string | null; body: string | null; detail: string | null;
};
type ReviewRow = { check_id: string; outcome: ReviewOutcome; reviewed_by: string; reviewed_at: string; note: string | null };

const toCheck = (r: CheckRow): SourceCheck => ({
  id: r.id, sourceUrl: r.source_url, checkedAt: r.checked_at, outcome: r.outcome,
  httpStatus: r.http_status, fingerprint: r.fingerprint, text: r.body, detail: r.detail,
});
const toReview = (r: ReviewRow): SourceReview => ({
  checkId: r.check_id, outcome: r.outcome, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, note: r.note,
});

/**
 * Readings and reviews. `withText` is for the review page only: the public
 * pages need the outcome and the day, not sixty thousand characters per page.
 * Before the migration there is nothing to read, which is "not tracked" and
 * reported as such, never as "all fine".
 */
export async function readChecks(opts: { withText?: boolean } = {}): Promise<DbResult<{ checks: SourceCheck[]; reviews: SourceReview[] } | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const cols = `id,source_url,checked_at,outcome,http_status,fingerprint,detail${opts.withText ? ",body" : ""}`;
  const [c, r] = await Promise.all([
    boundedRead(db.from("rift_program_checks").select(cols).order("checked_at", { ascending: false }).limit(500), "the program checks"),
    boundedRead(db.from("rift_program_reviews").select("check_id,outcome,reviewed_by,reviewed_at,note").limit(500), "the program reviews"),
  ]);
  if (!c.ok) return MISSING.test(c.error) ? done(null) : c;
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  const checks = (("data" in c ? c.data : []) as unknown as CheckRow[]).map((x) => toCheck({ ...x, body: x.body ?? null }));
  const reviews = (("data" in r ? r.data : []) as unknown as ReviewRow[]).map(toReview);
  return done({ checks, reviews });
}

/**
 * The records as buyers should see them today: renewed by unchanged readings
 * and reviews, withheld when a person said they need updating.
 *
 * Never fails a page. Without the checks (no database, a slow read, the
 * migration not yet applied), the records stand on the dates they were
 * written with, which is exactly the protection they had before monitoring
 * existed: they age out on schedule and are withheld with the reason shown.
 */
export async function currentPrograms(): Promise<ProgramRecord[]> {
  try {
    const { value } = await withTimeout(readChecks(), READ_DEADLINE_MS, null);
    if (!value || !value.ok || !("data" in value) || !value.data) return GEORGIA_PROGRAMS;
    return applyChecks(GEORGIA_PROGRAMS, value.data.checks, value.data.reviews);
  } catch (e) {
    captureOpError(e, { op: "programs.checks" });
    return GEORGIA_PROGRAMS;
  }
}

/** Shown, withheld for age, and withdrawn by a reviewer, for a page to explain. */
export async function programsToday(today: Date, windowDays: number) {
  const all = await currentPrograms();
  return {
    all,
    shown: all.filter((p) => isCurrent(p, today, windowDays)),
    stale: all.filter((p) => p.status === "active" && !isCurrent(p, today, windowDays)),
    withdrawn: all.filter((p) => p.withheldReason),
    found: all.filter((p) => p.status === "unverified" && !p.withheldReason),
  };
}

/** Flags waiting for a person, with the text before and after for the review page. */
export async function programFlags(): Promise<DbResult<Flag[] | null>> {
  const r = await readChecks({ withText: true });
  if (!r.ok || "skipped" in r) return r;
  if (!r.data) return done(null);
  return done(openFlags(GEORGIA_PROGRAMS, r.data.checks, r.data.reviews));
}

const sha256 = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");

/**
 * Reads one official page. A PDF is fingerprinted by its bytes and has no
 * text to show; an HTML page by its readable words, so a changed script tag
 * or a rotated banner image is not a change.
 */
export async function readSource(url: string): Promise<{ ok: boolean; status: number | null; fingerprint: string | null; text: string | null; detail: string | null }> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      /* Named, so an administrator reading their logs sees who is visiting
         once a week and why, rather than an anonymous bot. */
      headers: { "user-agent": "RiftProgramCheck/1.0 (checks this public page weekly for changes)", accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, status: res.status, fingerprint: null, text: null, detail: `the page answered ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(url)) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length) return { ok: false, status: res.status, fingerprint: null, text: null, detail: "the file was empty" };
      return { ok: true, status: res.status, fingerprint: sha256(bytes), text: null, detail: null };
    }
    const text = readableText(await res.text());
    /* A page that renders its content with JavaScript arrives nearly empty.
       Fingerprinting that would call it "unchanged" forever, which is the one
       outcome this job must never report falsely. */
    if (text.length < 200) return { ok: false, status: res.status, fingerprint: null, text: null, detail: "the page had almost no readable text" };
    return { ok: true, status: res.status, fingerprint: sha256(text), text, detail: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: null, fingerprint: null, text: null, detail: /timeout|abort/i.test(msg) ? "the page did not answer in 20 seconds" : "the page could not be reached" };
  }
}

export interface CheckRun { checked: number; unchanged: number; changed: number; unreachable: number; baseline: number }

/**
 * The weekly job. Each distinct official page is read once, however many
 * records point at it, and every reading is kept.
 */
export async function runProgramCheck(read = readSource, retryAfterMs = 5_000): Promise<DbResult<CheckRun>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const prior = await readChecks();
  if (!prior.ok) return prior;
  if ("skipped" in prior) return prior;
  if (!prior.data) return failed("the program check tables do not exist yet. Apply the migration");

  const tally: CheckRun = { checked: 0, unchanged: 0, changed: 0, unreachable: 0, baseline: 0 };
  for (const url of sourcesToCheck(GEORGIA_PROGRAMS)) {
    /* Once more before calling a page unreachable: a county server that
       takes 21 seconds one Monday morning is not news for anyone. */
    let reading = await read(url);
    if (!reading.ok) {
      await new Promise((r) => setTimeout(r, retryAfterMs));
      reading = await read(url);
    }
    const outcome = classify(lastGood(prior.data.checks, url), reading);
    const w = await boundedWrite(db.from("rift_program_checks").insert({
      source_url: url,
      outcome,
      http_status: reading.status,
      fingerprint: reading.ok ? reading.fingerprint : null,
      body: reading.ok ? reading.text : null,
      detail: reading.detail?.slice(0, 200) ?? null,
    }), "the program check");
    if (!w.ok) return failed(w.error);
    tally.checked++;
    tally[outcome]++;
  }
  return done(tally);
}

/** A named person's answer to a flagged reading. */
export async function reviewCheck(input: { checkId: string; outcome: ReviewOutcome; reviewedBy: string; note?: string | null }): Promise<DbResult<true>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!input.reviewedBy.trim()) return failed("a review needs the name of the person making it");
  const w = await boundedWrite(db.from("rift_program_reviews").insert({
    check_id: input.checkId,
    outcome: input.outcome,
    reviewed_by: input.reviewedBy.trim().slice(0, 120),
    note: input.note?.trim().slice(0, 500) || null,
  }), "the program review");
  if (!w.ok) return /duplicate|unique/i.test(w.error) ? done(true) : w;
  return done(true);
}
