import "server-only";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { cronRefusal } from "./guard";
import { done, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { captureOpError } from "@/lib/monitoring/capture";
import { JOB_IDS, jobHealth, runDetail, type JobHealth, type JobId, type JobRun } from "@/lib/core/jobs";

/**
 * Recording scheduled-job runs (blueprint v4 W09; REQ-QUALITY-04, AT29). The
 * only writer of rift_job_runs.
 *
 * `trackedCron` wraps a cron handler: a run is recorded when it starts and
 * marked with how it ended. A request the secret refuses is not a run and is
 * not recorded (a stranger cannot fill the table), and neither is a dry run
 * (a person checking the job by hand is not the schedule working).
 *
 * If recording fails, the job still runs. Tracking is how a failure is seen;
 * it must never be the cause of one.
 */

/** When runs began being recorded (this release). Before a full schedule has passed since, "no run yet" is not a problem. */
export const TRACKING_SINCE = "2026-09-24T12:00:00Z";

export function trackedCron(job: JobId, handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (cronRefusal(req)) return handler(req);
    const dry = new URL(req.url).searchParams.get("dry");
    if (dry !== null && dry !== "0" && dry.toLowerCase() !== "false") return handler(req);

    const db = serviceClient();
    let id: string | null = null;
    if (db) {
      const r = await boundedWrite(db.from("rift_job_runs").insert({ job }).select("id").single(), "the job run");
      if (r.ok && "data" in r) id = (r.data as { id: string }).id;
      else if (!r.ok && !journeyTablesMissing(r.error) && !/rift_job_runs/.test(r.error)) captureOpError(new Error(r.error), { op: "jobs.start", extra: { job } });
    }

    let ok = false;
    let detail: string | null = null;
    let res: Response;
    try {
      res = await handler(req);
      const body = (await res.clone().json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      ok = res.ok && body?.ok === true;
      detail = ok ? null : runDetail(body?.error ?? `answered ${res.status}`);
    } catch (e) {
      detail = runDetail(e);
      if (db && id) await boundedWrite(db.from("rift_job_runs").update({ ok: false, detail, finished_at: new Date().toISOString() }).eq("id", id), "the job run");
      throw e;
    }
    if (db && id) {
      const f = await boundedWrite(db.from("rift_job_runs").update({ ok, detail, finished_at: new Date().toISOString() }).eq("id", id), "the job run");
      if (!f.ok) captureOpError(new Error(f.error), { op: "jobs.finish", extra: { job } });
    }
    return res;
  };
}

/** Every job's health, for the agent's Today and /api/health. */
export async function jobsHealth(now = new Date()): Promise<DbResult<JobHealth[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_job_runs").select("job,ok,detail,started_at,finished_at").order("started_at", { ascending: false }).limit(60),
    "the scheduled jobs",
  );
  /* Before the migration there is nothing to read. Say "not tracked" (null),
     not "all fine". */
  if (!r.ok) return /rift_job_runs|does not exist|schema cache/.test(r.error) ? done(null) : r;
  const runs: JobRun[] = (("data" in r ? r.data : []) as Record<string, unknown>[]).map((x) => ({
    job: x.job as JobId, ok: x.ok as boolean, detail: (x.detail as string | null) ?? null,
    startedAt: x.started_at as string, finishedAt: (x.finished_at as string | null) ?? null,
  }));
  return done(JOB_IDS.map((j) => jobHealth(j, runs, TRACKING_SINCE, now)));
}
