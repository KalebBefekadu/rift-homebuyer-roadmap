/**
 * Whether the scheduled jobs actually ran (blueprint v4 W09; REQ-QUALITY-04,
 * AT29).
 *
 * The first version of the crons answered every scheduled call with a 405 for
 * weeks while /api/health said "scheduler: configured" (lib/core/cron.ts). A
 * configured secret is not a job that ran. So each run is recorded, and a job
 * that failed, or has not succeeded within its schedule and a grace period,
 * becomes an urgent item with an owner. It is only ever reported: nothing
 * here retries on its own or declares anything done.
 *
 * Pure. The schedules mirror vercel.json; a test holds them together.
 */

import { isBusinessDay } from "./deadline";
import { marketDay } from "./progress";

export type JobId = "nurture-run" | "retention-sweep" | "rates-refresh" | "daily-summary";

export const JOBS: Record<JobId, {
  label: string; path: string; everyHours: number; graceHours: number; matters: string;
  /** Runs Monday to Friday and not on federal holidays: a weekend is not a missed run. */
  businessDaysOnly?: boolean;
}> = {
  "nurture-run": {
    label: "Follow-up emails", path: "/api/nurture/run", everyHours: 24, graceHours: 6,
    matters: "Follow-ups that are due are not being sent.",
  },
  "retention-sweep": {
    label: "Deleting expired records", path: "/api/retention/sweep", everyHours: 24, graceHours: 6,
    matters: "Records past their retention date are not being deleted, which the privacy page promises.",
  },
  "rates-refresh": {
    label: "Weekly mortgage rate", path: "/api/rates/refresh", everyHours: 24 * 7, graceHours: 24,
    matters: "Payment figures keep using an older rate, and say so.",
  },
  "daily-summary": {
    label: "Morning summary", path: "/api/summary/run", everyHours: 24, graceHours: 6, businessDaysOnly: true,
    matters: "The morning summary email is not arriving. Everything it would say is still on Today.",
  },
};
export const JOB_IDS = Object.keys(JOBS) as JobId[];

export interface JobRun {
  job: JobId;
  ok: boolean;
  detail: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export type JobState = "ok" | "failed" | "missed" | "never" | "running";

export interface JobHealth {
  job: JobId;
  label: string;
  state: JobState;
  lastSuccess: string | null;
  lastRun: JobRun | null;
  /** The sentence for the agent: what is wrong and why it matters. Null when fine. */
  problem: string | null;
}

const HOUR = 3_600_000;
const DATE = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * A job's health from its runs. `trackingSince` is when runs began being
 * recorded: before a full period has passed since then, "no run yet" is not
 * yet a problem, because there has been nothing to miss.
 */
export function jobHealth(job: JobId, runs: JobRun[], trackingSince: string, now = new Date()): JobHealth {
  const spec = JOBS[job];
  const mine = runs.filter((r) => r.job === job).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lastRun = mine[0] ?? null;
  const lastSuccess = mine.find((r) => r.ok && r.finishedAt)?.finishedAt ?? null;
  const allowed = (spec.everyHours + spec.graceHours) * HOUR;
  const since = lastSuccess ?? trackingSince;
  const overdue = now.getTime() - Date.parse(since) > allowed + (spec.businessDaysOnly ? daysOff(since, now) * 24 * HOUR : 0);

  let state: JobState;
  let problem: string | null = null;
  if (lastRun && !lastRun.finishedAt && now.getTime() - Date.parse(lastRun.startedAt) < HOUR) state = "running";
  else if (lastRun && !lastRun.ok) {
    state = "failed";
    problem = `${spec.label} failed on ${DATE(lastRun.startedAt)}${lastRun.detail ? `: ${lastRun.detail}` : ""}. ${spec.matters}`;
  } else if (lastRun && !lastRun.finishedAt) {
    state = "failed";
    problem = `${spec.label} started on ${DATE(lastRun.startedAt)} and never finished. ${spec.matters}`;
  } else if (overdue) {
    state = lastSuccess ? "missed" : "never";
    problem = lastSuccess
      ? `${spec.label} has not run since ${DATE(lastSuccess)}. ${spec.matters}`
      : `${spec.label} has not run since runs began being recorded on ${DATE(trackingSince)}. ${spec.matters}`;
  } else state = lastSuccess ? "ok" : "never";

  return { job, label: spec.label, state, lastSuccess, lastRun, problem };
}

/** Weekend days and federal holidays after `since`, up to and including today, in Georgia. */
function daysOff(since: string, now: Date): number {
  let n = 0;
  const last = marketDay(now);
  for (let t = Date.parse(since) + 24 * HOUR, i = 0; i < 60; t += 24 * HOUR, i++) {
    const day = marketDay(new Date(t));
    if (day > last) break;
    if (!isBusinessDay(day)) n++;
  }
  return n;
}

/** The short failure text kept with a run. Never a payload: no addresses, no names. */
export function runDetail(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "unknown error");
  return text.replace(/[^\s@]+@[^\s@]+/g, "[address]").slice(0, 200);
}
