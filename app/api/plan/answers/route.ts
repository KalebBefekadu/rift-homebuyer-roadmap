import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { recordCustomAnswers } from "@/lib/db/questions";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The agent's own questions, answered after "Save my plan" (D37).
 *
 * Asked only once the plan is saved, so they can never cost the capture, and
 * optional: skipping them changes nothing. Keyed on the plan's private link,
 * the credential the plan page and "delete all of it" already take. Which
 * questions count is decided on the server, from the version the person's
 * page showed and the values in their plan; the browser only says what was
 * picked or typed. Nothing here reaches telemetry or a compute (rules 5, 6).
 */
export async function POST(req: Request) {
  const refused = limited(req, "capture");
  if (refused) return refused;
  const read = await readJson(req);
  if (!read.ok) return read.res;
  const b = read.body as { token?: unknown; answers?: unknown };

  const r = await recordCustomAnswers(typeof b.token === "string" ? b.token : "", b.answers);
  if (!r.ok) {
    /* Only the product's own words reach the page, never the database's. */
    if (!/link|day the plan/.test(r.error)) captureOpError(new Error(r.error), { op: "plan.answers" });
    return NextResponse.json({ ok: false, error: /link|day the plan/.test(r.error) ? r.error : "Your answers did not save. Your plan is saved either way." });
  }
  if ("skipped" in r) return NextResponse.json({ ok: false, error: "Answers are not being kept on this site right now. Your plan is saved either way." });
  return NextResponse.json({ ok: true, saved: r.data.saved });
}
