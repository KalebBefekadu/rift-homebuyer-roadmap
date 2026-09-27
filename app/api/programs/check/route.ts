import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/db/guard";
import { trackedCron } from "@/lib/db/jobs";
import { readSource, runProgramCheck } from "@/lib/db/program-checks";
import { GEORGIA_PROGRAMS } from "@/lib/core/assistance";
import { sourcesToCheck } from "@/lib/core/program-check";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The weekly program check (Blueprint v5 §6.5). Mondays.
 *
 * Reads each assistance program's official page and compares it with the last
 * reading. Unchanged pages renew their records; a changed or unreachable page
 * becomes an item on Operations Today, and its records stop being renewed
 * until a named person has looked (lib/core/program-check.ts).
 *
 * No AI in this path. A changed page is shown to a person as the lines that
 * left and the lines that arrived; comparing them with a model is a later
 * step, inside the monthly AI limit (D16).
 *
 * `?dry=1` reads every page and answers with what each reading would be,
 * writing nothing.
 */
async function run(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;

  const dry = new URL(req.url).searchParams.get("dry");
  if (dry !== null && dry !== "0" && dry.toLowerCase() !== "false") {
    const pages = [];
    for (const url of sourcesToCheck(GEORGIA_PROGRAMS)) {
      const r = await readSource(url);
      pages.push({ url, ok: r.ok, status: r.status, chars: r.text?.length ?? null, detail: r.detail });
    }
    return NextResponse.json({ ok: true, dry: true, pages });
  }

  const r = await runProgramCheck();
  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "programs.check" });
    return NextResponse.json({ ok: false, error: r.error });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  /* A page that could not be read is not a failed run: the run did its job,
     which was to find that out and put it in front of a person. */
  return NextResponse.json({ ok: true, ...r.data });
}

/* Both verbs: Vercel's scheduler sends GET (lib/core/cron.ts). */
const tracked = trackedCron("program-check", run);
export const GET = tracked;
export const POST = tracked;
