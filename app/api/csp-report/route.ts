import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { limited, readJson } from "@/lib/db/guard";
import { cspViolation } from "@/lib/core/csp";

export const runtime = "nodejs";

/**
 * Where browsers report what the report-only Content-Security-Policy would
 * have blocked (lib/core/csp.ts).
 *
 * Same-origin on purpose. A report carries the full address of the page, and
 * on a plan or readout page that address is the capability link, so it is
 * never forwarded: only the directive and the blocked origin reach Sentry,
 * once per instance for each pair, so a page that trips one rule on every
 * load is one event, not thousands.
 */
const seen = new Set<string>();

export async function POST(req: Request) {
  const refused = limited(req, "cspReport");
  if (refused) return refused;
  const body = await readJson(req);
  if (!body.ok) return new NextResponse(null, { status: 204 });

  const v = cspViolation(body.body);
  if (v) {
    const key = `${v.directive} ${v.blocked}`;
    if (!seen.has(key) && seen.size < 200) {
      seen.add(key);
      Sentry.withScope((scope) => {
        scope.setTag("op", "csp.report-only");
        scope.setTag("csp.directive", v.directive);
        scope.setExtra("blocked", v.blocked);
        Sentry.captureMessage(`CSP would block ${v.blocked} (${v.directive})`, "warning");
      });
    }
  }
  return new NextResponse(null, { status: 204 });
}
